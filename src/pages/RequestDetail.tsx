import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  Tag, 
  AlertTriangle,
  Mail,
  Phone,
  Clock,
  FileText
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RequestTimeline } from '@/components/requests/RequestTimeline';
import { RequestActions } from '@/components/requests/RequestActions';
import { RequestMessages } from '@/components/requests/RequestMessages';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { useRequest } from '@/hooks/useRequest';
import { useAuth } from '@/contexts/AuthContext';

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { data: request, isLoading, error } = useRequest(id);

  const isStaff = role === 'case_manager' || role === 'admin';
  const canTakeActions = isStaff && (
    role === 'admin' || 
    request?.assigned_case_manager_id === user?.id
  );

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-64" />
              <Skeleton className="h-96" />
            </div>
            <Skeleton className="h-64" />
          </div>
        </div>
      </SidebarLayout>
    );
  }

  if (error || !request) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Request Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The request you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{request.title}</h1>
              {request.is_emergency && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Emergency
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Created {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
            </div>
          </div>
          <StatusBadge status={request.status} />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Request details and timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Request Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Request Details</CardTitle>
                <div className="flex gap-2 mt-2">
                  <PriorityBadge priority={request.priority} />
                  <CategoryBadge category={request.category} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap">{request.description}</p>
                
                {request.escalated_at && (
                  <div className="mt-4 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Escalated</span>
                      <span className="text-sm">
                        {format(new Date(request.escalated_at), 'PPp')}
                      </span>
                    </div>
                  </div>
                )}

                {request.resolved_at && (
                  <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">Resolved</span>
                      <span className="text-sm">
                        {format(new Date(request.resolved_at), 'PPp')}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions Card - Only for staff */}
            {canTakeActions && (
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                  <CardDescription>
                    Take action on this request
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RequestActions
                    requestId={request.id}
                    userId={user!.id}
                    currentStatus={request.status}
                  />
                </CardContent>
              </Card>
            )}

            {/* Reply Card */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {isStaff ? 'Reply to Student' : 'Add Message'}
                </CardTitle>
                <CardDescription>
                  {isStaff 
                    ? 'Send a message to the student or add an internal note'
                    : 'Send a message regarding your request'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RequestMessages
                  requestId={request.id}
                  userId={user!.id}
                  canSendInternal={isStaff}
                />
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>
                  Complete history of this request
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RequestTimeline 
                  updates={request.updates} 
                  showInternal={isStaff}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right column - Student info and metadata */}
          <div className="space-y-6">
            {/* Student Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Student Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(request.student?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {request.student?.full_name || 'Unknown Student'}
                    </p>
                    <p className="text-sm text-muted-foreground">Student</p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{request.student?.email || 'No email'}</span>
                  </div>
                  {request.student?.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{request.student.phone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Assigned Case Manager Card */}
            {request.case_manager && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Assigned Case Manager
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {getInitials(request.case_manager.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {request.case_manager.full_name || 'Unknown'}
                      </p>
                      <p className="text-sm text-muted-foreground">Case Manager</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Request Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Request ID</span>
                  <span className="font-mono text-xs">{request.id.slice(0, 8)}...</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span>{format(new Date(request.created_at), 'PP')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span>{format(new Date(request.updated_at), 'PP')}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Priority</span>
                  <PriorityBadge priority={request.priority} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <CategoryBadge category={request.category} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
