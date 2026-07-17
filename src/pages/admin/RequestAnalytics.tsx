import { useState } from 'react';
import { Calendar, Download, FileDown, BarChart3, Activity, AlertTriangle, DollarSign, RefreshCw, Users } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  BarChart, Bar, LineChart, Line,
} from 'recharts';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';
import { useRequestAnalytics } from '@/hooks/useRequestAnalytics';
import {
  exportRequestAnalyticsCsv,
  exportRequestAnalyticsPdf,
  exportRequestAnalyticsRowsCsv,
} from '@/lib/requestAnalyticsExport';

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function RequestAnalytics() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useRequestAnalytics(days);

  if (isLoading) {
    return (
      <SidebarLayout>
        <LoadingSpinner />
      </SidebarLayout>
    );
  }
  if (error || !data) {
    return (
      <SidebarLayout>
        <div className="text-center py-12 text-muted-foreground">Failed to load request analytics.</div>
      </SidebarLayout>
    );
  }

  const empty = data.rows.length === 0;

  return (
    <SidebarLayout>
      <div className="space-y-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-wrap">
          <PageHeader
            title="Request Analytics"
            description="Structured analytics for support requests across your programs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-40 rounded-full">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="180">Last 180 days</SelectItem>
                <SelectItem value="365">Last 365 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={empty}
              onClick={() => exportRequestAnalyticsCsv(data, days)}
            >
              <Download className="h-4 w-4 mr-2" /> CSV Summary
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={empty}
              onClick={() => exportRequestAnalyticsRowsCsv(data)}
            >
              <Download className="h-4 w-4 mr-2" /> CSV Rows
            </Button>
            <Button
              size="sm"
              className="rounded-full"
              disabled={empty}
              onClick={() => exportRequestAnalyticsPdf(data, days)}
            >
              <FileDown className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </div>

        <GlobalFilterBar visible={['organizationId', 'program', 'cohort', 'yearOfStudy', 'assignedCaseManagerId', 'studentStatus', 'status']} />

        {empty ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No requests match the current filters and date range.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard label="Total" value={data.summary.total} icon={<BarChart3 className="h-4 w-4" />} />
              <SummaryCard label="Open" value={data.summary.open} icon={<Activity className="h-4 w-4" />} />
              <SummaryCard label="Resolved" value={data.summary.resolved} icon={<RefreshCw className="h-4 w-4" />} />
              <SummaryCard label="Emergency" value={data.summary.emergency} icon={<AlertTriangle className="h-4 w-4" />} />
              <SummaryCard label="Avg resolution" value={`${data.summary.avgResolutionHours}h`} />
              <SummaryCard label="Median resolution" value={`${data.summary.medianResolutionHours}h`} />
              <SummaryCard label="Repeat requesters" value={`${data.summary.repeatRequesterRate}%`} icon={<Users className="h-4 w-4" />} />
              <SummaryCard label="Financial approved" value={money(data.summary.financialApproved)} icon={<DollarSign className="h-4 w-4" />} />
            </div>

            {/* Volume trend */}
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Volume & Trends</CardTitle>
                <CardDescription>New requests vs resolutions per day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.volume}>
                      <defs>
                        <linearGradient id="ra-total" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="ra-resolved" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Legend />
                      <Area type="monotone" dataKey="total" name="New" stroke="hsl(var(--primary))" fill="url(#ra-total)" strokeWidth={2} />
                      <Area type="monotone" dataKey="resolved" name="Resolved" stroke="hsl(var(--chart-2))" fill="url(#ra-resolved)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Most common needs */}
              <Card className="min-w-0">
                <CardHeader>
                  <CardTitle>Most Common Needs</CardTitle>
                  <CardDescription>Volume by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byCategory} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis dataKey="category" type="category" fontSize={11} tickLine={false} axisLine={false} width={110} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Priority mix */}
              <Card className="min-w-0">
                <CardHeader>
                  <CardTitle>Priority Mix</CardTitle>
                  <CardDescription>Requests by priority level</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byPriority}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="priority" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                        <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Resolution by category */}
              <Card className="min-w-0">
                <CardHeader>
                  <CardTitle>Resolution Time by Category</CardTitle>
                  <CardDescription>Average hours to resolve</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byCategory} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis dataKey="category" type="category" fontSize={11} tickLine={false} axisLine={false} width={110} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                          formatter={(v: number) => [`${v} h`, 'Avg resolution']}
                        />
                        <Bar dataKey="avgHours" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Backlog age */}
              <Card className="min-w-0">
                <CardHeader>
                  <CardTitle>Unresolved Backlog</CardTitle>
                  <CardDescription>Age of open requests</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.backlogAge}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="bucket" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                        <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Financial */}
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Financial Assistance</CardTitle>
                <CardDescription>
                  Requested {money(data.summary.financialRequested)} · Approved {money(data.summary.financialApproved)} · Pending {money(data.summary.financialPending)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {data.financialByOrg.length > 0 && (
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.financialByOrg.slice(0, 12)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="organization" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => money(v)} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                          formatter={(v: number) => money(v)}
                        />
                        <Legend />
                        <Bar dataKey="requested" name="Requested" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="approved" name="Approved" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="pending" name="Pending" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {data.financialByCategory.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Requested</TableHead>
                          <TableHead className="text-right">Approved</TableHead>
                          <TableHead className="text-right">Pending</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.financialByCategory.map((f) => (
                          <TableRow key={f.category}>
                            <TableCell>{f.category}</TableCell>
                            <TableCell className="text-right">{money(f.requested)}</TableCell>
                            <TableCell className="text-right">{money(f.approved)}</TableCell>
                            <TableCell className="text-right">{money(f.pending)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Repeat requesters */}
            {data.repeat.length > 0 && (
              <Card className="min-w-0">
                <CardHeader>
                  <CardTitle>Repeat Requesters</CardTitle>
                  <CardDescription>Students with more than one request in this range</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {data.repeat.map((r) => (
                      <Badge key={r.studentId} variant="secondary" className="rounded-full gap-2">
                        <span>{r.studentName}</span>
                        <span className="text-xs opacity-80">×{r.count}</span>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Case manager performance */}
            {data.byCaseManager.length > 0 && (
              <Card className="min-w-0">
                <CardHeader>
                  <CardTitle>Case Manager Performance</CardTitle>
                  <CardDescription>Across the current filter and date range</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Case Manager</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Open</TableHead>
                          <TableHead className="text-right">Resolved</TableHead>
                          <TableHead className="text-right">Avg hours</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.byCaseManager.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>{c.name}</TableCell>
                            <TableCell className="text-right">{c.total}</TableCell>
                            <TableCell className="text-right">{c.open}</TableCell>
                            <TableCell className="text-right">{c.resolved}</TableCell>
                            <TableCell className="text-right">{c.avgHours}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Breakdown pivot */}
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Breakdown</CardTitle>
                <CardDescription>Organization · Cohort · Case manager · Category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead>Cohort</TableHead>
                        <TableHead>Case Manager</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Resolved</TableHead>
                        <TableHead className="text-right">Resolved %</TableHead>
                        <TableHead className="text-right">Avg h</TableHead>
                        <TableHead className="text-right">Approved $</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.breakdown.slice(0, 200).map((b) => (
                        <TableRow key={b.key}>
                          <TableCell>{b.organization}</TableCell>
                          <TableCell>{b.cohort}</TableCell>
                          <TableCell>{b.caseManager}</TableCell>
                          <TableCell>{b.category}</TableCell>
                          <TableCell className="text-right">{b.total}</TableCell>
                          <TableCell className="text-right">{b.resolved}</TableCell>
                          <TableCell className="text-right">{b.resolvedPct}%</TableCell>
                          <TableCell className="text-right">{b.avgHours}</TableCell>
                          <TableCell className="text-right">{money(b.approved)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {data.breakdown.length > 200 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing first 200 rows. Export CSV for the full breakdown.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2 text-xs">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
