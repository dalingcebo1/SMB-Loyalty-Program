import React from 'react';
import { Link } from 'react-router-dom';

export interface MetricCardProps {
  label: string;
  value?: number;
  loading?: boolean;
  to?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value = 0, loading = false, to }) => {
  const card = (
    <div className="bg-white border border-gray-200 rounded p-5 flex flex-col items-center justify-center h-28 space-y-2 transition-colors">
      <div className="text-sm font-medium text-gray-600 tracking-wide uppercase">{label}</div>
      {loading ? (
        <div className="w-12 h-7 bg-gray-200 rounded animate-pulse" />
      ) : (
        <div className="text-3xl font-semibold tabular-nums">{value}</div>
      )}
    </div>
  );
  return to ? (
    <Link to={to} className="block hover:border-blue-400">
      {card}
    </Link>
  ) : (
    card
  );
};

export default MetricCard;
