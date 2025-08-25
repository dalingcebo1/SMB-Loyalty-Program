import React, { useState, useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { useDateRange } from '../hooks/useDateRange';
import api, { buildQuery } from '../api/api';
import { useQuery } from '@tanstack/react-query';
import { SummaryMetrics } from '../types/metrics';

const GoalsPanel: React.FC = () => {
  const { start, end } = useDateRange();
  const [target, setTarget] = useState<number>(() => {
    const saved = localStorage.getItem('monthlyTarget');
    return saved ? Number(saved) : 1000;
  });

  // Fetch current summary
  const { data: summary } = useQuery<SummaryMetrics, Error>({
    queryKey: ['analyticsSummary', start, end],
    queryFn: () => api
      .get(`/analytics/summary${buildQuery({ start_date: start, end_date: end })}`)
      .then(r => r.data),
    staleTime: 1000 * 60 * 5,
  });
  // Fetch previous period summary for comparison
  const prevKey = ['analyticsSummaryPrev', start, end];
  const { data: prevSummary } = useQuery<SummaryMetrics, Error>({
    queryKey: prevKey,
    queryFn: () => {
      // calculate previous period dates
      const s = new Date(start);
      const e = new Date(end);
      const delta = e.getTime() - s.getTime();
      const prevEnd = new Date(s.getTime() - 86400000).toISOString().slice(0,10);
      const prevStart = new Date(s.getTime() - delta - 86400000).toISOString().slice(0,10);
      return api.get(
        `/analytics/summary${buildQuery({ start_date: prevStart, end_date: prevEnd })}`
      ).then(r => r.data);
    },
    staleTime: 1000 * 60 * 5,
  });

  // compute progress
  const current = summary?.transaction_count || 0;
  const percent = target ? Math.min(100, Math.round((current / target) * 100)) : 0;

  // alert if change > 10%
  useEffect(() => {
    if (summary && prevSummary) {
      const curr = summary.transaction_count;
      const prev = prevSummary.transaction_count || 1;
      const change = ((curr - prev) / prev) * 100;
      if (Math.abs(change) > 10) {
          toast(
            `Transactions ${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}% vs prior period`,
            { type: change > 0 ? 'success' : 'error' }
          );
      }
    }
  }, [summary, prevSummary]);

  const handleSave = () => {
    localStorage.setItem('monthlyTarget', String(target));
  toast('Target saved', { type: 'info' });
  };

  return (
    <>
      <ToastContainer />
      <div className="bg-white rounded shadow-sm p-4 mb-6">
      <h3 className="text-lg font-semibold mb-2">Monthly Transaction Target</h3>
      <div className="flex items-center gap-4">
        <div style={{ width: 80, height: 80 }}>
          <CircularProgressbar
            value={percent}
            text={`${percent}%`}
            styles={buildStyles({ textSize: '16px', pathColor: '#2563eb', textColor: '#333' })}
          />
        </div>
        <div>
          <input
            type="number"
            value={target}
            min={0}
            onChange={e => setTarget(Number(e.target.value))}
            className="border p-2 rounded w-24"
          />
          <button onClick={handleSave} className="ml-2 px-3 py-1 bg-blue-600 text-white rounded">
            Save
          </button>
        </div>
      </div>
      </div>
    </>
  );
};

export default GoalsPanel;
