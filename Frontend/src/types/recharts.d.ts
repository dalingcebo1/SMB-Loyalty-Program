declare module 'recharts' {
  // Minimal type shims to allow JSX usage without full @types package
  import * as React from 'react';
  export const ResponsiveContainer: React.FC<any>;
  export const LineChart: React.FC<any>;
  export const Line: React.FC<any>;
  export const XAxis: React.FC<any>;
  export const YAxis: React.FC<any>;
  export const CartesianGrid: React.FC<any>;
  export const Tooltip: React.FC<any>;
  export const Legend: React.FC<any>;
  export const AreaChart: React.FC<any>;
  export const Area: React.FC<any>;
  export const BarChart: React.FC<any>;
  export const Bar: React.FC<any>;
}
