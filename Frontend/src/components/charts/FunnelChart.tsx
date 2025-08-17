import React from 'react';
import {
  ResponsiveContainer,
  FunnelChart as RechartsFunnelChart,
  Funnel,
  Tooltip,
  LabelList
} from 'recharts';

export interface FunnelDataPoint {
  name: string;
  value: number;
}
export interface FunnelChartProps {
  data: FunnelDataPoint[];
  height?: number;
}

const FunnelChart: React.FC<FunnelChartProps> = ({ data, height = 250 }) => (
  <div className="bg-white rounded shadow-sm p-4">
    <ResponsiveContainer width="100%" height={height}>
      <RechartsFunnelChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <Tooltip />
        <Funnel
          dataKey="value"
          nameKey="name"
          isAnimationActive={false}
          stroke="#8884d8"
        >
          <LabelList position="inside" fill="#fff" stroke="none" dataKey="name" />
        </Funnel>
      </RechartsFunnelChart>
    </ResponsiveContainer>
  </div>
);

export default FunnelChart;
