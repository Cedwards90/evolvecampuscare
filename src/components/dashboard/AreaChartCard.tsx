import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DataPoint {
  name: string;
  value: number;
}

interface AreaChartCardProps {
  title: string;
  data: DataPoint[];
  /** Short line saying what the chart measures. */
  description?: string;
  /** Explicit comparison period, e.g. "Jan–Dec 2026". */
  comparisonLabel?: string;
  /** One-sentence textual summary so the chart is readable without seeing it. */
  summary?: string;
  /** Link to the underlying records. */
  href?: string;
  linkLabel?: string;
  emptyMessage?: string;
  height?: number;
  gradientId?: string;
  className?: string;
}

/**
 * A quiet single-series chart: one token color, no legend, explicit comparison
 * period, textual summary, and a link to the records behind it.
 */
export function AreaChartCard({
  title,
  data,
  description,
  comparisonLabel,
  summary,
  href,
  linkLabel = 'View records',
  emptyMessage = 'No activity in this period yet.',
  height = 260,
  gradientId = 'areaChartValue',
  className,
}: AreaChartCardProps) {
  const hasData = data.some((d) => d.value > 0);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {comparisonLabel && (
            <span className="flex-shrink-0 text-xs text-muted-foreground">{comparisonLabel}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {hasData ? (
          <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={36}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={`url(#${gradientId})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div
            className="flex items-center justify-center rounded-lg border border-dashed border-border/70 text-sm text-muted-foreground"
            style={{ height }}
          >
            {emptyMessage}
          </div>
        )}

        {(summary || href) && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {summary && <p className="min-w-0 text-xs text-muted-foreground">{summary}</p>}
            {href && (
              <Link
                to={href}
                className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {linkLabel}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
