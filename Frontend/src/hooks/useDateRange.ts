import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DateRange } from '../types/admin';

export function useDateRange(defaultDays = 7): DateRange & {
  setStart: (s: string) => void;
  setEnd: (e: string) => void;
  refresh: () => void;
  period: string;
  setPeriod: (p: string) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const startParam = searchParams.get('start_date');
  const endParam = searchParams.get('end_date');
  const today = new Date().toISOString().slice(0, 10);
    const ago = new Date(Date.now() - (defaultDays - 1) * 864e5).toISOString().slice(0, 10); // Default start date
  const [start, setStart] = useState<string>(startParam || ago);
  const [end, setEnd] = useState<string>(endParam || today);
  const periodParam = searchParams.get('period') || '1W';
  const [period, setPeriod] = useState<string>(periodParam);

  useEffect(() => {
    if (!startParam || !endParam) {
      // initialize URL if missing
      setSearchParams({ start_date: start, end_date: end });
    }
  }, []);
  // update state when URL params change via filters
  useEffect(() => {
    if (startParam && endParam) {
      setStart(startParam);
      setEnd(endParam);
    }
  }, [startParam, endParam]);

  const refresh = () => setSearchParams({ start_date: start, end_date: end, period });

  return { start, end, setStart, setEnd, refresh, period, setPeriod };
}
