import { useMemo, useState } from "react";
import { useImpactMetrics, type ImpactScope } from "@/hooks/useImpactMetrics";
import { KpiTile, FundingGoalRow } from "./KpiTile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, FileText, RefreshCw } from "lucide-react";
import { exportImpactCsv } from "@/lib/impactCsv";
import { downloadDonorReportPdf } from "@/lib/impactReportPdf";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  fixedScope?: Partial<ImpactScope>;
  showFilters?: boolean;
  showExports?: boolean;
}

export function ImpactDashboard({ fixedScope = {}, showFilters = true, showExports = true }: Props) {
  const today = new Date();
  const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), 1);
  const [dateFrom, setDateFrom] = useState(lastYear.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today.toISOString().slice(0, 10));

  const scope: ImpactScope = useMemo(
    () => ({ ...fixedScope, date_from: dateFrom, date_to: dateTo }),
    [fixedScope, dateFrom, dateTo],
  );

  const { data: metrics, isLoading, error, refetch, isFetching } = useImpactMetrics(scope);

  const logExport = async (format: "pdf" | "csv") => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("impact_report_audit").insert({
      actor_id: u.user.id,
      scope: scope as any,
      format,
    });
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }
  if (!metrics) return null;

  const pg = metrics.participant_growth;

  return (
    <div className="space-y-6">
      {showFilters && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-4 p-4">
            <div className="space-y-1">
              <Label htmlFor="date-from">From</Label>
              <Input id="date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="date-to">To</Label>
              <Input id="date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="rounded-full">
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {showExports && (
              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    exportImpactCsv(metrics);
                    logExport("csv");
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    downloadDonorReportPdf({ metrics });
                    logExport("pdf");
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  PDF Report
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Participant growth */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Participant Growth</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <KpiTile title="Participants" value={pg.total_participants} />
          <KpiTile title="Certifications earned" value={pg.certifications_earned} hint={`${pg.certifications_in_range} in range`} />
          <KpiTile title="Job placements" value={pg.job_placements} hint={`${pg.placements_in_range} in range`} />
          <KpiTile title="Wage growth" value={`${pg.wage_growth_pct}%`} hint={`$${pg.avg_baseline_wage} → $${pg.avg_current_wage}`} />
          <KpiTile title="Completion rate" value={`${pg.completion_rate_pct}%`} hint={`${pg.program_completed} completed`} />
          <KpiTile title="Attendance rate" value={`${pg.attendance_rate_pct}%`} hint={`${pg.appointments_attended}/${pg.appointments_total}`} />
          <KpiTile title="Engagement" value={pg.avg_check_ins_per_participant} hint="check-ins / participant" />
          <KpiTile title="Resolution time" value={`${pg.avg_resolution_hours}h`} hint={`${pg.support_requests_resolved}/${pg.support_requests_total} resolved`} />
        </div>
      </div>

      {/* Retention curve */}
      <Card>
        <CardHeader>
          <CardTitle>Retention Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            {(["d30", "d60", "d90", "d180", "d365"] as const).map((k) => (
              <KpiTile key={k} title={`${k.slice(1)} days`} value={pg.retention[k]} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Funding goals */}
      {metrics.funding_goals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Funding Goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.funding_goals.map((g: any) => (
              <FundingGoalRow
                key={g.id}
                title={g.title}
                current={g.current_value}
                target={Number(g.target_value)}
                period={`${g.period_start} → ${g.period_end} • ${g.metric_key}`}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Social impact */}
      <Card>
        <CardHeader>
          <CardTitle>Social Impact Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(metrics.social_impact.surveys).map(([slug, s]) => (
              <KpiTile
                key={slug}
                title={s.title}
                value={s.suppressed ? "—" : s.avg_score !== null ? `${Math.round(s.avg_score)}/100` : "—"}
                hint={`${s.response_count} responses${s.suppressed ? " • n<5 suppressed" : ""}`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trends */}
      {metrics.trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                placements: { label: "Placements", color: "hsl(var(--primary))" },
                certifications: { label: "Certifications", color: "hsl(150 30% 55%)" },
                requests_resolved: { label: "Requests resolved", color: "hsl(35 80% 55%)" },
              }}
              className="h-64 w-full"
            >
              <ResponsiveContainer>
                <LineChart data={metrics.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line type="monotone" dataKey="placements" stroke="var(--color-placements)" />
                  <Line type="monotone" dataKey="certifications" stroke="var(--color-certifications)" />
                  <Line type="monotone" dataKey="requests_resolved" stroke="var(--color-requests_resolved)" />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Demographics */}
      {metrics.demographic_breakdown && (
        <Card>
          <CardHeader>
            <CardTitle>Demographic Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(metrics.demographic_breakdown).map(([cat, buckets]) => {
              const rows = Object.entries(buckets).filter(([, c]) => c > 0);
              if (rows.length === 0) {
                return (
                  <p key={cat} className="text-sm text-muted-foreground">
                    <span className="font-medium capitalize">{cat.replace(/_/g, " ")}: </span>
                    No buckets ≥ 5 participants.
                  </p>
                );
              }
              return (
                <div key={cat}>
                  <p className="mb-2 text-sm font-medium capitalize">{cat.replace(/_/g, " ")}</p>
                  <div className="grid gap-2 md:grid-cols-3">
                    {rows.map(([k, c]) => (
                      <div key={k} className="rounded-md border border-border/60 p-2 text-sm">
                        <span className="font-medium">{k}</span>
                        <span className="ml-2 text-muted-foreground">{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Buckets with fewer than 5 participants are suppressed to protect privacy.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
