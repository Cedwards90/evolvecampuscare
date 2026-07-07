import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LifeSkillsProgressResult } from '@/hooks/useLifeSkillsProgress';

interface Props {
  data: LifeSkillsProgressResult | undefined;
  title?: string;
  description?: string;
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return <Badge variant="outline" className="rounded-full">No data</Badge>;
  if (Math.abs(delta) < 0.05) {
    return (
      <Badge variant="secondary" className="rounded-full gap-1">
        <Minus className="h-3 w-3" /> {delta.toFixed(2)}
      </Badge>
    );
  }
  if (delta > 0) {
    return (
      <Badge className="rounded-full gap-1 bg-emerald-600 hover:bg-emerald-600">
        <TrendingUp className="h-3 w-3" /> +{delta.toFixed(2)}
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="rounded-full gap-1">
      <TrendingDown className="h-3 w-3" /> {delta.toFixed(2)}
    </Badge>
  );
}

/**
 * Skills map — labels the deterministic Life Skills modules with the
 * user's requested skill vocabulary alongside the module title. Only
 * skills backed by real survey data are shown here; other requested
 * skills are covered by the derived-signals block in ImpactMetricsBlock.
 */
const SKILL_LABELS: Record<string, string> = {
  m01: 'Confidence & resilience',
  m02: 'Communication',
  m03: 'Systems navigation',
  m04: 'Financial literacy',
  m05: 'Career readiness',
  m06: 'Digital literacy',
  m07: 'AI literacy',
};

export function LifeSkillsProgressBlock({
  data,
  title = 'Life Skills progress',
  description = 'Pre vs post confidence (1–5) per module. Only students with real responses in scope are counted; empty modules show as "No data".',
}: Props) {
  const hasAny = data?.hasAnyData;
  const chartData = (data?.modules ?? []).map((m) => ({
    name: `M${String(m.module.number).padStart(2, '0')}`,
    pre: m.preAvg != null ? Number(m.preAvg.toFixed(2)) : 0,
    post: m.postAvg != null ? Number(m.postAvg.toFixed(2)) : 0,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {data?.finalNps.avg != null && (
            <Badge variant="secondary" className="rounded-full">
              Final NPS {data.finalNps.avg.toFixed(1)} (n={data.finalNps.n})
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAny ? (
          <p className="text-sm text-muted-foreground">
            No Life Skills survey responses on file for this scope.
          </p>
        ) : (
          <>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="pre" name="Pre" fill="hsl(var(--muted-foreground))" />
                  <Bar dataKey="post" name="Post" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid gap-2">
              {data!.modules.map((m) => (
                <div
                  key={m.module.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      M{String(m.module.number).padStart(2, '0')} · {m.module.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {SKILL_LABELS[m.module.id] || m.module.title} · pre n={m.preN} · post n={m.postN}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="text-muted-foreground">
                      {m.preAvg != null ? m.preAvg.toFixed(2) : '—'} → {m.postAvg != null ? m.postAvg.toFixed(2) : '—'}
                    </span>
                    <DeltaBadge delta={m.delta} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
