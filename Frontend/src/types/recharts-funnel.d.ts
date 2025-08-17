import React from 'react';

declare module 'recharts' {
  export const FunnelChart: React.FC<any>;
  export const Funnel: React.FC<any>;
  export const LabelList: React.FC<any>;
}
