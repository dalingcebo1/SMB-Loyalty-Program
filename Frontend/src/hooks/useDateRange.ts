import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DateRange } from '../types/admin';

export function useDateRange(defaultDays = 7): DateRange & {
  setStart: (s: string) => void;
  setEnd: (e: string) => void;
  refresh: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const startParam = searchParams.get('start_date');
  const endParam = searchParams.get('end_date');
  const today = new Date().toISOString().slice(0, 10);
  const ago = new Date(Date.now() - (defaultDays - 1) * 864e5).toISOString().slice(0, 10);
  const [start, setStart] = useState<string>(startParam || ago);
  const [end, setEnd] = useState<string>(endParam || today);

  useEffect(() => {
    if (!startParam || !endParam) {
      setSearchParams({ start_date: start, end_date: end });
    }
  }, []);

  const refresh = () => setSearchParams({ start_date: start, end_date: end });

  return { start, end, setStart, setEnd, refresh };
}
