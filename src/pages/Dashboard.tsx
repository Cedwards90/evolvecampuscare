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
import { TodayPanel } from '@/components/dashboard/TodayPanel';
import { ActionNeededList, type ActionItem } from '@/components/dashboard/ActionNeededList';

import { StatsSummaryBar } from '@/components/dashboard/StatsSummaryBar';
import { RequestCard } from '@/components/RequestCard';
import { AIBadge } from '@/components/AIBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ScheduleMeetingDialog } from '@/components/scheduling/ScheduleMeetingDialog';
import { GenerateReportCard } from '@/components/reports/GenerateReportCard';
import { RecommendedResourcesCard } from '@/components/resources/RecommendedResourcesCard';
import { GenerateStudentReportCard } from '@/components/reports/GenerateStudentReportCard';
import { ExpiringCertificationsCard } from '@/components/certifications/ExpiringCertificationsCard';
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
import { useMyLifeSkillsAssignments } from '@/hooks/useLifeSkillsSurveys';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { applyToRequests } from '@/lib/applyGlobalFilters';
import { useProductTour } from '@/hooks/useProductTour';
import { ProfileReviewBanner } from '@/components/profile/ProfileReviewBanner';

export default function Dashboard() {
  const { role, user, profile } = useAuth();
  const navigate = useNavigate();
  const { startTour, hasCompletedTour, getLoginCount } = useProductTour();
  const showOnboardingTip = !hasCompletedTour() && getLoginCount() <= 3;
  
  // Fetch real data from Supabase
  const { data: allRequests = [], isLoading: requestsLoading } = useRequests({});
  const { data: caseManagers = [], isLoading: cmLoading } = useCaseManagers();
  const { data: myAssignment, isLoading: assignmentLoading } = useMyAssignment();
  const { intakeCompleted } = useIntakeSurvey();
  const { data: latestCheckIn } = useLatestCheckIn();
  const { data: pendingSurveysRaw = [] } = usePendingSurveys();
  // Dedupe by survey_type — one card per pending survey, keep newest
  const pendingSurveys = useMemo(() => {
    const seen = new Set<string>();
    const sorted = [...(pendingSurveysRaw as any[])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return sorted.filter((s) => {
      if (seen.has(s.survey_type)) return false;
      seen.add(s.survey_type);
      return true;
    });
  }, [pendingSurveysRaw]);
  const { data: lifeSkillsAssignments = [] } = useMyLifeSkillsAssignments();
  const pendingLifeSkills = (lifeSkillsAssignments as any[]).filter((a) => !a.last_completed_at);
  
  // Weekly check-in banner: due ≥ 7d, overdue ≥ 14d
  const checkInState = useMemo<'none' | 'due' | 'overdue'>(() => {
    if (role !== 'student') return 'none';
    const daysSince = latestCheckIn
      ? (Date.now() - new Date(latestCheckIn.created_at).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;
    if (daysSince >= 14) return 'overdue';
    if (daysSince >= 7) return 'due';
    return 'none';
  }, [role, latestCheckIn]);
  const showCheckInBanner = checkInState !== 'none';
  
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

  // Consolidated "needs your attention" items (replaces the old stacked banners)
  const actionItems = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];

    if (role === 'student') {
      if (checkInState !== 'none') {
        items.push({
          id: 'check-in',
          title: checkInState === 'overdue' ? 'Your weekly check-in is overdue' : 'Time for your weekly check-in',
          description:
            checkInState === 'overdue'
              ? "It's been over two weeks — a minute now helps your case manager support you."
              : "Let us know how you're doing. It only takes a minute.",
          href: '/check-in',
          cta: 'Complete check-in',
          severity: checkInState === 'overdue' ? 'urgent' : 'due',
        });
      }

      pendingSurveys.forEach((survey: any) => {
        const isLifeSkills = typeof survey.survey_type === 'string' && survey.survey_type.startsWith('lifeskills:');
        const slug = isLifeSkills ? survey.survey_type.slice('lifeskills:'.length) : '';
        const isCheckin = survey.survey_type === 'checkin';
        items.push({
          id: `survey-${survey.id}`,
          title: isLifeSkills
            ? 'Life Skills survey requested'
            : isCheckin
              ? 'Check-in requested'
              : 'Post-graduation plan requested',
          description:
            survey.notes ||
            (isLifeSkills
              ? 'Your case manager invited you to complete a Life Skills survey.'
              : isCheckin
                ? 'Your case manager asked you to complete a check-in.'
                : 'Your case manager asked you to complete your 12-month plan.'),
          href: isLifeSkills ? `/surveys/${slug}` : isCheckin ? '/check-in' : '/post-graduation-plan',
          cta: isLifeSkills ? 'Open survey' : isCheckin ? 'Complete check-in' : 'Start plan',
          severity: 'due',
        });
      });

      const hasLifeSkillsInvite = pendingSurveys.some(
        (s: any) => typeof s.survey_type === 'string' && s.survey_type.startsWith('lifeskills:'),
      );
      if (pendingLifeSkills.length > 0 && !hasLifeSkillsInvite) {
        items.push({
          id: 'lifeskills-pending',
          title: `${pendingLifeSkills.length} Life Skills survey${pendingLifeSkills.length === 1 ? '' : 's'} pending`,
          description: 'Help us measure the impact of the curriculum — only a minute each.',
          href: '/surveys',
          cta: 'Open',
          severity: 'due',
        });
      }

      if (!intakeCompleted) {
        items.push({
          id: 'intake',
          title: 'Complete your wellness check-in',
          description: 'Help us understand how to best support you — it takes a few minutes.',
          href: '/intake-survey',
          cta: 'Get started',
          severity: 'due',
        });
      }

      items.push({
        id: 'post-grad-plan',
        title: '12-month post-graduation plan',
        description: 'Plan your first year after graduation — career, housing, finances, and more.',
        href: '/post-graduation-plan',
        cta: 'Create plan',
        severity: 'info',
      });
    }

    if (role === 'case_manager') {
      if (stats.emergencyRequests > 0) {
        items.push({
          id: 'emergency',
          title: `${stats.emergencyRequests} emergency case${stats.emergencyRequests === 1 ? '' : 's'} open`,
          description: 'These students flagged an emergency and need a response today.',
          href: '/requests/queue?priority=emergency',
          cta: 'Open queue',
          severity: 'urgent',
        });
      }
      if (stats.escalatedRequests > 0) {
        items.push({
          id: 'escalated',
          title: `${stats.escalatedRequests} escalated request${stats.escalatedRequests === 1 ? '' : 's'}`,
          description: 'Escalated requests are waiting on a next step from you.',
          href: '/requests/queue?status=escalated',
          cta: 'Review',
          severity: 'urgent',
        });
      }
      if (stats.pendingRequests > 0) {
        items.push({
          id: 'pending',
          title: `${stats.pendingRequests} request${stats.pendingRequests === 1 ? '' : 's'} in progress`,
          description: 'Keep momentum by updating statuses and adding case notes.',
          href: '/requests/queue',
          cta: 'Open queue',
          severity: 'info',
        });
      }
    }

    if (role === 'admin' || role === 'org_admin') {
      const activeStatuses = new Set(['submitted', 'in_progress', 'escalated']);
      const unassigned = allRequests.filter((r) => activeStatuses.has(r.status) && !r.assigned_case_manager_id);
      const escalated = allRequests.filter((r) => r.status === 'escalated');
      if (unassigned.length > 0) {
        items.push({
          id: 'unassigned',
          title: `${unassigned.length} request${unassigned.length === 1 ? '' : 's'} unassigned`,
          description: 'Assign a case manager so students get a response.',
          href: '/admin',
          cta: 'Assign now',
          severity: 'urgent',
        });
      }
      if (escalated.length > 0) {
        items.push({
          id: 'escalated-admin',
          title: `${escalated.length} escalated request${escalated.length === 1 ? '' : 's'}`,
          description: 'Escalations may need reassignment or extra support.',
          href: '/admin',
          cta: 'Review',
          severity: 'urgent',
        });
      }
    }

    if (showOnboardingTip) {
      items.push({
        id: 'tour',
        title: 'New here? Take the 60-second tour',
        description: 'A quick guided walkthrough of where everything lives.',
        href: '/support',
        cta: 'Help Center',
        severity: 'info',
      });
    }

    return items;
  }, [
    role,
    checkInState,
    pendingSurveys,
    pendingLifeSkills.length,
    intakeCompleted,
    stats,
    allRequests,
    showOnboardingTip,
  ]);

  const today = useMemo(() => {
    if (role === 'student') {
      return {
        subtitle: 'Here’s what you can do next.',
        primaryAction: { label: 'Submit a request', href: '/requests/new', icon: Plus },
        secondaryActions: [{ label: 'My requests', href: '/requests/mine', icon: Clock }],
        stats: [
          { label: 'Open requests', value: stats.pendingRequests, href: '/requests/mine' },
          { label: 'Resolved', value: stats.resolvedRequests, href: '/requests/mine' },
          { label: 'Total requests', value: stats.totalRequests, href: '/requests/mine' },
        ],
      };
    }
    if (role === 'case_manager') {
      return {
        subtitle: 'Your caseload for today.',
        primaryAction: { label: 'Open request queue', href: '/requests/queue', icon: Users },
        secondaryActions: [{ label: 'My students', href: '/students', icon: Users }],
        stats: [
          { label: 'Emergency', value: stats.emergencyRequests, href: '/requests/queue?priority=emergency', tone: 'urgent' as const },
          { label: 'Escalated', value: stats.escalatedRequests, href: '/requests/queue?status=escalated' },
          { label: 'In progress', value: stats.pendingRequests, href: '/requests/queue' },
          { label: 'Resolved', value: stats.resolvedRequests, href: '/requests?status=resolved' },
        ],
      };
    }
    return {
      subtitle: 'Where the platform needs attention today.',
      primaryAction: { label: 'Admin overview', href: '/admin', icon: BarChart3 },
      secondaryActions: [{ label: 'Reports', href: '/reports', icon: FileText }],
      stats: [
        { label: 'Emergency', value: stats.emergencyRequests, href: '/requests?is_emergency=true', tone: 'urgent' as const },
        { label: 'Escalated', value: stats.escalatedRequests, href: '/requests?status=escalated' },
        { label: 'In progress', value: stats.pendingRequests, href: '/requests?status=in_progress' },
        { label: 'Resolved', value: stats.resolvedRequests, href: '/requests?status=resolved' },
      ],
    };
  }, [role, stats]);

  if (requestsLoading) {
    return (
      <SidebarLayout>
        <div className="space-y-6">
          <div className="h-32 animate-pulse rounded-xl bg-muted/60" />
          <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/40" />
            ))}
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {role === 'student' && <ProfileReviewBanner />}

        {/* 1. Action-first: who you are and what to do next */}
        <TodayPanel
          greeting={`Welcome back, ${profile?.full_name?.split(' ')[0] || 'there'}`}
          subtitle={today.subtitle}
          primaryAction={today.primaryAction}
          secondaryActions={today.secondaryActions}
          stats={today.stats}
        />

        {/* 2. Consolidated alerts */}
        <ActionNeededList
          items={actionItems}
          emptyTitle="You're all caught up"
          emptyDescription={
            role === 'student'
              ? 'No check-ins, surveys, or requests need your attention right now.'
              : 'No urgent or unassigned work right now.'
          }
          onExtraAction={
            showOnboardingTip ? (
              <Button size="sm" variant="outline" onClick={startTour}>
                Start tour
              </Button>
            ) : undefined
          }
        />

        {/* 3. Overview and analytics */}
        {role !== 'student' && <GlobalFilterBar />}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-semibold">Overview</h2>
          <p className="text-xs text-muted-foreground">{format(new Date(), 'yyyy')}</p>
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
            subtitle={`${stats.resolvedRequests} of ${stats.totalRequests} requests resolved`}
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
              description="Requests created over time"
              summary={`${stats.totalRequests} requests in this view, ${stats.pendingRequests} still open.`}
              href="/requests"
              linkLabel="View requests"
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
            items={summaryItems}
            headerHref="/requests?status=resolved"
            footerHref="/requests"
            footerLabel="View all requests"
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

            {/* Recommended Community Resources */}
            {user?.id && (
              <section className="space-y-4">
                <RecommendedResourcesCard studentId={user.id} />
              </section>
            )}

            {/* Quick Actions */}
            <section className="space-y-4">
              <h2 className="font-display text-lg font-semibold">Quick Actions</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="border border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
                  <Link to="/requests/new">
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
                  <Link to="/requests/mine">
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
                  <Link to="/requests/drafts">
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
                  <Link to="/requests/mine">
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

            <ExpiringCertificationsCard />

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
                      onClick={() => navigate('/requests/queue?priority=emergency')}
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
                  <Link to="/requests/queue">
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
                  <Link to="/admin">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-4">
                {(() => {
                  const activeStatuses = new Set(['submitted', 'in_progress', 'escalated']);
                  const items = allRequests.filter(r => activeStatuses.has(r.status) && (r.status === 'escalated' || !r.assigned_case_manager_id));
                  return (
                    <>
                      {items.slice(0, 3).map((request) => (
                        <RequestCard key={request.id} request={request} showStudent />
                      ))}
                      {items.length === 0 && (
                        <Card className="border border-border/50 p-8 text-center">
                          <CheckCircle className="h-12 w-12 mx-auto text-green-500/50 mb-4" />
                          <p className="text-muted-foreground">All requests are assigned and on track.</p>
                        </Card>
                      )}
                    </>
                  );
                })()}
              </div>
            </section>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}
