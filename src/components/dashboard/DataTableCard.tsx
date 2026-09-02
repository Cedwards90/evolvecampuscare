import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Shared table container so every dashboard table has the same chrome:
 * title, optional toolbar/export slot, horizontal scroll containment.
 */
export function DataTableCard({
  title,
  description,
  toolbar,
  footer,
  children,
  className,
}: {
  title?: string;
  description?: string;
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('min-w-0 border-border/60 shadow-sm', className)}>
      {(title || toolbar) && (
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <CardTitle className="text-base">{title}</CardTitle>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {toolbar && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{toolbar}</div>}
        </CardHeader>
      )}
      <CardContent className="min-w-0 p-0">
        <div className="w-full max-w-full overflow-x-auto">{children}</div>
      </CardContent>
      {footer && <div className="border-t border-border p-3">{footer}</div>}
    </Card>
  );
}
