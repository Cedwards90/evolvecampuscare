import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DashboardSectionProps {
  title: string;
  description?: string;
  /** Optional item count rendered beside the title. */
  count?: number;
  /** Optional "View all" destination. */
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Render a collapse control. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Extra controls rendered on the right of the header. */
  actions?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}

function Header({
  title,
  description,
  count,
}: Pick<DashboardSectionProps, 'title' | 'description' | 'count'>) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
        {typeof count === 'number' && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

/**
 * One shared section header for every dashboard: title, optional description,
 * count, "View all" link and collapse control. Keeps long pages scannable.
 */
export function DashboardSection({
  title,
  description,
  count,
  viewAllHref,
  viewAllLabel = 'View all',
  collapsible = false,
  defaultOpen = true,
  actions,
  id,
  className,
  children,
}: DashboardSectionProps) {
  const right = (
    <div className="flex flex-shrink-0 items-center gap-2">
      {actions}
      {viewAllHref && (
        <Button variant="outline" size="sm" asChild>
          <Link to={viewAllHref}>
            {viewAllLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );

  if (!collapsible) {
    return (
      <section id={id} className={cn('space-y-4', className)}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <Header title={title} description={description} count={count} />
          {right}
        </div>
        {children}
      </section>
    );
  }

  return (
    <Collapsible defaultOpen={defaultOpen} asChild>
      <section id={id} className={cn('space-y-4', className)}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <CollapsibleTrigger className="group flex min-w-0 flex-1 items-start gap-2 text-left">
            <Header title={title} description={description} count={count} />
            <ChevronDown className="mt-1 h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          {right}
        </div>
        <CollapsibleContent className="space-y-4 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          {children}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
