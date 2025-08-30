// Lazy-loaded chart component to keep Recharts out of initial staff dashboard bundle (Phase 4)
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import ChartContainer from '../../../components/ui/ChartContainer';

export interface WashesByDatePoint { date: string; count: number }

interface Props {
  data: WashesByDatePoint[];
}

const WashesByDateChart: React.FC<Props> = ({ data }) => {
  if (!data || data.length === 0) return null;
  return (
    <ChartContainer aspect={2} className="w-full">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="#8884d8" />
      </BarChart>
    </ChartContainer>
  );
};

export default WashesByDateChart;
