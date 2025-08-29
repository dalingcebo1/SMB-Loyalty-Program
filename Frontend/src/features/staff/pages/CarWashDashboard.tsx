import React, { useState } from 'react';
import { useActiveWashes, useEndWash } from '../../../api/queries';
import { useWashHistory } from '../hooks';
import { toast } from 'react-toastify';
import LoadingFallback from '../../../components/LoadingFallback';
import ConfirmDialog from '../../../components/ConfirmDialog';
import FilterBar, { Filters } from '../../../components/FilterBar';
import SummaryStats from '../../../components/SummaryStats';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import ChartContainer from '../../../components/ui/ChartContainer';
import TableContainer from '../../../components/ui/TableContainer';
import { Wash } from '../../../types';

const CarWashDashboard: React.FC = () => {
  const { data: activeWashes = [], isLoading, refetch } = useActiveWashes();
  // Filters for history
  const [filters, setFilters] = useState<Filters>({ startDate: '', endDate: '', paymentType: '' });
  const { data: history = [], isLoading: historyLoading } = useWashHistory({
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    paymentType: filters.paymentType || undefined,
  });
  const endWashMutation = useEndWash();
  const [confirmWash, setConfirmWash] = useState<string | null>(null);

  if (isLoading) {
    return <LoadingFallback message="Loading active washes…" />;
  }

  const handleEndClick = (orderId: string) => {
    setConfirmWash(orderId);
  };

  const confirmEnd = () => {
    if (!confirmWash) return;
    endWashMutation.mutate(confirmWash, {
      onSuccess: () => {
        toast.success('Wash ended!');
        refetch();
      },
      onError: () => toast.error('Could not end wash.'),
      onSettled: () => setConfirmWash(null),
    });
  };

  // Aggregate historical metrics
  const completedList = history.filter((w: Wash) => w.status === 'ended' && w.ended_at);
  const inProgressList = history.filter((w: Wash) => w.status === 'started');
  const totalHistory = history.length;
  const completedCount = completedList.length;
  const inProgressCount = inProgressList.length;
  const avgDurationMs = completedCount > 0
    ? completedList.reduce(
        (sum: number, w: Wash) => sum + (new Date(w.ended_at!).getTime() - new Date(w.started_at).getTime()),
        0
      ) / completedCount
    : 0;
  const avgDurationMin = Math.round(avgDurationMs / 60000);
  
  return (
    <div className="p-4 max-w-4xl mx-auto">
  {/* ToastContainer handles notifications */}
  <ConfirmDialog
        isOpen={!!confirmWash}
        title="End Wash?"
        description="Are you sure you want to end this wash?"
        confirmLabel="Yes, End"
        onConfirm={confirmEnd}
        onCancel={() => setConfirmWash(null)}
  loading={endWashMutation.status === 'pending'}
      />

      <h1 className="text-2xl font-bold mb-4 text-center">Car Wash Dashboard</h1>

      <section className="bg-white shadow rounded p-4 mb-6">
        <h2 className="text-xl font-semibold mb-2">Active Washes</h2>
        {activeWashes.length === 0 ? (
          <p className="text-gray-500">No active washes.</p>
        ) : (
          <TableContainer>
            <ul>
              {activeWashes.map((wash: Wash) => (
                <li key={wash.order_id} className="flex justify-between items-center py-2 border-b">
                  <span>
                    {wash.user?.first_name} {wash.user?.last_name} — {wash.vehicle?.make} {wash.vehicle?.model} {wash.vehicle?.reg}
                  </span>
                  <button
                    onClick={() => handleEndClick(wash.order_id)}
                    className="px-2 py-1 bg-red-600 text-white rounded"
                  >
                    End Wash
                  </button>
                </li>
              ))}
            </ul>
          </TableContainer>
        )}
      </section>

      {/* Summary */}
      <SummaryStats
        totalHistory={totalHistory}
        completedCount={completedCount}
        inProgressCount={inProgressCount}
        avgDurationMin={avgDurationMin}
      />
      {/* Wash History */}
      <section className="bg-white shadow rounded p-4 mb-6">
        <h2 className="text-xl font-semibold mb-2">Wash History</h2>
        <FilterBar filters={filters} onChange={setFilters} />
        {historyLoading ? (
          <LoadingFallback message="Loading history…" />
        ) : history.length === 0 ? (
          <p className="text-gray-500">No washes found for selected filters.</p>
        ) : (
          <ul>
            {history.map((wash: Wash) => (
              <li key={wash.order_id} className="mb-4 border-b pb-2">
                <div>
                  <span className="font-semibold">{wash.user?.first_name} {wash.user?.last_name}</span>
                  {wash.vehicle && (
                    <>: {wash.vehicle.make} {wash.vehicle.model} {wash.vehicle.reg}</>
                  )}
                </div>
                <div className="mt-1">
                  <span className="font-semibold">Type:</span> {wash.service_name || 'N/A'}
                </div>
                <div className="mt-1">
                  <span className="font-semibold">Started:</span> {wash.started_at}
                </div>
                <div className="mt-1">
                  <span className="font-semibold">Ended:</span> {wash.ended_at || '—'}
                </div>
                <div className="mt-1">
                  <span className={wash.status === 'started' ? 'text-blue-600' : 'text-green-600'}>
                    {wash.status === 'started' ? 'In Progress' : 'Completed'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Washes by Date Chart */}
      {history.length > 0 && (
        <div className="bg-white shadow rounded p-4 mb-6 overflow-x-auto">
          <h2 className="text-xl font-semibold mb-2">Washes by Date</h2>
          <ChartContainer aspect={2} className="w-full">
            <BarChart data={(() => {
              const counts: Record<string, number> = {};
              history.forEach((w: Wash) => {
                const date = w.started_at.slice(0, 10);
                counts[date] = (counts[date] || 0) + 1;
              });
              return Object.entries(counts).map(([date, count]) => ({ date, count }));
            })()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </div>
  );
};

export default CarWashDashboard;
