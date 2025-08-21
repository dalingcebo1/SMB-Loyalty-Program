import React from 'react';
import { ResponsiveContainer } from 'recharts';

export interface ChartContainerProps {
  children: React.ReactNode;
  aspect?: number;
  height?: number;
  className?: string;
}
const ChartContainer: React.FC<ChartContainerProps> = ({ children, aspect = 2, height = 200, className }) => (
  <div className={className}>
    {aspect ? (
      <ResponsiveContainer width="100%" aspect={aspect}>
        {children}
      </ResponsiveContainer>
    ) : (
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    )}
  </div>
);

// Memoize ChartContainer to avoid unnecessary re-renders
export default React.memo(ChartContainer);
