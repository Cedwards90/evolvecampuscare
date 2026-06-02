import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ClipboardList } from 'lucide-react';
import type { CoverageRow } from '@/hooks/useImpactAnalytics';

export function DataCoverageCard({ coverage }: { coverage: CoverageRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="h-5 w-5 text-primary" />
          Data Coverage — what's already on file
        </CardTitle>
        <CardDescription>
          A snapshot of how much of the data needed to compute impact has been entered for students in the current scope.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {coverage.map((row) => (
            <div key={row.key}>
              <div className="flex items-baseline justify-between text-sm mb-1">
                <span className="font-medium">{row.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {row.entered}
                  {row.total !== row.entered ? <> / {row.total}</> : null}
                  {row.total > 0 && row.entered !== row.total ? (
                    <span className="ml-1 text-xs">({row.pct}%)</span>
                  ) : null}
                </span>
              </div>
              <Progress value={row.pct} className="h-1.5" />
              {row.hint && (
                <p className="mt-1 text-xs text-muted-foreground">{row.hint}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
