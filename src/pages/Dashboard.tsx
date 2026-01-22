import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
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
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { mockRequests, mockCaseManagers, mockAIInsights, getDashboardStats } from '@/lib/mock-data';

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

  return (
    <AppLayout>
      <div className="space-y-12">
        {/* Header */}
        <PageHeader
          title={`Welcome back, ${profile?.full_name?.split(' ')[0] || 'User'}`}
          description={
            role === 'student' 
              ? "Here's an overview of your support requests"
              : role === 'case_manager'
              ? "Here's your current caseload overview"
              : "System overview and monitoring"
          }
        />

        {/* Stats Grid */}
        <section className="space-y-4">
          <h2 className="font-display text-h3">Overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Requests"
              value={stats.totalRequests}
              icon={FileText}
              trend={{ value: 12, isPositive: true }}
            />
            <StatsCard
              title="Pending"
              value={stats.pendingRequests}
              icon={Clock}
              description="Awaiting response"
            />
            <StatsCard
              title="Resolved"
              value={stats.resolvedRequests}
              icon={CheckCircle}
              trend={{ value: 8, isPositive: true }}
            />
            <StatsCard
              title={role === 'admin' ? 'Escalated' : 'Emergency'}
              value={role === 'admin' ? stats.escalatedRequests : stats.emergencyRequests}
              icon={AlertTriangle}
              description={role === 'admin' ? 'Requires attention' : 'High priority'}
            />
          </div>
        </section>

        {/* Role-specific content */}
        {role === 'student' && (
          <>
            {/* Quick Actions */}
            <section className="space-y-4">
              <h2 className="font-display text-h3">Quick Actions</h2>
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
                <h2 className="font-display text-h3">Recent Requests</h2>
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
                <h2 className="font-display text-h3">AI Insights</h2>
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
                <h2 className="font-display text-h3">Priority Queue</h2>
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
              <h2 className="font-display text-h3">Case Manager Workloads</h2>
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
                <h2 className="font-display text-h3">Escalated & Unassigned</h2>
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
    </AppLayout>
  );
}
