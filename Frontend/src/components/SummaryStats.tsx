import React from 'react';

interface SummaryStatsProps {
  totalHistory: number;
  completedCount: number;
  inProgressCount: number;
  avgDurationMin: number;
}

const SummaryStats: React.FC<SummaryStatsProps> = ({ totalHistory, completedCount, inProgressCount, avgDurationMin }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
    <div>
      <h3 className="font-semibold">Total Washes</h3>
      <p>{totalHistory}</p>
    </div>
    <div>
      <h3 className="font-semibold">Completed</h3>
      <p>{completedCount}</p>
    </div>
    <div>
      <h3 className="font-semibold">In Progress</h3>
      <p>{inProgressCount}</p>
    </div>
    <div>
      <h3 className="font-semibold">Avg Duration</h3>
      <p>{avgDurationMin} min</p>
    </div>
  </div>
);

export default SummaryStats;
