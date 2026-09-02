import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryItem {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: string;
  href?: string;
}

interface SummaryCardProps {
  title: string;
  totalValue: number;
  totalLabel: string;
  /** Trend percentage with an explicit comparison period. */
  trendValue?: number;
  trendIsPositive?: boolean;
  trendComparisonLabel?: string;
  items: SummaryItem[];
  headerHref?: string;
  /** Contextual footer action, e.g. { label: 'View requests', href: '/requests' }. */
  footerHref?: string;
  footerLabel?: string;
  className?: string;
}

/**
 * A breakdown card: one headline number plus its parts. No decorative
 * gradients, no non-functional icons — every affordance navigates somewhere.
 */
export function SummaryCard({
  title,
  totalValue,
  totalLabel,
  trendValue,
  trendIsPositive = true,
  trendComparisonLabel,
  items,
  headerHref,
  footerHref,
  footerLabel = 'View all',
  className,
}: SummaryCardProps) {
  const headline = (
    <div className="min-w-0">
      <p className="font-display text-3xl font-bold tracking-tight">{totalValue.toLocaleString()}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{totalLabel}</p>
      {trendValue !== undefined && (
        <p className={cn('mt-1 text-xs', trendIsPositive ? 'text-success' : 'text-destructive')}>
          {trendIsPositive ? (
            <TrendingUp className="mr-1 inline h-3 w-3" aria-hidden="true" />
          ) : (
            <TrendingDown className="mr-1 inline h-3 w-3" aria-hidden="true" />
          )}
          {trendIsPositive ? '+' : ''}
          {trendValue}%{trendComparisonLabel ? ` ${trendComparisonLabel}` : ''}
        </p>
      )}
    </div>
  );

  return (
    <Card className={cn('flex h-full flex-col border-border/60 shadow-sm', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 p-0">
        <div className="px-6">
          {headerHref ? (
            <Link to={headerHref} className="block rounded-md transition-opacity hover:opacity-80">
              {headline}
            </Link>
          ) : (
            headline
          )}
        </div>

        <div className="divide-y divide-border border-t border-border">
          {items.map((item, index) => {
            const itemContent = (
              <>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                </div>
                <span className="text-sm font-semibold">{item.value}</span>
                {item.href && (
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
              </>
            );

            return item.href ? (
              <Link
                key={index}
                to={item.href}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
              >
                {itemContent}
              </Link>
            ) : (
              <div key={index} className="flex items-center gap-3 px-5 py-3">
                {itemContent}
              </div>
            );
          })}
        </div>

        {footerHref && (
          <div className="mt-auto border-t border-border p-3">
            <Button variant="ghost" className="w-full text-sm font-medium" asChild>
              <Link to={footerHref}>
                {footerLabel}
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
