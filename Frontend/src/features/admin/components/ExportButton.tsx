import React, { useState, useCallback } from 'react';
import { HiOutlineDownload } from 'react-icons/hi';
import api from '../../../api/api';

interface ExportButtonProps {
  /** API endpoint path (e.g. '/admin/transactions/export') */
  endpoint: string;
  /** Query params to pass (current filters, date range, etc.) */
  params?: Record<string, string | number | undefined>;
  /** Export format: csv or pdf */
  format?: 'csv' | 'pdf';
  /** Button label */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Disable the button */
  disabled?: boolean;
}

/**
 * Reusable export button that triggers a server-side file download.
 *
 * Uses fetch + blob + URL.createObjectURL to download the file without
 * navigating away from the current page.
 */
const ExportButton: React.FC<ExportButtonProps> = ({
  endpoint,
  params = {},
  format = 'csv',
  label,
  className = '',
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);

  const handleExport = useCallback(async () => {
    setLoading(true);
    try {
      // Build clean params — remove undefined values
      const cleanParams: Record<string, string | number> = { format };
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          cleanParams[key] = value;
        }
      }

      const response = await api.get(endpoint, {
        params: cleanParams,
        responseType: 'blob',
      });

      // Extract filename from Content-Disposition header or use fallback
      const disposition = response.headers['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
      const fallbackExt = format === 'pdf' ? 'pdf' : 'csv';
      const filename = filenameMatch?.[1] || `export_${new Date().toISOString().split('T')[0]}.${fallbackExt}`;

      // Create download link
      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [endpoint, params, format]);

  const buttonLabel = label || `Export ${format.toUpperCase()}`;

  return (
    <button
      onClick={handleExport}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition disabled:opacity-60 ${className}`}
      title={buttonLabel}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <HiOutlineDownload className="w-4 h-4" />
      )}
      <span>{loading ? 'Exporting…' : buttonLabel}</span>
    </button>
  );
};

export default ExportButton;
