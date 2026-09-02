import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Primary/secondary page actions. Rendered on the right at desktop widths. */
  actions?: ReactNode;
  /** Filter controls, rendered on their own row beneath the title. */
  filters?: ReactNode;
  /** Freshness/scope metadata, rendered beneath the filters row. */
  meta?: ReactNode;
  /** Legacy slot, equivalent to `actions`. */
  children?: ReactNode;
  className?: string;
}

/**
 * The one page header used across the platform: title, short description,
 * primary action, optional filters and metadata rows.
 */
export function PageHeader({
  title,
  description,
  actions,
  filters,
  meta,
  children,
  className,
}: PageHeaderProps) {
  const right = actions ?? children;

  return (
    <div className={cn('min-w-0 space-y-4', className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-h1 text-foreground [overflow-wrap:anywhere]">{title}</h1>
          {description && <p className="mt-1 text-muted-foreground">{description}</p>}
        </div>
        {right && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{right}</div>}
      </div>
      {filters && <div className="min-w-0">{filters}</div>}
      {meta && <div className="min-w-0">{meta}</div>}
    </div>
  );
}
