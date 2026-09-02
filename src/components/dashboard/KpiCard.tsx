import { Link } from 'react-router-dom';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { MetricValue } from '@/components/reports/MetricValue';
import { cn } from '@/lib/utils';

export interface KpiCardProps {
  label: string;
  /** Raw value. Rendered through MetricValue when metricKey is provided. */
  value: number | string | null | undefined;
  /** Metric definition key so the KPI carries its own definition and honesty rules. */
  metricKey?: string;
  /** Range label such as "Last 30 days". */
  rangeLabel?: string;
  asOf?: string;
  /** Single supporting line. One message per card. */
  helper?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'urgent';
  /** Trend direction with an explicit comparison period. */
  trend?: { value: number; isPositive: boolean; comparisonLabel: string };
  /** Contextual action, e.g. { label: 'View requests', href: '/requests' }. */
  action?: { label: string; href: string };
  className?: string;
}

/**
 * One KPI, one message, one fixed height. Replaces the gradient/decorative
 * stat cards so metric rows read as a single consistent band.
 */
export function KpiCard({
  label,
  value,
  metricKey,
  rangeLabel,
  asOf,
  helper,
  icon: Icon,
  tone = 'default',
  trend,
  action,
  className,
}: KpiCardProps) {
  return (
    <Card
      className={cn(
        'flex h-full min-h-[9.5rem] flex-col border-border/60 shadow-sm transition-shadow hover:shadow-md',
        tone === 'urgent' && 'border-destructive/40',
        className
      )}
    >
      <CardContent className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm font-medium text-muted-foreground [overflow-wrap:anywhere]">
            {label}
          </p>
          {Icon && (
            <Icon
              className={cn(
                'h-4 w-4 flex-shrink-0',
                tone === 'urgent' ? 'text-destructive' : 'text-muted-foreground'
              )}
              aria-hidden="true"
            />
          )}
        </div>

        <div
          className={cn(
            'font-display text-2xl font-bold',
            tone === 'urgent' && 'text-destructive'
          )}
        >
          {metricKey ? (
            <MetricValue
              metricKey={metricKey}
              value={typeof value === 'number' ? value : null}
              rangeLabel={rangeLabel}
              asOf={asOf}
            />
          ) : (
            <span>{value ?? '—'}</span>
          )}
        </div>

        {trend && (
          <p
            className={cn(
              'text-xs',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}
          >
            {trend.isPositive ? (
              <TrendingUp className="mr-1 inline h-3 w-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="mr-1 inline h-3 w-3" aria-hidden="true" />
            )}
            {trend.isPositive ? '+' : ''}
            {trend.value}% {trend.comparisonLabel}
          </p>
        )}

        {helper && !trend && (
          <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{helper}</p>
        )}

        {action && (
          <Link
            to={action.href}
            className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {action.label}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
