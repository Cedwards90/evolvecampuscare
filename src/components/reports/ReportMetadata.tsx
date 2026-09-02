/**
 * Provenance strip shown on every analytics and report surface.
 *
 * Answers, without the user having to ask: what filters produced this, what
 * date range and timezone, when was it generated, how many rows are behind it,
 * and whose access scope limited it.
 */

import { Clock, Database, Filter, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReportMetadataProps {
  /** Human-readable date range, e.g. "Aug 3 – Sep 2, 2026". */
  rangeLabel: string;
  /** ISO timestamp of when the data was fetched. */
  generatedAt: string;
  /** Number of underlying rows the figures were computed from. */
  rowCount?: number;
  /** True when a cap was hit and the view is not the full population. */
  truncated?: boolean;
  /** Description of the viewer's access scope, e.g. "Your assigned students". */
  accessScope: string;
  /** Active filter chips, e.g. ["Org: Evolve", "Cohort: Spring 2026"]. */
  activeFilters?: string[];
  className?: string;
}

function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';
  } catch {
    return 'local time';
  }
}

export function ReportMetadata({
  rangeLabel,
  generatedAt,
  rowCount,
  truncated,
  accessScope,
  activeFilters = [],
  className,
}: ReportMetadataProps) {
  const tz = localTimezone();
  const generated = new Date(generatedAt);
  const generatedLabel = Number.isNaN(generated.getTime())
    ? generatedAt
    : generated.toLocaleString();

  return (
    <div
      className={cn(
        'rounded-2xl border bg-muted/30 p-3 text-xs text-muted-foreground',
        className,
      )}
    >
      <dl className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <dt className="sr-only">Date range</dt>
          <dd className="min-w-0 break-words">
            {rangeLabel} <span className="opacity-70">({tz})</span>
          </dd>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <Database className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <dt className="sr-only">Data volume</dt>
          <dd className="min-w-0 break-words">
            {typeof rowCount === 'number' ? `${rowCount.toLocaleString()} records` : 'Record count unavailable'}
            {truncated && (
              <span className="ml-1 font-medium text-amber-600 dark:text-amber-400">
                — capped, not the full population
              </span>
            )}
          </dd>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <dt className="sr-only">Access scope</dt>
          <dd className="min-w-0 break-words">{accessScope}</dd>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <dt className="sr-only">Generated</dt>
          <dd className="min-w-0 break-words">Generated {generatedLabel}</dd>
        </div>
      </dl>

      {activeFilters.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2">
          <Filter className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span className="sr-only">Active filters</span>
          {activeFilters.map((f) => (
            <span
              key={f}
              className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-foreground"
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Plain-text version for PDF/CSV export headers so exports match the screen. */
export function reportMetadataLines(meta: Omit<ReportMetadataProps, 'className'>): string[] {
  const lines = [
    `Date range: ${meta.rangeLabel} (${localTimezone()})`,
    `Generated: ${new Date(meta.generatedAt).toLocaleString()}`,
    `Access scope: ${meta.accessScope}`,
  ];
  if (typeof meta.rowCount === 'number') {
    lines.push(`Records included: ${meta.rowCount.toLocaleString()}${meta.truncated ? ' (capped — not the full population)' : ''}`);
  }
  if (meta.activeFilters && meta.activeFilters.length > 0) {
    lines.push(`Active filters: ${meta.activeFilters.join('; ')}`);
  }
  return lines;
}
