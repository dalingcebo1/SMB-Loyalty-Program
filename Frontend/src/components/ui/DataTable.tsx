import React from 'react';

export interface Column<T> {
  id?: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
}

export function DataTable<T>({ columns, data }: DataTableProps<T>) {
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
            className="hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
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

export default DataTable;
