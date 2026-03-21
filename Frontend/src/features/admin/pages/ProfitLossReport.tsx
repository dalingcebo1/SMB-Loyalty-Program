import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCapabilities } from '../hooks/useCapabilities';
import api from '../../../api/api';
import { AdminPageContainer } from '../components/AdminGrid';
import { formatCents } from '../../../utils/format';
import LoadingSpinner from '../../../components/LoadingSpinner';

interface ProfitAndLoss {
  revenue: Record<string, number>;
  expenses: Record<string, number>;
  gross_profit_cents: number;
  net_profit_cents: number;
  profit_margin: number;
  start_date: string;
  end_date: string;
}

const REVENUE_LABELS: Record<string, string> = {
  orders_revenue_cents: 'Order Revenue',
  sales_revenue_cents: 'POS Sales',
  payments_revenue_cents: 'Payment Revenue',
  invoices_revenue_cents: 'Invoice Revenue',
};

const EXPENSE_LABELS: Record<string, string> = {
  inventory_cents: 'Inventory',
  rent_cents: 'Rent',
  utilities_cents: 'Utilities',
  salaries_cents: 'Salaries',
  marketing_cents: 'Marketing',
  equipment_cents: 'Equipment',
  maintenance_cents: 'Maintenance',
  insurance_cents: 'Insurance',
  taxes_cents: 'Taxes',
  professional_services_cents: 'Professional Services',
  travel_cents: 'Travel',
  other_cents: 'Other',
};

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function defaultStartDate(): string {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function defaultEndDate(): string {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

const ProfitLossReport: React.FC = () => {
  const { has } = useCapabilities();
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  const {
    data: report,
    isLoading,
    isError,
    error,
  } = useQuery<ProfitAndLoss>({
    queryKey: ['profit-loss', startDate, endDate],
    queryFn: async () =>
      (
        await api.get('/reports/profit-loss', {
          params: { start_date: startDate, end_date: endDate },
        })
      ).data,
    enabled: has('manage-finances'),
    staleTime: 60_000,
  });

  if (!has('manage-finances')) {
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
  }

  const revenueItems =
    report?.revenue
      ? Object.entries(report.revenue).filter(
          ([key, value]) => key !== 'total_revenue_cents' && value !== 0 && key in REVENUE_LABELS,
        )
      : [];

  const expenseItems =
    report?.expenses
      ? Object.entries(report.expenses).filter(
          ([key, value]) => key !== 'total_expenses_cents' && value !== 0 && key in EXPENSE_LABELS,
        )
      : [];

  const totalRevenue = report?.revenue?.total_revenue_cents ?? 0;
  const totalExpenses = report?.expenses?.total_expenses_cents ?? 0;

  return (
    <AdminPageContainer
      title="Profit & Loss Report"
      description="Financial performance statement for the selected period"
    >
      {/* Date Range Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="pl-start"
              className="block text-xs font-medium text-gray-500 mb-1"
            >
              Start Date
            </label>
            <input
              id="pl-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="pl-end"
              className="block text-xs font-medium text-gray-500 mb-1"
            >
              End Date
            </label>
            <input
              id="pl-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-red-600 font-medium">
            Failed to load report
          </div>
          <div className="text-sm text-red-500 mt-1">
            {(error as Error)?.message ?? 'Unknown error'}
          </div>
        </div>
      )}

      {/* P&L Statement */}
      {report && !isLoading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              Profit &amp; Loss Statement
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {report.start_date} — {report.end_date}
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            {/* ── REVENUE ── */}
            <div className="px-6 py-4">
              <h3 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-3">
                Revenue
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {revenueItems.map(([key, value]) => (
                    <tr key={key} className="group">
                      <td className="py-1.5 text-gray-700 pl-4">
                        {REVENUE_LABELS[key]}
                      </td>
                      <td className="py-1.5 text-right text-emerald-600 font-medium tabular-nums">
                        {formatCents(value)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-emerald-200">
                    <td className="pt-2 pb-1 pl-4 font-bold text-emerald-800">
                      Total Revenue
                    </td>
                    <td className="pt-2 pb-1 text-right font-bold text-emerald-800 tabular-nums underline decoration-double">
                      {formatCents(totalRevenue)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── EXPENSES ── */}
            <div className="px-6 py-4">
              <h3 className="text-sm font-semibold text-rose-700 uppercase tracking-wide mb-3">
                Expenses
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {expenseItems.map(([key, value]) => (
                    <tr key={key} className="group">
                      <td className="py-1.5 text-gray-700 pl-4">
                        {EXPENSE_LABELS[key]}
                      </td>
                      <td className="py-1.5 text-right text-rose-600 font-medium tabular-nums">
                        {formatCents(value)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-rose-200">
                    <td className="pt-2 pb-1 pl-4 font-bold text-rose-800">
                      Total Expenses
                    </td>
                    <td className="pt-2 pb-1 text-right font-bold text-rose-800 tabular-nums underline decoration-double">
                      {formatCents(totalExpenses)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── SUMMARY ── */}
            <div className="px-6 py-5 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Summary
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-1.5 pl-4 text-gray-700">Gross Profit</td>
                    <td
                      className={`py-1.5 text-right font-semibold tabular-nums ${
                        report.gross_profit_cents >= 0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatCents(report.gross_profit_cents)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pl-4 text-gray-700">Net Profit</td>
                    <td
                      className={`py-1.5 text-right font-semibold tabular-nums ${
                        report.net_profit_cents >= 0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatCents(report.net_profit_cents)}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="pt-3 pb-1 pl-4 font-bold text-gray-900">
                      Profit Margin
                    </td>
                    <td
                      className={`pt-3 pb-1 text-right font-bold text-lg tabular-nums ${
                        report.profit_margin >= 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {report.profit_margin.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AdminPageContainer>
  );
};

export default ProfitLossReport;
