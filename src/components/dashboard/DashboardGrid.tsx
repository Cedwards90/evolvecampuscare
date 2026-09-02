import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Platform-wide dashboard grid: 12 columns on desktop, single column on mobile.
 * Pages compose regions with <DashboardCol span={...}> instead of inventing
 * their own breakpoints and gaps.
 */
export function DashboardGrid({
  children,
  className,
  gap = 'md',
}: {
  children: ReactNode;
  className?: string;
  gap?: 'sm' | 'md';
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 lg:grid-cols-12',
        gap === 'sm' ? 'gap-4' : 'gap-6',
        className
      )}
    >
      {children}
    </div>
  );
}

type Span = 3 | 4 | 6 | 8 | 9 | 12;

const spanClasses: Record<Span, string> = {
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  6: 'lg:col-span-6',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  12: 'lg:col-span-12',
};

export function DashboardCol({
  span = 12,
  children,
  className,
}: {
  span?: Span;
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('min-w-0', spanClasses[span], className)}>{children}</div>;
}
