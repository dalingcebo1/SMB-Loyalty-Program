import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCapabilities } from '../hooks/useCapabilities';
import api from '../../../api/api';
import { AdminPageContainer, AdminGrid } from '../components/AdminGrid';
import { StatCard } from '../components/AdminCard';
import { formatCents } from '../../../utils/format';

interface MonthlyRow {
  month: number;
  month_name: string;
  revenue_cents: number;
  expenses_cents: number;
  profit_cents: number;
}

interface RevenueSummary {
  orders_revenue_cents: number;
  total_revenue_cents: number;
  [key: string]: number;
}

interface ExpenseSummary {
  total_expenses_cents: number;
  [key: string]: number;
}

interface Invoice {
  total_cents: number;
  [key: string]: unknown;
}

function monthRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(start), end: fmt(end) };
}

const FinancialDashboard: React.FC = () => {
  const { has } = useCapabilities();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const { start, end } = useMemo(() => monthRange(), []);

  // --- Queries ---
  const revenue = useQuery<RevenueSummary>({
    queryKey: ['fin-revenue-summary', start, end],
    queryFn: async () =>
      (await api.get(`/reports/revenue-summary?start_date=${start}&end_date=${end}`)).data,
    staleTime: 60_000,
    enabled: has('manage-finances'),
  });

  const expenses = useQuery<ExpenseSummary>({
    queryKey: ['fin-expense-summary', start, end],
    queryFn: async () =>
      (await api.get(`/reports/expense-summary?start_date=${start}&end_date=${end}`)).data,
    staleTime: 60_000,
    enabled: has('manage-finances'),
  });

  const invoices = useQuery<Invoice[]>({
    queryKey: ['fin-outstanding-invoices'],
    queryFn: async () => (await api.get('/invoices/?status=sent')).data,
    staleTime: 60_000,
    enabled: has('manage-finances'),
  });

  const monthly = useQuery<MonthlyRow[]>({
    queryKey: ['fin-monthly-comparison', year],
    queryFn: async () =>
      (await api.get(`/reports/monthly-comparison?year=${year}`)).data,
    staleTime: 60_000,
    enabled: has('manage-finances'),
  });

  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i),
    [],
  );

  // --- Access guard ---
  if (!has('manage-finances'))
    return (
      <AdminPageContainer title="Access Denied" description="">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-red-600 font-medium">Access Denied</div>
          <div className="text-sm text-red-500 mt-1">
            Missing capability: manage-finances
          </div>
        </div>
      </AdminPageContainer>
    );

  // --- Derived values ---
  const totalRevenue = revenue.data?.total_revenue_cents ?? 0;
  const totalExpenses = expenses.data?.total_expenses_cents ?? 0;
  const netProfit = totalRevenue - totalExpenses;
  const outstandingTotal = (invoices.data ?? []).reduce(
    (sum, inv) => sum + (inv.total_cents ?? 0),
    0,
  );

  const isLoading =
    revenue.isLoading || expenses.isLoading || invoices.isLoading;

  const maxMonthly = Math.max(
    ...(monthly.data ?? []).map((r) =>
      Math.max(r.revenue_cents, r.expenses_cents, 1),
    ),
    1,
  );

  return (
    <AdminPageContainer
      title="Financial Dashboard"
      description="Revenue, expenses, and profitability overview"
      actions={
        <button
          onClick={() => {
            revenue.refetch();
            expenses.refetch();
            invoices.refetch();
            monthly.refetch();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          ↻ Refresh
        </button>
      }
    >
      {/* ── Summary Cards ───────────────────────────── */}
      <AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 4 }} gap="sm">
        <StatCard
          label="Total Revenue (MTD)"
          value={isLoading ? '…' : formatCents(totalRevenue)}
          changeDirection="positive"
        />
        <StatCard
          label="Total Expenses (MTD)"
          value={isLoading ? '…' : formatCents(totalExpenses)}
          changeDirection="negative"
        />
        <StatCard
          label="Net Profit (MTD)"
          value={isLoading ? '…' : formatCents(netProfit)}
          changeDirection={netProfit >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="Outstanding Invoices"
          value={isLoading ? '…' : formatCents(outstandingTotal)}
          info={
            invoices.data
              ? `${invoices.data.length} invoice${invoices.data.length === 1 ? '' : 's'}`
              : undefined
          }
          changeDirection="neutral"
        />
      </AdminGrid>

      {/* ── Revenue vs Expenses Overview ─────────────── */}
      <div className="mt-6 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-base font-semibold text-gray-900">
            Revenue vs Expenses — Current Month
          </h2>
        </div>
        <div className="p-6">
          {revenue.isLoading || expenses.isLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              Loading…
            </div>
          ) : revenue.isError || expenses.isError ? (
            <div className="text-center py-8 text-red-500 text-sm">
              Failed to load summary data.
            </div>
          ) : (
            <div className="space-y-4">
              <BarRow
                label="Revenue"
                value={totalRevenue}
                max={Math.max(totalRevenue, totalExpenses, 1)}
                color="bg-emerald-500"
              />
              <BarRow
                label="Expenses"
                value={totalExpenses}
                max={Math.max(totalRevenue, totalExpenses, 1)}
                color="bg-red-400"
              />
              <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">
                  Net Profit
                </span>
                <span
                  className={`text-sm font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {formatCents(netProfit)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Month-over-Month Comparison ──────────────── */}
      <div className="mt-6 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Monthly Comparison
          </h2>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="p-6">
          {monthly.isLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              Loading…
            </div>
          ) : monthly.isError ? (
            <div className="text-center py-8 text-red-500 text-sm">
              Failed to load monthly data.
            </div>
          ) : !monthly.data?.length ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No data for {year}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-2 pr-4 font-medium">Month</th>
                    <th className="pb-2 pr-4 font-medium">Revenue</th>
                    <th className="pb-2 pr-4 font-medium">Expenses</th>
                    <th className="pb-2 pr-4 font-medium">Profit</th>
                    <th className="pb-2 font-medium w-1/3">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.data.map((row) => (
                    <tr
                      key={row.month}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="py-2.5 pr-4 font-medium text-gray-900">
                        {row.month_name}
                      </td>
                      <td className="py-2.5 pr-4 text-emerald-600">
                        {formatCents(row.revenue_cents)}
                      </td>
                      <td className="py-2.5 pr-4 text-red-500">
                        {formatCents(row.expenses_cents)}
                      </td>
                      <td
                        className={`py-2.5 pr-4 font-semibold ${row.profit_cents >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                      >
                        {formatCents(row.profit_cents)}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1 h-4">
                          <div
                            className="h-3 rounded-sm bg-emerald-400 transition-all"
                            style={{
                              width: `${(row.revenue_cents / maxMonthly) * 100}%`,
                              minWidth: row.revenue_cents > 0 ? '2px' : '0',
                            }}
                          />
                          <div
                            className="h-3 rounded-sm bg-red-300 transition-all"
                            style={{
                              width: `${(row.expenses_cents / maxMonthly) * 100}%`,
                              minWidth: row.expenses_cents > 0 ? '2px' : '0',
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-emerald-400" />
                  Revenue
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-red-300" />
                  Expenses
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminPageContainer>
  );
};

function BarRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-semibold text-gray-900">{formatCents(value)}</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%`, minWidth: value > 0 ? '4px' : '0' }}
        />
      </div>
    </div>
  );
}

export default FinancialDashboard;
