import React, { type ReactNode } from 'react';
import type { PaginatedResponse } from '../../types/api';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export interface ColumnDef<T> {
  id?: string;
  header: string;
  accessor: (row: T) => ReactNode;
  sortField?: string;
}

export interface VerticalDataTableProps<T> {
  /** Paginated response from the API, or a plain array. */
  data: PaginatedResponse<T> | T[] | undefined;
  columns: ColumnDef<T>[];
  isLoading: boolean;
  onPageChange?: (page: number) => void;
  onSort?: (field: string, order: 'asc' | 'desc') => void;
  rowActions?: (row: T) => ReactNode;
  emptyMessage?: string;
  /** Current sort state (optional) */
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

function isPaginated<T>(data: PaginatedResponse<T> | T[]): data is PaginatedResponse<T> {
  return data != null && !Array.isArray(data) && 'items' in data;
}

function VerticalDataTableInner<T>({
  data,
  columns,
  isLoading,
  onPageChange,
  onSort,
  rowActions,
  emptyMessage = 'No items found',
  sortBy,
  sortOrder = 'asc',
}: VerticalDataTableProps<T>) {
  const items: T[] = data == null ? [] : isPaginated(data) ? data.items : data;
  const pagination = data != null && isPaginated(data) ? data : null;

  const allColumns = rowActions
    ? [...columns, { header: 'Actions', accessor: rowActions } as ColumnDef<T>]
    : columns;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200" role="table" aria-label="Data table">
          <thead className="bg-gray-50">
            <tr>
              {allColumns.map((col) => {
                const key = col.id ?? col.header;
                const sortable = !!col.sortField && !!onSort;
                return (
                  <th
                    key={key}
                    scope="col"
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortable ? 'cursor-pointer select-none hover:text-gray-700' : ''}`}
                    onClick={
                      sortable
                        ? () => onSort!(col.sortField!, sortBy === col.sortField && sortOrder === 'asc' ? 'desc' : 'asc')
                        : undefined
                    }
                  >
                    {col.header}
                    {sortable && sortBy === col.sortField && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {allColumns.map((col) => (
                  <td key={col.id ?? col.header} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {pagination && onPageChange && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="text-sm text-gray-700">
            Showing page <span className="font-medium">{pagination.page}</span> of{' '}
            <span className="font-medium">{Math.ceil(pagination.total / pagination.per_page) || 1}</span>{' '}
            ({pagination.total} total)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiChevronLeft className="mr-1" /> Previous
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={!pagination.has_next}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next <FiChevronRight className="ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const VerticalDataTable = React.memo(VerticalDataTableInner) as <T>(
  props: VerticalDataTableProps<T>,
) => React.JSX.Element;
