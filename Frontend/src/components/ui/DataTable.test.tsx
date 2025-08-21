import { render, screen, fireEvent } from '../../utils/test-utils';
import DataTable from './DataTable';
import type { Column } from './DataTable';
import { vi } from 'vitest';

// Define a row type for testing
type TestRow = { id: number; name: string; email: string };
describe('DataTable component', () => {
  const mockData: TestRow[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  ];

  const mockColumns: Column<TestRow>[] = [
    { header: 'Name', accessor: row => row.name },
    { header: 'Email', accessor: row => row.email },
  ];

  it('renders with data', () => {
    render(<DataTable data={mockData} columns={mockColumns} />);
    // headers
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    // row data
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('displays empty state when no data', () => {
    render(
      <DataTable data={[]} columns={mockColumns} emptyMessage="No data available" />
    );
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('handles row click events', () => {
    const onRowClick = vi.fn();
    render(
      <DataTable data={mockData} columns={mockColumns} onRowClick={onRowClick} />
    );
    const firstRow = screen.getByText('John Doe').closest('tr');
    fireEvent.click(firstRow!);
    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });
});
