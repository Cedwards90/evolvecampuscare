import { useMemo } from 'react';
import { useIntakeSurvey } from '@/hooks/useIntakeSurvey';
import { useAuth } from '@/contexts/AuthContext';
import { useLatestCheckIn } from '@/hooks/useStudentCheckIns';
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
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ScheduleMeetingDialog } from '@/components/scheduling/ScheduleMeetingDialog';
import { GenerateReportCard } from '@/components/reports/GenerateReportCard';
import { GenerateStudentReportCard } from '@/components/reports/GenerateStudentReportCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  Target,
  MessageSquare,
  UserCircle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useRequests } from '@/hooks/useRequests';
import { useCaseManagers } from '@/hooks/useCaseManagerStats';
import { useMyAssignment } from '@/hooks/useMyAssignment';
import { format, subDays } from 'date-fns';
import { usePendingSurveys } from '@/hooks/useSurveyInvitations';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { applyToRequests } from '@/lib/applyGlobalFilters';

export default function Dashboard() {
  const { role, user, profile } = useAuth();
  const navigate = useNavigate();
  
  // Fetch real data from Supabase
  const { data: allRequests = [], isLoading: requestsLoading } = useRequests({});
  const { data: caseManagers = [], isLoading: cmLoading } = useCaseManagers();
  const { data: myAssignment, isLoading: assignmentLoading } = useMyAssignment();
  const { intakeCompleted } = useIntakeSurvey();
  const { data: latestCheckIn } = useLatestCheckIn();
  const { data: pendingSurveys = [] } = usePendingSurveys();
  
  // Show check-in banner if no check-in or last one > 21 days ago
  const showCheckInBanner = useMemo(() => {
    if (role !== 'student') return false;
    if (!latestCheckIn) return true;
    const daysSince = (Date.now() - new Date(latestCheckIn.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= 21;
  }, [role, latestCheckIn]);
  
  // Filter requests based on role
  const { filters: globalFilters } = useGlobalFilters();
  const requests = useMemo(() => {
    let base = allRequests;
    if (role === 'student') {
      return base.filter(r => r.student_id === user?.id);
    } else if (role === 'case_manager') {
      base = base.filter(r => r.assigned_case_manager_id === user?.id);
    }
    return applyToRequests(base, globalFilters);
  }, [allRequests, role, user?.id, globalFilters]);

  // Calculate stats from real data
  const stats = useMemo(() => ({
    totalRequests: requests.length,
    pendingRequests: requests.filter(r => r.status === 'submitted' || r.status === 'in_progress').length,
    resolvedRequests: requests.filter(r => r.status === 'resolved').length,
    emergencyRequests: requests.filter(r => r.is_emergency && r.status !== 'resolved' && r.status !== 'cancelled').length,
    escalatedRequests: requests.filter(r => r.status === 'escalated').length,
  }), [requests]);

  // Recent requests
  const recentRequests = useMemo(() => {
    const sorted = [...requests].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return role === 'case_manager' 
      ? sorted.filter(r => r.priority === 'emergency' || r.priority === 'high').slice(0, 5)
      : sorted.slice(0, 3);
  }, [requests, role]);

  // Generate chart data from real requests (last 12 months)
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    
    return months.map((name, index) => {
      const monthRequests = requests.filter(r => {
        const date = new Date(r.created_at);
        return date.getMonth() === index && date.getFullYear() === now.getFullYear();
      });
      return { name, value: monthRequests.length };
    });
  }, [requests]);

  // Sparkline data based on last 12 weeks
  const sparklineData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const weekStart = subDays(new Date(), (11 - i) * 7);
      const weekEnd = subDays(new Date(), (10 - i) * 7);
      return requests.filter(r => {
        const date = new Date(r.created_at);
        return date >= weekStart && date < weekEnd;
      }).length;
    });
  }, [requests]);

  // Summary items for the side card
  const summaryItems = useMemo(() => [
    {
      icon: <FileText className="h-4 w-4 text-primary" />,
      title: 'Academic Advising',
      subtitle: 'Support',
      value: `${requests.filter(r => r.category === 'academic').length}`,
      href: '/requests?category=academic',
    },
    {
      icon: <Users className="h-4 w-4 text-primary" />,
      title: 'Mental Health',
      subtitle: 'Counseling',
      value: `${requests.filter(r => r.category === 'mental_health').length}`,
      href: '/requests?category=mental_health',
    },
    {
      icon: <Briefcase className="h-4 w-4 text-primary" />,
      title: 'Financial Aid',
      subtitle: 'Assistance',
      value: `${requests.filter(r => r.category === 'financial').length}`,
      href: '/requests?category=financial',
    },
  ], [requests]);

  if (requestsLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Check-In Banner */}
         {showCheckInBanner && (
          <Card className="border-accent/50 bg-accent/10">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-sm">📋 Time for your 3-week check-in!</p>
                <p className="text-xs text-muted-foreground">Let us know how you're doing — it only takes a minute.</p>
              </div>
              <Button size="sm" asChild>
                <Link to="/check-in">Complete Check-In</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pending Survey Invitations Banner */}
        {role === 'student' && pendingSurveys.length > 0 && (
          <>
            {pendingSurveys.map((survey) => (
              <Card key={survey.id} className="border-primary/50 bg-primary/5">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      📝 {survey.survey_type === 'checkin' ? 'Check-In Requested' : 'Post-Graduation Plan Requested'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {survey.notes || (survey.survey_type === 'checkin'
                        ? 'Your case manager has asked you to complete a check-in.'
                        : 'Your case manager has asked you to complete your 12-month plan.')}
                    </p>
                  </div>
                  <Button size="sm" asChild>
                    <Link to={survey.survey_type === 'checkin' ? '/check-in' : '/post-graduation-plan'}>
                      {survey.survey_type === 'checkin' ? 'Complete Check-In' : 'Start Plan'}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {role === 'student' && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-sm">🎓 12-Month Post-Graduation Plan</p>
                <p className="text-xs text-muted-foreground">Plan your first year after graduation — career, housing, finances, and more.</p>
              </div>
              <Button size="sm" asChild>
                <Link to="/post-graduation-plan">Create Plan</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Intake Survey Reminder */}
        {role === 'student' && !intakeCompleted && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-sm">Complete your wellness check-in</p>
                <p className="text-xs text-muted-foreground">Help us understand how to best support you — it only takes a few minutes.</p>
              </div>
              <Button size="sm" asChild>
                <Link to="/intake-survey">Get Started</Link>
              </Button>
            </CardContent>
          </Card>
        )}
        {/* Header with Breadcrumb */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold truncate">
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
          <div className="hidden sm:flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              {format(new Date(), 'yyyy')}
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
            total={Math.max(stats.totalRequests + 10, 50)}
            icon={DollarSign}
            color="blue"
            href="/requests"
          />
          <FractionStatsCard
            title="In Progress"
            current={stats.pendingRequests}
            total={stats.totalRequests || 1}
            icon={Target}
            color="green"
            href="/requests?status=in_progress"
          />
          <FractionStatsCard
            title="Resolved"
            current={stats.resolvedRequests}
            total={stats.totalRequests || 1}
            icon={CheckCircle}
            color="green"
            href="/requests?status=resolved"
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
                { label: 'Pending', value: stats.pendingRequests, color: 'blue', href: '/requests?status=submitted' },
                { label: 'Resolved', value: stats.resolvedRequests, color: 'green', href: '/requests?status=resolved' },
                { label: 'Escalated', value: stats.escalatedRequests, color: 'orange', href: '/requests?status=escalated' },
                { label: 'Emergency', value: stats.emergencyRequests, color: 'red', href: '/requests?is_emergency=true' },
              ]}
            />
          </div>

          {/* Summary Card - Takes 1 column */}
          <SummaryCard
            title="Request Summary"
            totalValue={stats.resolvedRequests}
            totalLabel="Total Resolved"
            trendValue={12}
            items={summaryItems}
            headerHref="/requests?status=resolved"
            footerHref="/requests"
          />
        </div>

        {/* Sparkline Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SparklineCard
            title="Tasks Completed"
            subtitle={`${stats.resolvedRequests}/${stats.totalRequests || 1} completed`}
            current={stats.resolvedRequests}
            total={stats.totalRequests || 1}
            data={sparklineData}
            trend={{ value: 28, isPositive: true }}
            icon={Star}
            color="blue"
          />
          <SparklineCard
            title="New Requests"
            subtitle={`${stats.pendingRequests} pending`}
            current={stats.pendingRequests}
            total={stats.totalRequests || 1}
            data={sparklineData}
            trend={{ value: 34, isPositive: true }}
            icon={FileText}
            color="green"
          />
          <SparklineCard
            title="Cases Closed"
            subtitle={`${stats.resolvedRequests} resolved`}
            current={stats.resolvedRequests}
            total={stats.totalRequests || 1}
            data={sparklineData}
            trend={{ value: 42, isPositive: true }}
            icon={CheckCircle}
            color="red"
          />
        </div>

        {/* Role-specific content */}
        {role === 'student' && (
          <>
            {/* Your Case Manager Card */}
            <section className="space-y-4">
              <h2 className="font-display text-lg font-semibold">Your Case Manager</h2>
              {assignmentLoading ? (
                <Card className="border border-border/50 p-6">
                  <LoadingSpinner size="sm" />
                </Card>
              ) : myAssignment ? (
                <Card className="border border-border/50">
                  <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <Avatar className="h-14 w-14 flex-shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                          {myAssignment.case_manager.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'CM'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display font-semibold truncate">{myAssignment.case_manager.full_name || 'Your Case Manager'}</h3>
                        <p className="text-sm text-muted-foreground truncate">{myAssignment.case_manager.email}</p>
                        {myAssignment.case_manager.phone && (
                          <p className="text-sm text-muted-foreground truncate">{myAssignment.case_manager.phone}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 sm:flex-shrink-0">
                      <ScheduleMeetingDialog
                        studentId={user?.id || ''}
                        studentName={profile?.full_name || 'Student'}
                        trigger={
                          <Button variant="outline" size="sm" className="w-full sm:w-auto">
                            <Calendar className="mr-2 h-4 w-4" />
                            Schedule Meeting
                          </Button>
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-border/50 p-6 text-center">
                  <UserCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">You haven't been assigned a case manager yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">Submit a request and an admin will assign you a case manager.</p>
                </Card>
              )}
            </section>

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
                {recentRequests.length > 0 ? (
                  recentRequests.map((request) => (
                    <RequestCard key={request.id} request={request} />
                  ))
                ) : (
                  <Card className="border border-border/50 p-8 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No requests yet. Submit your first request to get started.</p>
                  </Card>
                )}
              </div>
            </section>
          </>
        )}

        {role === 'case_manager' && (
          <>
            {/* Quick report generators */}
            <section className="grid gap-4 md:grid-cols-2">
              <GenerateReportCard />
              <GenerateStudentReportCard />
            </section>

            {/* AI Insights */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-semibold">AI Insights</h2>
                <AIBadge />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <CardTitle className="text-base">Priority Cases</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      You have {stats.emergencyRequests} emergency and {stats.escalatedRequests} escalated cases that require immediate attention.
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={() => navigate('/case-manager-managing-student-requests?priority=emergency')}
                    >
                      View Emergency Cases
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Weekly Summary</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      You've resolved {stats.resolvedRequests} requests. Keep up the great work!
                    </p>
                  </CardContent>
                </Card>
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
                {recentRequests.length > 0 ? (
                  recentRequests.map((request) => (
                    <RequestCard key={request.id} request={request} showStudent />
                  ))
                ) : (
                  <Card className="border border-border/50 p-8 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500/50 mb-4" />
                    <p className="text-muted-foreground">No high-priority cases. Great job!</p>
                  </Card>
                )}
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
                {cmLoading ? (
                  <LoadingSpinner />
                ) : caseManagers.length > 0 ? (
                  caseManagers.slice(0, 3).map((cm) => (
                    <Card key={cm.user_id} className="border border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{cm.full_name || 'Unknown'}</CardTitle>
                        <CardDescription>{cm.email}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Active Requests</span>
                          <span className="font-semibold">{cm.active_requests}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="text-muted-foreground">Assigned Students</span>
                          <span className="font-semibold">{cm.assigned_students || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="text-muted-foreground">Emergency Cases</span>
                          <span className="font-semibold text-destructive">{cm.emergency_requests}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="border border-border/50 p-8 text-center col-span-3">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No case managers registered yet.</p>
                  </Card>
                )}
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
                {allRequests.filter(r => r.status === 'escalated' || !r.assigned_case_manager_id).slice(0, 3).map((request) => (
                  <RequestCard key={request.id} request={request} showStudent />
                ))}
                {allRequests.filter(r => r.status === 'escalated' || !r.assigned_case_manager_id).length === 0 && (
                  <Card className="border border-border/50 p-8 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500/50 mb-4" />
                    <p className="text-muted-foreground">All requests are assigned and on track.</p>
                  </Card>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}
