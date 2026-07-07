import { useMemo, useState } from 'react';
import { Download, FileText, Loader2, Users, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { PageNav } from '@/components/navigation/PageNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';
import { ReportRangePicker } from '@/components/reports/ReportRangePicker';
import { LifeSkillsProgressBlock } from '@/components/reports/LifeSkillsProgressBlock';
import { ImpactMetricsBlock } from '@/components/reports/ImpactMetricsBlock';
import { useReportStudentFilters } from '@/hooks/useReportStudentFilters';
import { useOrganizationReport } from '@/hooks/useOrganizationReport';
import { getPresetRange, type ReportPreset } from '@/hooks/useInteractionReport';
import { exportOrgReportCsv, exportOrgReportPdf } from '@/lib/orgReportExport';
import { toast } from '@/hooks/use-toast';
import type { RiskSeverity } from '@/lib/studentProgressRules';

function severityVariant(s: RiskSeverity): 'destructive' | 'default' | 'secondary' {
  if (s === 'high') return 'destructive';
  if (s === 'medium') return 'default';
  return 'secondary';
}

export default function OrganizationReport() {
  const [preset, setPreset] = useState<ReportPreset>('weekly');
  const initial = useMemo(() => getPresetRange('weekly'), []);
  const [from, setFrom] = useState<Date>(initial.from);
  const [to, setTo] = useState<Date>(initial.to);

  const { filteredStudents, matchingCount, totalCount, isLoading: filterLoading } =
    useReportStudentFilters();

  const studentIds = useMemo(
    () => filteredStudents.map((a) => a.student_id).filter(Boolean) as string[],
    [filteredStudents],
  );
  const studentNameById = useMemo(() => {
    const map: Record<string, string | null> = {};
    filteredStudents.forEach((a) => {
      map[a.student_id] = a.student?.full_name || a.student?.email || null;
    });
    return map;
  }, [filteredStudents]);

  const scopeLabel = `${matchingCount} of ${totalCount} student${totalCount === 1 ? '' : 's'} in scope`;

  const { data, isLoading, isFetching, error, refetch } = useOrganizationReport({
    studentIds,
    studentNameById,
    from,
    to,
    scopeLabel,
    enabled: !filterLoading,
  });

  const handleExportPdf = () => {
    if (!data) return;
    try {
      exportOrgReportPdf(data);
    } catch (e) {
      toast({ title: 'PDF export failed', description: (e as Error).message, variant: 'destructive' });
    }
  };
  const handleExportCsv = () => {
    if (!data) return;
    try {
      exportOrgReportCsv(data);
    } catch (e) {
      toast({ title: 'CSV export failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const exportsDisabled = !data || isLoading;

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageNav
          fallback="/reports"
          crumbs={[
            { label: 'Reports', to: '/reports' },
            { label: 'Organization Report' },
          ]}
        />
        <PageHeader
          title="Organization Report"
          description="Roll-up of Life Skills progress and expanded impact metrics across the students currently in your filtered scope. All values come from real records — empty sections show as 'No data on file'."
        />

        <Tabs value="organization" className="space-y-4">
          <TabsList>
            <TabsTrigger value="caseload" asChild>
              <Link to="/reports" className="gap-2">
                <Users className="h-4 w-4" /> Caseload
              </Link>
            </TabsTrigger>
            <TabsTrigger value="per-student" asChild>
              <Link to="/reports/student" className="gap-2">
                <FileText className="h-4 w-4" /> Per student
              </Link>
            </TabsTrigger>
            <TabsTrigger value="organization" className="gap-2">
              <Users className="h-4 w-4" /> Organization
              <ArrowRight className="h-3 w-3 opacity-60" />
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <GlobalFilterBar
          visible={['organizationId', 'program', 'cohort', 'yearOfStudy', 'assignedCaseManagerId', 'studentStatus']}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report options</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <ReportRangePicker
              preset={preset}
              from={from}
              to={to}
              onChange={({ preset: p, from: f, to: t }) => {
                setPreset(p);
                setFrom(f);
                setTo(t);
              }}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{scopeLabel}</span>
              <Button variant="outline" onClick={() => refetch()}>
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
              </Button>
              <Button variant="outline" onClick={handleExportCsv} disabled={exportsDisabled}>
                <FileText className="mr-2 h-4 w-4" /> CSV
              </Button>
              <Button onClick={handleExportPdf} disabled={exportsDisabled}>
                <Download className="mr-2 h-4 w-4" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not load report</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading organization report…
          </div>
        )}

        {data && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Students in scope" value={data.summary.studentCount} />
                <Stat label="Requests opened" value={data.summary.requestsOpened} />
                <Stat label="Requests resolved" value={data.summary.requestsResolved} />
                <Stat label="Unresolved" value={data.summary.unresolvedCount} />
                <Stat label="Open emergencies" value={data.summary.emergencyOpen} />
                <Stat label="Avg resolution (hrs)" value={data.summary.avgResolutionHours} />
                <Stat
                  label="Attendance rate"
                  value={data.summary.attendanceRate == null ? '—' : `${Math.round(data.summary.attendanceRate * 100)}%`}
                />
                <Stat
                  label="Surveys (sent / done)"
                  value={`${data.summary.surveysSent} / ${data.summary.surveysCompleted}`}
                />
              </CardContent>
            </Card>

            <LifeSkillsProgressBlock
              data={data.lifeSkills}
              title="Life Skills — organization average"
              description="Pre vs post confidence (1–5) aggregated across students in the current scope."
            />

            <ImpactMetricsBlock metrics={data.impactMetrics} />

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Trends, risk areas & next steps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.risks.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    No org-level risks detected from current data.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {data.risks.map((r) => (
                      <li key={r.key} className="rounded-lg border border-border/60 p-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={severityVariant(r.severity)} className="rounded-full">
                            {r.severity}
                          </Badge>
                          <span className="font-medium">{r.label}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{r.detail}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div>
                  <h4 className="mt-2 text-sm font-medium">Recommended next steps</h4>
                  <ul className="mt-1 space-y-2">
                    {data.actionItems.map((a) => (
                      <li key={a.key} className="flex items-start gap-2 rounded-lg border border-border/60 p-3 text-sm">
                        <Badge variant={severityVariant(a.severity)} className="rounded-full">
                          {a.severity}
                        </Badge>
                        <span>{a.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top unresolved requests</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topUnresolved.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No unresolved requests in scope. 🎉</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {data.topUnresolved.map((u) => (
                      <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3">
                        <div className="min-w-0">
                          <div className="font-medium">
                            {u.is_emergency && (
                              <Badge variant="destructive" className="mr-2 rounded-full">Emergency</Badge>
                            )}
                            {u.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {u.student_name || 'Unknown student'} · {u.ageDays}d old
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{u.priority}</Badge>
                          <Badge>{u.status}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <p className="text-[11px] text-muted-foreground">
              Deterministic report. AI narrative is available on the per-student report where evidence is scoped to one student.
            </p>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-display font-semibold">{value}</div>
    </div>
  );
}
