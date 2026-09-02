/**
 * A KPI rendered with its definition attached.
 *
 * Two rules are enforced here so no surface can break them:
 *  1. A metric whose definition says `derivable: false` never shows a number.
 *  2. Every metric exposes numerator, denominator, population, window, and
 *     exclusions through the info affordance.
 */

import { HelpCircle, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatCurrency } from '@/lib/utils';
import { getMetricDefinition, type MetricDefinition } from '@/lib/metricDefinitions';
import { cn } from '@/lib/utils';

interface MetricValueProps {
  metricKey: string;
  value: number | null | undefined;
  /** Range label such as "Last 30 days (Aug 3 – Sep 2)". */
  rangeLabel?: string;
  /** When the underlying data was read. */
  asOf?: string;
  className?: string;
}

function formatValue(def: MetricDefinition, value: number): string {
  switch (def.unit) {
    case 'percent':
      return `${Math.round(value)}%`;
    case 'hours':
      return `${Math.round(value * 10) / 10}h`;
    case 'currency':
      return formatCurrency(value);
    default:
      return value.toLocaleString();
  }
}

export function MetricValue({ metricKey, value, rangeLabel, asOf, className }: MetricValueProps) {
  const def = getMetricDefinition(metricKey);

  if (!def) {
    return <span className={className}>{value?.toLocaleString() ?? '—'}</span>;
  }

  const unavailable = !def.derivable || value == null || Number.isNaN(value);

  return (
    <span className={cn('inline-flex items-baseline gap-1.5', className)}>
      {unavailable ? (
        <span className="text-base font-medium text-muted-foreground">Not enough data</span>
      ) : (
        <span>{formatValue(def, value)}</span>
      )}
      <MetricDefinitionPopover def={def} rangeLabel={rangeLabel} asOf={asOf} />
    </span>
  );
}

export function MetricDefinitionPopover({
  def,
  rangeLabel,
  asOf,
}: {
  def: MetricDefinition;
  rangeLabel?: string;
  asOf?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`How ${def.label} is calculated`}
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] text-xs">
        <div className="space-y-2">
          <p className="text-sm font-semibold">{def.label}</p>
          <p className="text-muted-foreground">{def.summary}</p>

          {!def.derivable && def.notDerivableReason && (
            <div className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-2 text-amber-700 dark:text-amber-400">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span>{def.notDerivableReason}</span>
            </div>
          )}

          <dl className="space-y-1.5 border-t pt-2">
            <DefRow term="Numerator" value={def.numerator} />
            <DefRow term="Denominator" value={def.denominator} />
            <DefRow term="Population" value={def.population} />
            <DefRow term="Time window" value={rangeLabel ? `${def.timeWindow} — ${rangeLabel}` : def.timeWindow} />
            {asOf && <DefRow term="Last refreshed" value={asOf} />}
          </dl>

          {def.exclusions.length > 0 && (
            <div className="border-t pt-2">
              <p className="font-medium">Excluded</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                {def.exclusions.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DefRow({ term, value }: { term: string; value: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
      <dt className="font-medium text-muted-foreground">{term}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}
