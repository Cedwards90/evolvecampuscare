import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Empty state that always offers a next action, so an empty section reads as
 * "nothing here yet, do this" rather than as a broken card.
 */
export function SectionEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <Card className={cn('border-dashed border-border/70 p-8 text-center', className)}>
      {Icon && <Icon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" aria-hidden="true" />}
      <p className="font-medium text-foreground">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <Button size="sm" className="mt-4" asChild>
          <Link to={action.href}>
            {action.label}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )}
    </Card>
  );
}
