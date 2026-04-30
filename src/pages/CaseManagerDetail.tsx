import { useNavigate, useParams, Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  ArrowLeft, 
  Mail, 
  Phone,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  FileText,
  MessageSquare,
  Calendar,
  BarChart3,
  Users
} from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { TimeAgo } from '@/components/TimeAgo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCaseManagerStats } from '@/hooks/useCaseManagerStats';
import { GenerateReportCard } from '@/components/reports/GenerateReportCard';
import { GenerateStudentReportCard } from '@/components/reports/GenerateStudentReportCard';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip,
  CartesianGrid
} from 'recharts';

const CATEGORY_COLORS: Record<string, string> = {
  academic: 'hsl(var(--primary))',
  financial: 'hsl(var(--success))',
  mental_health: 'hsl(var(--warning))',
  housing: 'hsl(var(--destructive))',
  other: 'hsl(var(--muted))',
};

const PRIORITY_COLORS: Record<string, string> = {
  emergency: 'hsl(var(--destructive))',
  high: 'hsl(var(--warning))',
  medium: 'hsl(var(--primary))',
  low: 'hsl(var(--muted))',
};

export default function CaseManagerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: stats, isLoading, error } = useCaseManagerStats(id);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </SidebarLayout>
    );
  }

  if (error || !stats) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <Users className="h-12 w-12 text-muted-foreground" />
          <h2 className="font-display text-xl font-semibold">Case Manager Not Found</h2>
          <p className="text-muted-foreground">The case manager you're looking for doesn't exist.</p>
          <Button onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </SidebarLayout>
    );
  }

  const { caseManager, assignedRequests, recentActivity } = stats;
  const maxLoad = 20;
  const loadPercentage = (stats.activeRequests / maxLoad) * 100;
  const isOverloaded = loadPercentage > 80;

  // Prepare chart data
  const categoryData = Object.entries(stats.requestsByCategory).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value,
  }));

  const priorityData = Object.entries(stats.requestsByPriority).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={caseManager.avatar_url || undefined} />
                <AvatarFallback className="text-lg">
                  {getInitials(caseManager.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-display text-2xl font-bold">{caseManager.full_name || 'Unknown'}</h1>
                <p className="text-muted-foreground">Case Manager</p>
                <div className="flex items-center gap-4 mt-1 text-sm">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {caseManager.email}
                  </span>
                  {caseManager.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {caseManager.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {isOverloaded && (
            <Badge variant="destructive" className="text-sm">High Workload</Badge>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeRequests}</p>
                  <p className="text-sm text-muted-foreground">Active Requests</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.resolvedRequests}</p>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.emergencyRequests}</p>
                  <p className="text-sm text-muted-foreground">Emergency Cases</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.avgResponseTimeHours}h</p>
                  <p className="text-sm text-muted-foreground">Avg Response</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Generate Reports */}
        <div className="grid gap-4 md:grid-cols-2">
          <GenerateReportCard caseManagerId={id} />
          <GenerateStudentReportCard
            description="Detailed per-student summary across this case manager's caseload."
          />
        </div>

        {/* Workload and Performance */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Workload Card */}
          <Card className="border border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Workload</CardTitle>
              <CardDescription>Current active case distribution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Active Cases</span>
                  <span className="font-medium">{stats.activeRequests}/{maxLoad}</span>
                </div>
                <Progress 
                  value={loadPercentage} 
                  className={isOverloaded ? '[&>div]:bg-destructive' : ''}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Resolution Rate</span>
                  <p className="text-2xl font-bold text-success">{stats.resolutionRate.toFixed(1)}%</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Escalated</span>
                  <p className="text-2xl font-bold text-warning">{stats.escalatedRequests}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card className="border border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Request Categories</CardTitle>
              <CardDescription>Distribution by category</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={CATEGORY_COLORS[entry.name.replace(' ', '_')] || 'hsl(var(--muted))'} 
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  No requests assigned yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Priority Distribution */}
        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Priority Distribution</CardTitle>
            <CardDescription>Requests by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            {priorityData.length > 0 ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {priorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name] || 'hsl(var(--muted))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                No requests assigned yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assigned Requests */}
        <Card className="border border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Assigned Requests</CardTitle>
              <CardDescription>All requests currently assigned to this case manager</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/requests?assigned=${id}`}>View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {assignedRequests.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                No requests assigned
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedRequests.slice(0, 10).map((request) => (
                    <TableRow 
                      key={request.id}
                      className={`cursor-pointer hover:bg-muted/50 ${request.is_emergency ? 'bg-destructive/5' : ''}`}
                      onClick={() => navigate(`/requests/${request.id}`)}
                    >
                      <TableCell>
                        <span className="font-medium">{request.student?.full_name || 'Unknown'}</span>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium truncate max-w-[200px]">{request.title}</p>
                      </TableCell>
                      <TableCell>
                        <CategoryBadge category={request.category} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={request.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={request.status} />
                      </TableCell>
                      <TableCell>
                        <TimeAgo date={request.created_at} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Latest actions taken by this case manager</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                No recent activity
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      {activity.new_status ? (
                        <TrendingUp className="h-4 w-4 text-primary" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        {activity.new_status ? (
                          <>
                            Changed status to <StatusBadge status={activity.new_status} />
                          </>
                        ) : (
                          'Added a note'
                        )}
                      </p>
                      {activity.note && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">{activity.note}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </p>
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
