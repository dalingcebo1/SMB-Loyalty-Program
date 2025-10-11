import React, { Suspense, lazy, useMemo, useState } from 'react';
import { timeDerivation } from '../../staff/perf/counters';
import { useActiveWashes, useEndWash } from '../hooks';
import { useWashHistory } from '../hooks';
import { toast } from 'react-toastify';
import LoadingFallback from '../../../components/LoadingFallback';
import ConfirmDialog from '../../../components/ConfirmDialog';
import FilterBar, { Filters } from '../../../components/FilterBar';
import SummaryStats from '../../../components/SummaryStats';
// Recharts moved to a lazy-loaded child chunk (Phase 4 code splitting)
const WashesByDateChart = lazy(() => import('../components/WashesByDateChart'));
import TableContainer from '../../../components/ui/TableContainer';
import { Wash } from '../../../types';
import VirtualizedWashHistory from '../components/VirtualizedWashHistory';
import StaffPageContainer from '../components/StaffPageContainer';

const CarWashDashboard: React.FC = () => {
  const { data: activeWashes = [], isLoading, refetch } = useActiveWashes();
  // Filters for history
  const [filters, setFilters] = useState<Filters>({ startDate: '', endDate: '', paymentType: '' });
  const { data: history = [], isLoading: historyLoading } = useWashHistory({
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    paymentType: filters.paymentType || undefined,
  });
  // Aggregate historical metrics (single memoized pass) -- must be before conditional return to keep hook order stable
  const metrics = useMemo(() => timeDerivation(
    'carWashDashboardMetricPasses',
    'carWashDashboardDerivationMs',
    () => {
    let completedCount = 0;
    let inProgressCount = 0;
    let durationSum = 0;
    const dateCounts: Record<string, number> = {};
    for (const w of history as Wash[]) {
      if (w.status === 'ended' && w.ended_at) {
        completedCount++;
        durationSum += (new Date(w.ended_at).getTime() - new Date(w.started_at).getTime());
      } else if (w.status === 'started') {
        inProgressCount++;
      }
      const d = w.started_at.slice(0,10);
      dateCounts[d] = (dateCounts[d] || 0) + 1;
    }
    const avgDurationMin = completedCount > 0 ? Math.round((durationSum / completedCount) / 60000) : 0;
    const chartData = Object.entries(dateCounts).map(([date, count]) => ({ date, count }));
    return { completedCount, inProgressCount, avgDurationMin, chartData };
  }), [history]);
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

  
  return (
    <>
      <ConfirmDialog
        isOpen={!!confirmWash}
        title="End Wash?"
        description="Are you sure you want to end this wash?"
        confirmLabel="Yes, End"
        onConfirm={confirmEnd}
        onCancel={() => setConfirmWash(null)}
        loading={endWashMutation.status === 'pending'}
      />

      <StaffPageContainer
        surface="glass"
        width="xl"
        padding="relaxed"
        className="relative overflow-hidden text-white"
      >
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Car wash dashboard</h1>
            <p className="mt-1 text-sm text-blue-100 sm:text-base">Monitor active washes and historic performance</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur-lg">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-300" aria-hidden />
            Live metrics
          </div>
        </div>
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.4),transparent_60%)]" aria-hidden />
      </StaffPageContainer>

  <StaffPageContainer surface="plain" width="xl">
        <SummaryStats
          totalHistory={history.length}
          completedCount={metrics.completedCount}
          inProgressCount={metrics.inProgressCount}
          avgDurationMin={metrics.avgDurationMin}
        />
      </StaffPageContainer>

  <StaffPageContainer surface="solid" width="xl" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">Active washes</h2>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Refresh
          </button>
        </div>
        {activeWashes.length === 0 ? (
          <p className="text-sm text-gray-500">No active washes right now.</p>
        ) : (
          <TableContainer>
            <ul className="divide-y divide-slate-200">
              {activeWashes.map((wash: Wash) => (
                <li key={wash.order_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-700">
                    {wash.user?.first_name} {wash.user?.last_name}
                    {wash.vehicle && (
                      <span className="text-slate-500">
                        {' '}
                        — {wash.vehicle.make} {wash.vehicle.model} {wash.vehicle.reg}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEndClick(wash.order_id)}
                    className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700"
                  >
                    End wash
                  </button>
                </li>
              ))}
            </ul>
          </TableContainer>
        )}
      </StaffPageContainer>

  <StaffPageContainer surface="solid" width="xl" className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">Wash history</h2>
            <p className="text-sm text-gray-500">Filter and review completed or in-progress washes</p>
          </div>
        </div>
        <FilterBar filters={filters} onChange={setFilters} />
        {historyLoading ? (
          <LoadingFallback message="Loading history…" />
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500">No washes found for the selected filters.</p>
        ) : history.length > 50 ? (
          <VirtualizedWashHistory washes={history} className="rounded-lg border border-slate-200" />
        ) : (
          <ul className="space-y-4">
            {history.map((wash: Wash) => (
              <li key={wash.order_id} className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <div className="flex flex-col gap-1 text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">
                    {wash.user?.first_name} {wash.user?.last_name}
                  </span>
                  {wash.vehicle && (
                    <span className="text-slate-500">
                      {wash.vehicle.make} {wash.vehicle.model} {wash.vehicle.reg}
                    </span>
                  )}
                  <span><strong>Type:</strong> {wash.service_name || 'N/A'}</span>
                  <span><strong>Started:</strong> {wash.started_at}</span>
                  <span><strong>Ended:</strong> {wash.ended_at || '—'}</span>
                  <span className={wash.status === 'started' ? 'text-blue-600 font-medium' : 'text-emerald-600 font-medium'}>
                    {wash.status === 'started' ? 'In progress' : 'Completed'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </StaffPageContainer>

      {history.length > 0 && (
  <StaffPageContainer surface="glass" width="xl" className="overflow-hidden">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 sm:text-xl">Washes by date</h2>
          <Suspense fallback={<div className="text-sm text-slate-500">Loading chart…</div>}>
            <WashesByDateChart data={metrics.chartData} />
          </Suspense>
        </StaffPageContainer>
      )}
    </>
  );
};

export default CarWashDashboard;
