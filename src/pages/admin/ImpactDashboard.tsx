import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import {
  Activity,
  Award,
  DollarSign,
  Download,
  HeartHandshake,
  TrendingUp,
  Users,
  Target,
  Sparkles,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useImpactAnalytics,
  defaultImpactRange,
  type ImpactFilters,
} from '@/hooks/useImpactAnalytics';
import { useTrainingOrganizations } from '@/hooks/useTrainingOrganizations';
import { useAuth } from '@/contexts/AuthContext';
import { FilterMultiSelect } from '@/components/filters/FilterMultiSelect';
import { PageNav } from '@/components/navigation/PageNav';
import { DataCoverageCard } from '@/components/impact/DataCoverageCard';
import { CostSettingsEditor } from '@/components/impact/CostSettingsEditor';
import { OutcomesEditor } from '@/components/impact/OutcomesEditor';

const CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const PCT = (n: number) => `${n}%`;

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: any;
  accent?: 'primary' | 'success' | 'warning';
}) {
  const color =
    accent === 'success'
      ? 'text-success'
      : accent === 'warning'
        ? 'text-warning'
        : 'text-primary';
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          {label}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint && (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      )}
    </Card>
  );
}

function downloadCsv(rows: string[][], filename: string) {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '\ufeff' + rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ImpactDashboard() {
  const { role } = useAuth();
  const { data: orgs } = useTrainingOrganizations();
  const [filters, setFilters] = useState<ImpactFilters>(defaultImpactRange(90));
  const [rangePreset, setRangePreset] = useState<string>('90');

  const orgOptions = useMemo(
    () => (orgs || []).map((o: any) => ({ value: o.id, label: o.name })),
    [orgs],
  );

  const setRange = (days: string) => {
    setRangePreset(days);
    if (days === 'all') {
      setFilters((f) => ({
        ...f,
        from: '2020-01-01',
        to: format(new Date(), 'yyyy-MM-dd'),
      }));
    } else {
      const d = parseInt(days, 10);
      setFilters((f) => ({
        ...f,
        from: format(subDays(new Date(), d), 'yyyy-MM-dd'),
        to: format(new Date(), 'yyyy-MM-dd'),
      }));
    }
  };

  const { data, isLoading, error } = useImpactAnalytics(filters);

  const handleExport = () => {
    if (!data) return;
    const rows: string[][] = [
      ['Impact Analytics Report'],
      ['Generated', new Date().toISOString()],
      ['Range', filters.from, filters.to],
      ['Organizations', filters.organizationIds.length ? filters.organizationIds.join('|') : 'All'],
      [],
      ['INPUTS'],
      ['Total Program Cost', String(data.inputs.totalProgramCost)],
      ['Cost per Participant', String(data.inputs.costPerParticipant)],
      ['Active Students', String(data.inputs.activeStudents)],
      ['Active Staff', String(data.inputs.activeStaff)],
      [],
      ['ACTIVITIES'],
      ['Requests Opened', String(data.activities.requestsOpened)],
      ['Requests Resolved', String(data.activities.requestsResolved)],
      ['Meetings', String(data.activities.meetings)],
      ['Check-ins', String(data.activities.checkIns)],
      [],
      ['FUNNEL'],
      ['Stage', 'Count', '% of First'],
      ...data.activities.funnel.map((f) => [f.label, String(f.count), `${f.pctOfFirst}%`]),
      [],
      ['OUTPUTS'],
      ['Certifications Earned', String(data.outputs.certificationsEarned)],
      ['Post-Grad Plans', String(data.outputs.postGradPlans)],
      ['Records Transferred', String(data.outputs.recordsTransferred)],
      [],
      ['OUTCOMES'],
      ['Placed', String(data.outcomes.placed)],
      ['Placement Rate', `${data.outcomes.placementRate}%`],
      ['Avg Wage Lift ($/hr)', String(data.outcomes.avgWageLift)],
      ['Avg Time to Placement (days)', String(data.outcomes.avgTimeToPlacementDays ?? '')],
      ['Program Completed', String(data.outcomes.completed)],
      ['Completion Rate', `${data.outcomes.completionRate}%`],
      [],
      ['RETENTION'],
      ['Milestone (days)', 'Met', 'Eligible', '%'],
      ...data.outcomes.retention.map((r) => [r.milestone, String(r.met), String(r.eligible), `${r.pct}%`]),
      [],
      ['IMPACT'],
      ['SROI', data.impact.sroi != null ? `${data.impact.sroi}x` : 'n/a'],
      ['Annualized Wage Lift', String(data.impact.annualWageLift)],
      ['Public Benefit Offset', String(data.impact.publicBenefitOffset)],
      ['Total Return', String(data.impact.totalReturn)],
    ];
    downloadCsv(rows, `impact-report_${filters.from}_${filters.to}.csv`);
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageNav />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            title="Impact Analytics"
            description="Inputs → Activities → Outputs → Outcomes → Impact. Scoped to your access."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={rangePreset} onValueChange={setRange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="180">Last 180 days</SelectItem>
                <SelectItem value="365">Last 365 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            {role === 'admin' && orgOptions.length > 0 && (
              <FilterMultiSelect
                label="Organization"
                options={orgOptions}
                selected={filters.organizationIds}
                onChange={(vals) => setFilters((f) => ({ ...f, organizationIds: vals }))}
              />
            )}
            <Button onClick={handleExport} variant="outline" disabled={!data}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {isLoading && <LoadingSpinner />}
        {error && (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">
              Failed to load impact data: {(error as Error).message}
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            <DataCoverageCard coverage={data.coverage} />

            {/* ============== 0. INPUTS ENTRY ============== */}
            <section className="space-y-3">
              <SectionHeading
                step="0"
                title="Enter Inputs"
                blurb="Add the numbers that drive Impact: program cost, public benefit, placements, wages, and retention."
                icon={DollarSign}
              />
              <CostSettingsEditor
                costs={data.costSettings}
                orgOptions={orgOptions}
                isAdmin={role === 'admin'}
              />
              <OutcomesEditor studentIds={data.scope.studentIds} />
            </section>

            {/* ============== 1. INPUTS ============== */}
            <section className="space-y-3">
              <SectionHeading
                step="1"
                title="Inputs"
                blurb="What we invest: program funding and staff capacity."
                icon={DollarSign}
              />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total Program Cost"
                  value={CURRENCY.format(data.inputs.totalProgramCost)}
                  hint="Across cost periods in range"
                  icon={DollarSign}
                />
                <StatCard
                  label="Cost per Participant"
                  value={CURRENCY.format(data.inputs.costPerParticipant)}
                  hint={`${data.inputs.activeStudents} active`}
                  icon={Users}
                />
                <StatCard
                  label="Active Students"
                  value={String(data.inputs.activeStudents)}
                  icon={Users}
                />
                <StatCard
                  label="Active Staff"
                  value={String(data.inputs.activeStaff)}
                  hint="Case managers + org admins"
                  icon={HeartHandshake}
                />
              </div>
            </section>

            {/* ============== 2. ACTIVITIES ============== */}
            <section className="space-y-3">
              <SectionHeading
                step="2"
                title="Activities"
                blurb="What we did: requests handled, meetings, and the participant funnel."
                icon={Activity}
              />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Requests Opened"
                  value={String(data.activities.requestsOpened)}
                  icon={Activity}
                />
                <StatCard
                  label="Requests Resolved"
                  value={String(data.activities.requestsResolved)}
                  icon={Activity}
                  accent="success"
                />
                <StatCard
                  label="Meetings"
                  value={String(data.activities.meetings)}
                  icon={Users}
                />
                <StatCard
                  label="Check-ins"
                  value={String(data.activities.checkIns)}
                  icon={HeartHandshake}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Activity</CardTitle>
                    <CardDescription>Requests opened, resolved, and meetings.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[260px]">
                      <ResponsiveContainer>
                        <AreaChart data={data.activities.timeline}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis fontSize={11} tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 8,
                            }}
                          />
                          <Legend />
                          <Area dataKey="requests" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" />
                          <Area dataKey="resolved" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2)/0.2)" />
                          <Area dataKey="meetings" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3)/0.2)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Participant Funnel</CardTitle>
                    <CardDescription>
                      Conversion from QR scan → placement (% of first stage).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {data.activities.funnel.map((f, i) => (
                        <div key={f.stage}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{f.label}</span>
                            <span className="tabular-nums font-medium">
                              {f.count.toLocaleString()}{' '}
                              <span className="text-xs text-muted-foreground">
                                ({f.pctOfFirst}%)
                              </span>
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{
                                width: `${Math.max(2, f.pctOfFirst)}%`,
                                opacity: 1 - i * 0.07,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ============== 3. OUTPUTS ============== */}
            <section className="space-y-3">
              <SectionHeading
                step="3"
                title="Outputs"
                blurb="What we produced: credentials, plans, and handoffs."
                icon={Award}
              />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <StatCard
                  label="Certifications Earned"
                  value={String(data.outputs.certificationsEarned)}
                  icon={Award}
                  accent="success"
                />
                <StatCard
                  label="Post-Graduation Plans"
                  value={String(data.outputs.postGradPlans)}
                  icon={Target}
                />
                <StatCard
                  label="Records Transferred"
                  value={String(data.outputs.recordsTransferred)}
                  icon={Activity}
                />
              </div>
              {data.outputs.certsByCategory.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Certifications by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[220px]">
                      <ResponsiveContainer>
                        <BarChart data={data.outputs.certsByCategory} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis dataKey="name" type="category" fontSize={11} tickLine={false} axisLine={false} width={140} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 8,
                            }}
                          />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* ============== 4. OUTCOMES ============== */}
            <section className="space-y-3">
              <SectionHeading
                step="4"
                title="Outcomes"
                blurb="Placements, wage lift, and retention over time."
                icon={TrendingUp}
              />
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                  label="Placed"
                  value={String(data.outcomes.placed)}
                  icon={TrendingUp}
                  accent="success"
                />
                <StatCard
                  label="Placement Rate"
                  value={PCT(data.outcomes.placementRate)}
                  icon={TrendingUp}
                />
                <StatCard
                  label="Avg Wage Lift"
                  value={`+${CURRENCY.format(data.outcomes.avgWageLift)}/hr`}
                  icon={DollarSign}
                  accent="success"
                />
                <StatCard
                  label="Avg Time to Placement"
                  value={
                    data.outcomes.avgTimeToPlacementDays != null
                      ? `${data.outcomes.avgTimeToPlacementDays}d`
                      : '—'
                  }
                  icon={Activity}
                />
                <StatCard
                  label="Completion Rate"
                  value={PCT(data.outcomes.completionRate)}
                  hint={`${data.outcomes.completed} completed`}
                  icon={Award}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Retention Curve</CardTitle>
                  <CardDescription>
                    % of eligible placed participants still retained at each milestone.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    <ResponsiveContainer>
                      <LineChart
                        data={data.outcomes.retention.map((r) => ({
                          milestone: `${r.milestone}d`,
                          pct: r.pct,
                          met: r.met,
                          eligible: r.eligible,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="milestone" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                          }}
                          formatter={(v: any, _n: any, p: any) => [
                            `${v}% (${p.payload.met}/${p.payload.eligible})`,
                            'Retention',
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="pct"
                          stroke="hsl(var(--primary))"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* ============== 5. IMPACT ============== */}
            <section className="space-y-3">
              <SectionHeading
                step="5"
                title="Impact"
                blurb="Social return on investment and equity of outcomes."
                icon={Sparkles}
              />
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <Card className="lg:col-span-2 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <CardHeader>
                    <CardDescription className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Social Return on Investment
                    </CardDescription>
                    <CardTitle className="text-4xl tabular-nums">
                      {data.impact.sroi != null ? `${data.impact.sroi}x` : '—'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      For every $1 invested, the program returns approximately {data.impact.sroi ?? '—'}
                      {data.impact.sroi != null ? ' dollars' : ''} in wage lift + public benefit offsets.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Annual wage lift</div>
                        <div className="font-medium tabular-nums">
                          {CURRENCY.format(data.impact.annualWageLift)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Public benefit offset</div>
                        <div className="font-medium tabular-nums">
                          {CURRENCY.format(data.impact.publicBenefitOffset)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <StatCard
                  label="Total Return"
                  value={CURRENCY.format(data.impact.totalReturn)}
                  icon={TrendingUp}
                  accent="success"
                />
                <StatCard
                  label="Program Cost"
                  value={CURRENCY.format(data.inputs.totalProgramCost)}
                  icon={DollarSign}
                />
              </div>

              {data.impact.equity.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Equity — Placement Rate by Demographic</CardTitle>
                    <CardDescription>
                      Compare placement outcomes across groups. Look for parity gaps.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {data.impact.equity.map((dim) => (
                        <div key={dim.dimension}>
                          <h4 className="text-sm font-medium mb-3">{dim.dimension}</h4>
                          <div className="space-y-2">
                            {dim.groups.map((g) => (
                              <div key={g.label}>
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span>
                                    {g.label}{' '}
                                    <span className="text-muted-foreground">(n={g.n})</span>
                                  </span>
                                  <span className="font-medium tabular-nums">{g.placementRate}%</span>
                                </div>
                                <Progress value={g.placementRate} className="h-2" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>

            <div className="text-center text-xs text-muted-foreground py-4">
              Powered by Evolve Foundation • {format(new Date(), 'PP')}
            </div>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}

function SectionHeading({
  step,
  title,
  blurb,
  icon: Icon,
}: {
  step: string;
  title: string;
  blurb: string;
  icon: any;
}) {
  return (
    <div className="flex items-start gap-3 pt-2">
      <Badge variant="outline" className="rounded-full px-3 py-1 mt-0.5">
        Step {step}
      </Badge>
      <div className="flex-1">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{blurb}</p>
      </div>
    </div>
  );
}
