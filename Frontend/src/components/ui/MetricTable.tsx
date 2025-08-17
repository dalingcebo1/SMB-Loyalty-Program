import React from 'react';
import { humanizeMetric } from '../../utils/metrics';

export interface MetricTableProps {
  data: Record<string, any>;
  labels?: Record<string, string>;
}

const MetricTable: React.FC<MetricTableProps> = ({ data, labels = {} }) => (
  <div className="overflow-x-auto p-6">
    <table className="min-w-full divide-y divide-gray-200 text-sm">
      <thead>
        <tr className="bg-gray-50">
          <th className="px-6 py-3 text-left font-medium text-gray-600 uppercase tracking-wider">Metric</th>
          <th className="px-6 py-3 text-left font-medium text-gray-600 uppercase tracking-wider">Value</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {Object.entries(data).map(([key, value]) => (
          <tr key={key} className="hover:bg-gray-50">
            <td className="px-6 py-4 font-medium text-gray-900">
              {humanizeMetric(key, labels)}
            </td>
            <td className="px-6 py-4 text-gray-700 tabular-nums">{String(value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default MetricTable;
