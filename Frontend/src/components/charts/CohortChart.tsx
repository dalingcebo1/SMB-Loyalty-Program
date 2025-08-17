import React from 'react';

// Stub cohort chart component; props are not yet used
export interface CohortChartProps {
  height?: number;
}

const CohortChart: React.FC<CohortChartProps> = ({ height = 300 }) => (
  <div className="bg-white rounded shadow-sm p-4">
    <h3 className="text-lg font-medium mb-2">Cohort & Retention (stub)</h3>
    <div className="h-[]" style={{ height }}>
      {/* TODO: implement cohort heatmap or line curves */}
      <span className="text-gray-400">Cohort retention chart placeholder</span>
    </div>
  </div>
);

export default CohortChart;
