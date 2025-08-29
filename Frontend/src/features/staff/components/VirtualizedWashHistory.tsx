import React, { memo, useCallback, useRef, useLayoutEffect, useState } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { Wash } from '../../../types';

interface VirtualizedWashHistoryProps {
  washes: Wash[];
  itemHeight?: number;
  maxHeight?: number;
  className?: string;
}

// Row renderer (pure)
const Row = memo(({ index, style, data }: ListChildComponentProps) => {
  const wash: Wash = data[index];
  return (
    <div style={style} className="border-b pb-2 px-2 flex flex-col justify-center">
      <div>
        <span className="font-semibold">{wash.user?.first_name} {wash.user?.last_name}</span>
        {wash.vehicle && (
          <>: {wash.vehicle.make} {wash.vehicle.model} {wash.vehicle.reg}</>
        )}
      </div>
      <div className="mt-1 text-sm"><span className="font-semibold">Type:</span> {wash.service_name || 'N/A'}</div>
      <div className="mt-1 text-sm"><span className="font-semibold">Started:</span> {wash.started_at}</div>
      <div className="mt-1 text-sm"><span className="font-semibold">Ended:</span> {wash.ended_at || '—'}</div>
      <div className="mt-1 text-sm">
        <span className={wash.status === 'started' ? 'text-blue-600' : 'text-green-600'}>
          {wash.status === 'started' ? 'In Progress' : 'Completed'}
        </span>
      </div>
    </div>
  );
});

Row.displayName = 'VirtualizedWashHistoryRow';

const VirtualizedWashHistory: React.FC<VirtualizedWashHistoryProps> = ({ washes, itemHeight = 120, maxHeight = 600, className }) => {
  const itemData = washes;
  const itemCount = washes.length;
  const itemKey = useCallback((index: number, data: Wash[]) => data[index].order_id, []);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<{width: number; height: number}>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const resize = () => {
      const width = el.clientWidth;
      const desiredHeight = Math.min(maxHeight, itemCount * itemHeight);
      setDimensions({ width, height: desiredHeight });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [itemCount, itemHeight, maxHeight]);

  return (
    <div ref={containerRef} className={className} style={{ height: dimensions.height }}>
      {dimensions.width > 0 && (
        <List
          height={dimensions.height}
          width={dimensions.width}
          itemCount={itemCount}
          itemSize={itemHeight}
          itemData={itemData}
          itemKey={(index) => itemKey(index, itemData)}
          overscanCount={5}
        >
          {Row}
        </List>
      )}
    </div>
  );
};

export default memo(VirtualizedWashHistory);
