import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  FileText,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Calendar,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { ReportMetadata } from '@/components/reports/ReportMetadata';
import { MetricValue, MetricDefinitionPopover } from '@/components/reports/MetricValue';
import { ChartDataTable } from '@/components/reports/ChartDataTable';
import { getMetricDefinition } from '@/lib/metricDefinitions';
import { formatCurrency } from '@/lib/utils';

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<number>(30);
  const { filters } = useGlobalFilters();
  const { data, isLoading, error } = useAnalyticsData(dateRange, filters);


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
        <div className="text-center py-12">
          <p className="text-muted-foreground">Failed to load analytics data</p>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title="Workload Analytics"
            description="Monitor case manager performance and student support trends"
          />
          <Select value={dateRange.toString()} onValueChange={(v) => setDateRange(Number(v))}>
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <GlobalFilterBar visible={['cohort', 'yearOfStudy', 'organizationId', 'assignedCaseManagerId']} />

        <ReportMetadata
          rangeLabel={data.meta.rangeLabel}
          generatedAt={data.meta.generatedAt}
          rowCount={data.meta.rowCount}
          truncated={data.meta.truncated}
          accessScope="Limited to records your role and organization permit"
          activeFilters={data.meta.appliedFilterLabels}
        />

        {/* Summary Stats — each figure carries its own definition */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Students in Scope
              </CardDescription>
              <CardTitle className="text-3xl">
                <MetricValue
                  metricKey="total_students"
                  value={data.summary.totalStudents}
                  rangeLabel={data.meta.rangeLabel}
                  asOf={new Date(data.meta.generatedAt).toLocaleString()}
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Distinct students with a case manager assignment
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Requests Created
              </CardDescription>
              <CardTitle className="text-3xl">
                <MetricValue
                  metricKey="total_requests"
                  value={data.summary.totalRequests}
                  rangeLabel={data.meta.rangeLabel}
                  asOf={new Date(data.meta.generatedAt).toLocaleString()}
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                In the last {dateRange} days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Avg Time to Resolve
              </CardDescription>
              <CardTitle className="text-3xl">
                <MetricValue
                  metricKey="avg_resolution_hours"
                  value={data.summary.avgResolutionTime}
                  rangeLabel={data.meta.rangeLabel}
                  asOf={new Date(data.meta.generatedAt).toLocaleString()}
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Resolved requests only — open requests are excluded
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Resolution Rate
              </CardDescription>
              <CardTitle className="text-3xl">
                <MetricValue
                  metricKey="resolution_rate"
                  value={data.summary.resolutionRate}
                  rangeLabel={data.meta.rangeLabel}
                  asOf={new Date(data.meta.generatedAt).toLocaleString()}
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.summary.resolutionRate == null ? (
                <p className="text-sm text-muted-foreground">
                  No eligible requests in this range
                </p>
              ) : (
                <Progress value={data.summary.resolutionRate} className="h-2" />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              Funds Dispersed
            </CardDescription>
            <CardTitle className="text-3xl">
              <MetricValue
                metricKey="financial_dispersed"
                value={data.summary.fundsDispersed}
                rangeLabel={data.meta.rangeLabel}
                asOf={new Date(data.meta.generatedAt).toLocaleString()}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Approved amounts on financial requests created in this range. Requested-but-unapproved
              amounts are not counted.
            </p>
          </CardContent>
        </Card>


        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Workload Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Request Volume Trends
              </CardTitle>
              <CardDescription>
                Daily request submissions and resolutions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.workloadTrends}>
                    <defs>
                      <linearGradient id="requestGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="resolvedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      fontSize={12} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      fontSize={12} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="requestCount"
                      name="Requests"
                      stroke="hsl(var(--primary))"
                      fill="url(#requestGradient)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="resolvedCount"
                      name="Resolved"
                      stroke="hsl(var(--chart-2))"
                      fill="url(#resolvedGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Resolution Time by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Resolution Time by Category
              </CardTitle>
              <CardDescription>
                Average hours to resolve by request type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.resolutionByCategory} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis 
                      dataKey="category" 
                      type="category" 
                      fontSize={12} 
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`${value} hours`, 'Avg Resolution']}
                    />
                    <Bar 
                      dataKey="avgHours" 
                      fill="hsl(var(--primary))" 
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Student Count Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Student Assignment Growth
            </CardTitle>
            <CardDescription>
              Total assigned students over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.workloadTrends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="studentCount"
                    name="Assigned Students"
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Case Manager Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Case Manager Performance</CardTitle>
            <CardDescription>
              Workload and resolution metrics by case manager
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.caseManagerMetrics.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No case managers found
              </p>
            ) : (
              <div className="space-y-4">
                {data.caseManagerMetrics.map((cm) => (
                  <div 
                    key={cm.id}
                    className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(cm.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <Link 
                        to={`/case-managers/${cm.id}`}
                        className="font-medium hover:underline"
                      >
                        {cm.name}
                      </Link>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <Badge variant="outline" className="gap-1">
                          <Users className="h-3 w-3" />
                          {cm.activeStudents} students
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <FileText className="h-3 w-3" />
                          {cm.activeRequests} active
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm">
                        {cm.avgResolutionHours <= 24 ? (
                          <TrendingDown className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="font-medium">{cm.avgResolutionHours}h</span>
                      </div>
                      <p className="text-xs text-muted-foreground">avg resolution</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{cm.resolvedThisMonth}</p>
                      <p className="text-xs text-muted-foreground">resolved this month</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
