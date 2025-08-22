import React from 'react';

export interface Column<T> {
  id?: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Message to display when data is empty */
  emptyMessage?: string;
  /** Click handler for rows */
  onRowClick?: (row: T) => void;
}

// Generic table component implementation
function DataTableComponent<T>({ columns, data, emptyMessage, onRowClick }: DataTableProps<T>) {
  // Render empty state
  if (data.length === 0 && emptyMessage) {
    return (
      <table role="table" aria-label="Data Table" className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map(col => (
              <th key={col.id ?? col.header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={columns.length} className="px-6 py-4 text-center text-gray-500">
              {emptyMessage}
            </td>
          </tr>
        </tbody>
      </table>
    );
  }
  return (
    <table
      className="min-w-full divide-y divide-gray-200"
      role="table"
      aria-label="Data Table"
    >
      <thead className="bg-gray-50">
        <tr>
          {columns.map(col => (
            <th
              key={col.id ?? col.header}
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((row, rowIndex) => (
          <tr
            key={rowIndex}
            onClick={() => onRowClick?.(row)}
            className={`hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 ${onRowClick ? 'cursor-pointer' : ''}`}
            tabIndex={0}
          >
            {columns.map(col => (
              <td
                key={col.id ?? col.header}
                className="px-6 py-4 whitespace-nowrap text-gray-700 tabular-nums"
              >
                {col.accessor(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Memoized generic DataTable
export const DataTable = React.memo(DataTableComponent) as <T>(
  props: DataTableProps<T>
) => React.JSX.Element;
export default DataTable;
