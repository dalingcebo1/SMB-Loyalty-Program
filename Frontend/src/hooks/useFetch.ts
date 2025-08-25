import { useState, useEffect, useMemo } from "react";
import api from "../api/api";

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * useFetch hook for fetching data via API.
 * @param url API endpoint (relative to base URL)
 * @param params Optional request params
 */
function useFetch<T>(url: string, params?: Record<string, unknown>): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize params to avoid unnecessary re-renders
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    api
      .get<T>(url, { params })
      .then((res) => {
        if (isMounted) {
          setData(res.data);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Error fetching data");
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [url, paramsKey, params]);

  return { data, loading, error };
}

export default useFetch;
