import { BackButton } from './BackButton';
import { PageBreadcrumbs, type Crumb } from './PageBreadcrumbs';
import { cn } from '@/lib/utils';

interface PageNavProps {
  fallback?: string;
  backLabel?: string;
  crumbs?: Crumb[];
  className?: string;
}

/**
 * Standard nested-page header strip: a back button + optional breadcrumbs.
 * Place above <PageHeader />.
 */
export function PageNav({ fallback, backLabel, crumbs, className }: PageNavProps) {
  return (
    <div className={cn('flex items-center gap-3 mb-4', className)}>
      <BackButton fallback={fallback} label={backLabel} />
      {crumbs && crumbs.length > 0 && (
        <div className="hidden sm:flex min-w-0">
          <PageBreadcrumbs items={crumbs} />
        </div>
      )}
    </div>
  );
}
