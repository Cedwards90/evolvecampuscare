import { useState } from 'react';
import { Loader2, StickyNote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCaseNotesSummary } from '@/hooks/useCaseNotesSummary';
import { DrillDownDialog, type DrillDownPayload } from '@/components/reports/DrillDownDialog';

interface Props {
  authorId?: string;
  studentIds?: string[];
  from: Date;
  to: Date;
  /** Show the "By case manager" grouping (org report only). */
  showByAuthor?: boolean;
  enabled?: boolean;
}

function Tile({
  label,
  value,
  sub,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`w-full min-w-0 rounded-2xl border border-border/60 bg-card p-4 text-left transition ${
        clickable ? 'hover:border-primary/60 hover:shadow-sm cursor-pointer' : 'cursor-default'
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-display font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </button>
  );
}

export function CaseNotesSummaryBlock({
  authorId,
  studentIds,
  from,
  to,
  showByAuthor = false,
  enabled = true,
}: Props) {
  const { data, isLoading, isFetching } = useCaseNotesSummary({
    authorId,
    studentIds,
    from,
    to,
    enabled,
  });

  const [drill, setDrill] = useState<DrillDownPayload | null>(null);

  const openNotes = (title: string, rows: any[]) =>
    setDrill({ kind: 'notes', title, rows });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          Case notes summary
        </CardTitle>
        {(isLoading || isFetching) && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!data || data.total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No case notes recorded in this range.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Tile
                label="Notes in range"
                value={data.total}
                onClick={() => openNotes('All case notes', data.rows)}
              />
              <Tile
                label="Contact time (min)"
                value={data.totalMinutes}
                sub="sum of logged durations"
              />
              <Tile label="Categories" value={data.byCategory.length} />
              <Tile
                label={showByAuthor ? 'Case managers' : 'Students touched'}
                value={showByAuthor ? data.byAuthor.length : data.byStudent.length}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-1 text-xs font-medium text-muted-foreground">By category</div>
                <ul className="space-y-1">
                  {data.byCategory.map((g) => (
                    <li key={g.key}>
                      <button
                        type="button"
                        onClick={() => openNotes(`Notes — ${g.label}`, g.rows)}
                        className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm hover:border-primary/60 hover:bg-accent/40"
                      >
                        <span className="flex items-center gap-2">
                          <Badge variant="outline">{g.label}</Badge>
                          {g.totalMinutes > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {g.totalMinutes} min
                            </span>
                          )}
                        </span>
                        <span className="font-medium">{g.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="min-w-0">
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  {showByAuthor ? 'By case manager' : 'By student'}
                </div>
                <ul className="space-y-1">
                  {(showByAuthor ? data.byAuthor : data.byStudent).slice(0, 10).map((g) => (
                    <li key={g.key}>
                      <button
                        type="button"
                        onClick={() => openNotes(`Notes — ${g.label}`, g.rows)}
                        className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm hover:border-primary/60 hover:bg-accent/40"
                      >
                        <span className="truncate">{g.label}</span>
                        <span className="font-medium">{g.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {(showByAuthor ? data.byAuthor : data.byStudent).length > 10 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Showing top 10 of {(showByAuthor ? data.byAuthor : data.byStudent).length}.
                  </p>
                )}
              </div>
            </div>

            {data.byContactType.length > 0 && (
              <div className="min-w-0">
                <div className="mb-1 text-xs font-medium text-muted-foreground">By contact type</div>
                <div className="flex flex-wrap gap-2">
                  {data.byContactType.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => openNotes(`Notes — ${g.label}`, g.rows)}
                      className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs hover:border-primary/60"
                    >
                      <span>{g.label}</span>
                      <span className="font-medium">{g.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      <DrillDownDialog
        open={!!drill}
        onOpenChange={(o) => !o && setDrill(null)}
        payload={drill}
      />
    </Card>
  );
}
