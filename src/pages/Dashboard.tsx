import { useAuth } from '@/contexts/AuthContext';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { FractionStatsCard } from '@/components/dashboard/FractionStatsCard';
import { PercentageStatsCard } from '@/components/dashboard/PercentageStatsCard';
import { AreaChartCard } from '@/components/dashboard/AreaChartCard';
import { SparklineCard } from '@/components/dashboard/SparklineCard';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { StatsSummaryBar } from '@/components/dashboard/StatsSummaryBar';
import { RequestCard } from '@/components/RequestCard';
import { AIBadge } from '@/components/AIBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Plus,
  ArrowRight,
  Users,
  BarChart3,
  TrendingUp,
  AlertCircle,
  Star,
  Briefcase,
  Calendar,
  DollarSign,
  Target
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { mockRequests, mockCaseManagers, mockAIInsights, getDashboardStats, mockAnalytics } from '@/lib/mock-data';

// Generate chart data from analytics
const generateChartData = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map((name, index) => ({
    name,
    value: Math.floor(Math.random() * 50000) + 20000,
  }));
};

const chartData = generateChartData();

// Sparkline data
const sparklineData1 = [12, 19, 3, 5, 2, 3, 15, 20, 25, 22, 30, 28];
const sparklineData2 = [5, 10, 15, 8, 12, 18, 20, 25, 22, 28, 32, 35];
const sparklineData3 = [20, 15, 25, 22, 18, 30, 28, 35, 32, 40, 38, 45];

export default function Dashboard() {
  const { role, user, profile } = useAuth();
  
  // Get stats based on role
  const stats = getDashboardStats(role || 'student', user?.id);
  
  // Filter requests based on role
  const recentRequests = role === 'student'
    ? mockRequests.filter(r => r.student_id === 'student-user-1').slice(0, 3)
    : role === 'case_manager'
    ? mockRequests.filter(r => r.assigned_case_manager_id === 'cm-user-1').slice(0, 5)
    : mockRequests.slice(0, 5);

  // Get relevant AI insights for case managers
  const insights = mockAIInsights.filter(i => i.case_manager_id === 'cm-user-1').slice(0, 2);

  // Summary items for the side card
  const summaryItems = [
    {
      icon: <FileText className="h-4 w-4 text-primary" />,
      title: 'Academic Advising',
      subtitle: 'Support',
      value: '$1200',
    },
    {
      icon: <Users className="h-4 w-4 text-primary" />,
      title: 'Mental Health',
      subtitle: 'Counseling',
      value: '$1450',
    },
    {
      icon: <Briefcase className="h-4 w-4 text-primary" />,
      title: 'Financial Aid',
      subtitle: 'Assistance',
      value: '$1250',
    },
  ];

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Header with Breadcrumb */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {role === 'student' 
                ? "Here's an overview of your support requests"
                : role === 'case_manager'
                ? "Here's your current caseload overview"
                : "System overview and monitoring"
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Jan 1 - Dec 31, 2026
            </Button>
            <Button variant="outline" size="sm">
              Filter
            </Button>
          </div>
        </div>

        {/* Stats Grid - Fraction Style */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FractionStatsCard
            title="Total Requests"
            current={stats.totalRequests}
            total={stats.totalRequests + 10}
            icon={DollarSign}
            color="blue"
          />
          <FractionStatsCard
            title="In Progress"
            current={stats.pendingRequests}
            total={stats.totalRequests}
            icon={Target}
            color="green"
          />
          <FractionStatsCard
            title="Resolved"
            current={stats.resolvedRequests}
            total={stats.totalRequests}
            icon={CheckCircle}
            color="green"
          />
          <PercentageStatsCard
            title="Resolution Rate"
            percentage={stats.totalRequests > 0 ? (stats.resolvedRequests / stats.totalRequests) * 100 : 0}
            subtitle="Resolution Rate"
            trend={{ value: 46, isPositive: true }}
            icon={TrendingUp}
            progressColor="gradient"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Area Chart - Takes 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            <AreaChartCard
              title="Request Activity"
              data={chartData}
              className="border border-border/50 shadow-sm"
            />

            {/* Summary Bar */}
            <StatsSummaryBar
              items={[
                { label: 'Pending', value: stats.pendingRequests, color: 'blue' },
                { label: 'Resolved', value: stats.resolvedRequests, color: 'green' },
                { label: 'Escalated', value: stats.escalatedRequests, color: 'orange' },
                { label: 'Emergency', value: stats.emergencyRequests, color: 'red' },
              ]}
            />
          </div>

          {/* Summary Card - Takes 1 column */}
          <SummaryCard
            title="Request Summary"
            totalValue={30569}
            totalLabel="Total Resolved"
            trendValue={12}
            items={summaryItems}
          />
        </div>

        {/* Sparkline Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SparklineCard
            title="Tasks Completed"
            subtitle={`${stats.resolvedRequests}/35 completed`}
            current={stats.resolvedRequests}
            total={35}
            data={sparklineData1}
            trend={{ value: 28, isPositive: true }}
            icon={Star}
            color="blue"
          />
          <SparklineCard
            title="New Requests"
            subtitle="0/20 tasks"
            current={5}
            total={20}
            data={sparklineData2}
            trend={{ value: 34, isPositive: true }}
            icon={FileText}
            color="green"
          />
          <SparklineCard
            title="Cases Closed"
            subtitle="20/30 project"
            current={20}
            total={30}
            data={sparklineData3}
            trend={{ value: 42, isPositive: true }}
            icon={CheckCircle}
            color="red"
          />
        </div>

        {/* Role-specific content */}
        {role === 'student' && (
          <>
            {/* Quick Actions */}
            <section className="space-y-4">
              <h2 className="font-display text-lg font-semibold">Quick Actions</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="border border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
                  <Link to="/student-submitting-a-support-request">
                    <CardContent className="flex items-center gap-4 p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <Plus className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold">Submit New Request</h3>
                        <p className="text-sm text-muted-foreground">Get help with any issue</p>
                      </div>
                      <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Link>
                </Card>

                <Card className="border border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
                  <Link to="/student-tracking-request-status-scheduling-meeting">
                    <CardContent className="flex items-center gap-4 p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <Clock className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold">Track Requests</h3>
                        <p className="text-sm text-muted-foreground">View status & schedule</p>
                      </div>
                      <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Link>
                </Card>

                <Card className="border border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
                  <Link to="/student-creating-offline-draft-request">
                    <CardContent className="flex items-center gap-4 p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold">Offline Drafts</h3>
                        <p className="text-sm text-muted-foreground">Save requests offline</p>
                      </div>
                      <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Link>
                </Card>
              </div>
            </section>

            {/* Recent Requests */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Recent Requests</h2>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/student-tracking-request-status-scheduling-meeting">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-4">
                {recentRequests.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            </section>
          </>
        )}

        {role === 'case_manager' && (
          <>
            {/* AI Insights */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-semibold">AI Insights</h2>
                <AIBadge />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {insights.map((insight) => (
                  <Card key={insight.id} className="border border-border/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        {insight.insight_type === 'alert' && (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        )}
                        {insight.insight_type === 'suggestion' && (
                          <TrendingUp className="h-5 w-5 text-primary" />
                        )}
                        {insight.insight_type === 'weekly_summary' && (
                          <BarChart3 className="h-5 w-5 text-primary" />
                        )}
                        <CardTitle className="text-base">
                          {(insight.content as any).title}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {(insight.content as any).message}
                      </p>
                      {(insight.content as any).action && (
                        <Button variant="outline" size="sm" className="mt-4">
                          {(insight.content as any).action}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Priority Queue */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Priority Queue</h2>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/case-manager-managing-student-requests">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-4">
                {recentRequests.filter(r => r.priority === 'emergency' || r.priority === 'high').map((request) => (
                  <RequestCard key={request.id} request={request} showStudent />
                ))}
              </div>
            </section>
          </>
        )}

        {role === 'admin' && (
          <>
            {/* Case Manager Workloads */}
            <section className="space-y-4">
              <h2 className="font-display text-lg font-semibold">Case Manager Workloads</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mockCaseManagers.slice(0, 3).map((cm) => (
                  <Card key={cm.id} className="border border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{cm.full_name}</CardTitle>
                      <CardDescription>{cm.email}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Active Requests</span>
                        <span className="font-semibold">{cm.active_requests}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-muted-foreground">Emergency Cases</span>
                        <span className="font-semibold text-destructive">{cm.emergency_requests}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-muted-foreground">Avg Response</span>
                        <span className="font-semibold">{cm.avg_response_time}h</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Escalated Requests */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Escalated & Unassigned</h2>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin-monitoring-reassigning-requests">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-4">
                {mockRequests.filter(r => r.status === 'escalated' || !r.assigned_case_manager_id).slice(0, 3).map((request) => (
                  <RequestCard key={request.id} request={request} showStudent />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}
