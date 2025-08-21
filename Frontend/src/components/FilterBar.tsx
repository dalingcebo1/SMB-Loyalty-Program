import React, { useState, useEffect } from 'react';

export interface Filters {
  startDate?: string;
  endDate?: string;
  paymentType?: 'payment' | 'loyalty' | 'pos' | '';
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, onChange }) => {
  const [local, setLocal] = useState<Filters>(filters);

  useEffect(() => {
    setLocal(filters);
  }, [filters]);

  const handleChange = (key: keyof Filters) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = e.target.value;
    const updated = { ...local, [key]: value };
    setLocal(updated);
    onChange(updated);
  };

  return (
    <fieldset className="flex flex-wrap gap-4 mb-4 border p-4 rounded" aria-label="Filter options">
      <legend className="sr-only">Filters</legend>
      <div>
        <label className="block text-sm font-medium">Start Date</label>
        <input
          type="date"
          value={local.startDate || ''}
          onChange={handleChange('startDate')}
          className="border rounded px-2 py-1"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">End Date</label>
        <input
          type="date"
          value={local.endDate || ''}
          onChange={handleChange('endDate')}
          className="border rounded px-2 py-1"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Payment Type</label>
        <select
          value={local.paymentType || ''}
          onChange={handleChange('paymentType')}
          className="border rounded px-2 py-1"
        >
          <option value="">All</option>
          <option value="payment">Payment</option>
          <option value="loyalty">Loyalty</option>
          <option value="pos">POS</option>
        </select>
      </div>
  </fieldset>
  );
};

export default FilterBar;
