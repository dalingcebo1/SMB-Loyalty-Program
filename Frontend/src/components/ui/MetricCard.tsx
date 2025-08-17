import React from 'react';
import { Link } from 'react-router-dom';
import SparklineChart from '../charts/SparklineChart';

export interface MetricCardProps {
  label: string;
  value?: number;
  loading?: boolean;
  to?: string;
  sparkline?: Array<{ date: string; value: number }>;
  sparklineColor?: string;
  /** Optional tooltip text for the metric label */
  tooltip?: string;
  /** Optional formatter for displaying the value */
  formatValue?: (value: number) => React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value = 0, loading = false, to, sparkline, sparklineColor, tooltip, formatValue }) => {
  const card = (
    <div className="bg-white border border-gray-200 rounded p-5 flex flex-col items-center justify-center space-y-2 transition-colors">
      <div className="text-sm font-medium text-gray-600 tracking-wide flex items-center">
        <span title={tooltip}>{label}</span>
        {tooltip && (
          <svg
            className="w-4 h-4 ml-1 text-gray-400 cursor-help"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10c0 4.418-3.582 8-8 8s-8-3.582-8-8 3.582-8 8-8 8 3.582 8 8zm-8.93-3.412a.75.75 0 011.36-.478l.094.126a.75.75 0 01-.094.875L9.75 8.75h.75a.75.75 0 010 1.5h-2.5a.75.75 0 01-.75-.75V7.25a.75.75 0 011.5 0v.838l.32-.5zM10 12a1 1 0 100 2 1 1 0 000-2z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
      {loading ? (
        <div className="w-12 h-7 bg-gray-200 rounded animate-pulse" />
      ) : (
        <> 
          <div className="text-2xl font-semibold tabular-nums text-gray-800">
            {formatValue ? formatValue(value) : value}
          </div>
          {/* reserve sparkline area to keep card heights uniform */}
          <div className="w-full mt-1 h-5">
            {sparkline ? (
              <SparklineChart data={sparkline} color={sparklineColor} height={20} />
            ) : (
              <div />
            )}
          </div>
        </>
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
