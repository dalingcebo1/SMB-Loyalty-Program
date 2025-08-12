import React from 'react';
import { classNames } from '../../utils/classNames';

export interface AnalyticsSectionProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  layout?: 'single' | 'two-col' | 'three-col';
  minHeight?: number;
  padded?: boolean;
  loading?: boolean;
  skeletonRows?: number;
  children: React.ReactNode;
}

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  title,
  subtitle,
  actions,
  layout = 'single',
  minHeight = 340,
  padded = true,
  loading = false,
  skeletonRows = 6,
  children,
}) => {
  const getGridCols = () => {
    if (layout === 'two-col') return 'lg:grid-cols-2';
    if (layout === 'three-col') return 'xl:grid-cols-3 lg:grid-cols-2';
    return '';
  };
  const gridClasses = classNames(
    'grid gap-6',
    getGridCols(),
    'auto-rows-fr'
  );

  return (
    <section
      aria-labelledby={`${title.replace(/\s+/g, '-')}-heading`}
      className="relative rounded-xl border border-gray-200 bg-white shadow-sm"
      style={{ minHeight }}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <div>
          <h2
            id={`${title.replace(/\s+/g, '-')}-heading`}
            className="text-lg font-semibold tracking-tight text-gray-900"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </header>
      <div className={classNames(padded ? 'px-6 py-5' : '', layout !== 'single' ? gridClasses : '')}>
        {loading ? (
          <SkeletonGrid layout={layout} rows={skeletonRows} />
        ) : (
          children
        )}
      </div>
    </section>
  );
};

interface SkeletonGridProps {
  layout: string;
  rows: number;
}
const SkeletonGrid: React.FC<SkeletonGridProps> = ({ layout, rows }) => {
  if (layout === 'single') {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-40 rounded bg-gray-200" />
        <div className="h-60 rounded bg-gradient-to-br from-gray-100 to-gray-200" />
      </div>
    );
  }
  return (
    <div className="animate-pulse grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-56 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200"
        />
      ))}
    </div>
  );
};

export const ChartPlaceholder: React.FC<{ label?: string }> = ({ label = 'Chart coming soon' }) => (
  <div className="flex h-full flex-col rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-xs text-gray-500">
    <div className="mx-auto mb-3 mt-6 h-24 w-40 rounded bg-gray-200" />
    <p className="font-medium tracking-wide text-gray-600">
      {label}
    </p>
  </div>
);

export default AnalyticsSection;
