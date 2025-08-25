import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
} from 'recharts';

export interface SparklineChartProps {
  data: Array<{ date: string; value: number }>;
  color?: string;
  height?: number;
  width?: number | string;
}

const SparklineChart: React.FC<SparklineChartProps> = ({ data, color = '#8884d8', height = 40, width = '100%' }) => (
  <div style={{ width, height }}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Tooltip formatter={(val: number) => val} labelFormatter={() => ''} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export default SparklineChart;
