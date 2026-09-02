import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type AttentionTone = 'critical' | 'warning' | 'info';
export type AttentionKind = 'emergency' | 'overdue' | 'sync' | 'required';

export interface AttentionItem {
  id: string;
  kind?: AttentionKind;
  tone?: AttentionTone;
  label: string;
  detail?: string;
  count?: number;
  href?: string;
  cta?: string;
  onAction?: () => void;
}

const toneClasses: Record<AttentionTone, string> = {
  critical: 'border-destructive/40 bg-destructive/5',
  warning: 'border-warning/40 bg-warning/5',
  info: 'border-border bg-muted/40',
};

const toneText: Record<AttentionTone, string> = {
  critical: 'text-destructive',
  warning: 'text-warning',
  info: 'text-muted-foreground',
};

const kindIcon: Record<AttentionKind, typeof AlertTriangle> = {
  emergency: AlertTriangle,
  overdue: Clock,
  sync: RefreshCw,
  required: ShieldAlert,
};

/**
 * Full-width attention strip that sits directly under the page header.
 * Renders nothing when there is nothing to escalate, so calm days stay calm.
 */
export function AttentionPanel({
  items,
  className,
}: {
  items: AttentionItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {items.map((item) => {
        const tone = item.tone ?? 'warning';
        const Icon = kindIcon[item.kind ?? 'required'];
        return (
          <div
            key={item.id}
            className={cn(
              'flex min-w-0 items-start justify-between gap-3 rounded-lg border p-3',
              toneClasses[tone]
            )}
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <Icon className={cn('mt-0.5 h-4 w-4 flex-shrink-0', toneText[tone])} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium [overflow-wrap:anywhere]">
                  {typeof item.count === 'number' && (
                    <span className={cn('mr-1 font-semibold', toneText[tone])}>{item.count}</span>
                  )}
                  {item.label}
                </p>
                {item.detail && (
                  <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{item.detail}</p>
                )}
              </div>
            </div>
            {(item.href || item.onAction) && (
              <Button
                size="sm"
                variant={tone === 'critical' ? 'destructive' : 'outline'}
                className="flex-shrink-0"
                asChild={Boolean(item.href)}
                onClick={item.href ? undefined : item.onAction}
              >
                {item.href ? (
                  <Link to={item.href}>{item.cta ?? 'Review'}</Link>
                ) : (
                  <span>{item.cta ?? 'Review'}</span>
                )}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
