import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area
} from 'recharts';

export interface SeriesPoint { date: string; value: number; count?: number }
export interface TimeSeriesChartProps {
  title?: string;
  series: { name: string; data: SeriesPoint[]; color?: string; type?: 'line' | 'area'; dataKey?: string }[];
  height?: number;
  yLabel?: string;
  stacked?: boolean;
  /** Optional formatter for tooltip values */
  tooltipFormatter?: (value: number) => string;
}

const palette = ['#2563eb', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#7c3aed'];

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({ title, series, height = 260, yLabel, tooltipFormatter }) => {
  const dateMap: Record<string, any> = {};
  series.forEach(s => {
    s.data.forEach(p => {
      const key = p.date;
      if (!dateMap[key]) dateMap[key] = { date: key };
      const dk = s.dataKey || ('value' in p ? 'value' : 'count');
      dateMap[key][s.name] = (p as any)[dk];
    });
  });
  const data = Object.values(dateMap).sort((a: any, b: any) => a.date.localeCompare(b.date));
  const lines = series.map((s, i) => {
    const color = s.color || palette[i % palette.length];
    if (s.type === 'area') {
      return <Area key={s.name} type="monotone" dataKey={s.name} stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} />;
    }
    return <Line key={s.name} type="monotone" dataKey={s.name} stroke={color} strokeWidth={2} dot={false} />;
  });
  const ChartComp: any = series.some(s => s.type === 'area') ? AreaChart : LineChart;
  return (
    <div className="bg-white rounded shadow-sm p-4">
      {title && <h3 className="text-sm font-semibold mb-3 tracking-wide text-gray-700">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <ChartComp data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } } : undefined} />
          <Tooltip formatter={tooltipFormatter ? (value: any) => tooltipFormatter(Number(value)) : undefined} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {lines}
        </ChartComp>
      </ResponsiveContainer>
    </div>
  );
};

export default TimeSeriesChart;
