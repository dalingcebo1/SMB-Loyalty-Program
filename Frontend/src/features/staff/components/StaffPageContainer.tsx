// src/features/staff/components/StaffPageContainer.tsx
import React from 'react';

const surfaceMap = {
  solid: 'bg-white/95 border border-slate-200 shadow-lg shadow-slate-900/10 rounded-3xl',
  glass: 'bg-white/70 backdrop-blur-md border border-white/40 shadow-xl shadow-slate-900/10 rounded-3xl',
  neutral: 'bg-slate-900/80 border border-slate-700/40 text-slate-50 shadow-2xl rounded-3xl',
  plain: ''
} as const;

type SurfaceKey = keyof typeof surfaceMap;

type WidthKey = 'md' | 'lg' | 'xl' | 'wide' | 'full';

const widthMap: Record<WidthKey, string> = {
  md: 'max-w-4xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
  wide: 'max-w-7xl',
  full: 'max-w-none'
};

interface StaffPageContainerProps {
  children: React.ReactNode;
  className?: string;
  surface?: SurfaceKey;
  width?: WidthKey;
  padding?: 'none' | 'compact' | 'default' | 'relaxed';
  as?: keyof JSX.IntrinsicElements;
}

const paddingMap = {
  none: '',
  compact: 'px-4 py-4 sm:px-6 sm:py-5',
  default: 'px-5 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10',
  relaxed: 'px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12'
} as const;

const join = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const StaffPageContainer: React.FC<StaffPageContainerProps> = ({
  children,
  className = '',
  surface = 'solid',
  width = 'xl',
  padding = 'default',
  as: Component = 'section'
}) => {
  const widthClass = widthMap[width] ?? widthMap.xl;
  const surfaceClass = surfaceMap[surface] ?? surfaceMap.solid;
  const paddingClass = paddingMap[padding] ?? paddingMap.default;

  return (
    <Component className={join('w-full mx-auto', widthClass, surfaceClass, paddingClass, className)}>
      {children}
    </Component>
  );
};

export default StaffPageContainer;
