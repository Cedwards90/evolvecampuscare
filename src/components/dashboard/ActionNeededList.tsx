import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ActionSeverity = 'urgent' | 'due' | 'info';

export interface ActionItem {
  id: string;
  title: string;
  description?: string;
  href: string;
  cta: string;
  severity?: ActionSeverity;
}

interface ActionNeededListProps {
  items: ActionItem[];
  /** Shown when there is nothing to act on. */
  emptyTitle?: string;
  emptyDescription?: string;
  onExtraAction?: React.ReactNode;
}

const severityStyles: Record<ActionSeverity, string> = {
  urgent: 'border-l-destructive',
  due: 'border-l-primary',
  info: 'border-l-border',
};

const severityIcon: Record<ActionSeverity, typeof Info> = {
  urgent: AlertTriangle,
  due: Info,
  info: Info,
};

/**
 * Consolidated "what needs my attention" list. Replaces stacked banner cards so
 * the first viewport communicates urgency and next steps in one place.
 */
export function ActionNeededList({
  items,
  emptyTitle = "You're all caught up",
  emptyDescription = 'Nothing needs your attention right now.',
  onExtraAction,
}: ActionNeededListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="text-base">
          Needs your attention
          {items.length > 0 && (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {items.length}
            </span>
          )}
        </CardTitle>
        {onExtraAction}
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{emptyTitle}</p>
              <p className="text-xs text-muted-foreground">{emptyDescription}</p>
            </div>
          </div>
        ) : (
          items.map((item) => {
            const severity = item.severity ?? 'info';
            const Icon = severityIcon[severity];
            return (
              <div
                key={item.id}
                className={cn(
                  'flex flex-col gap-2 rounded-lg border border-l-4 border-border/50 bg-card p-3 sm:flex-row sm:items-center sm:justify-between',
                  severityStyles[severity]
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Icon
                    className={cn(
                      'mt-0.5 h-4 w-4 flex-shrink-0',
                      severity === 'urgent' ? 'text-destructive' : 'text-primary'
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{item.description}</p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={severity === 'urgent' ? 'destructive' : 'default'}
                  asChild
                  className="sm:flex-shrink-0"
                >
                  <Link to={item.href}>{item.cta}</Link>
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
