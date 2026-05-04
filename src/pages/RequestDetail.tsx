import { useState } from 'react';
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
  FileText,
  Pencil,
  Share2
} from 'lucide-react';
import { EditRequestDialog } from '@/components/requests/EditRequestDialog';
import { SharePdfDialog } from '@/components/requests/SharePdfDialog';
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
import { RequestAttachments } from '@/components/requests/RequestAttachments';
import { StatusProgressBar } from '@/components/requests/StatusProgressBar';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { CategoryBadge } from '@/components/CategoryBadge';
import { useRequest } from '@/hooks/useRequest';
import { useAuth } from '@/contexts/AuthContext';
import { OrgBadgeInline } from '@/components/OrgBadgeInline';

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { data: request, isLoading, error } = useRequest(id);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const isStaff = role === 'case_manager' || role === 'admin';
  const canShare = role === 'case_manager' || role === 'admin' || role === 'org_admin';
  const canTakeActions = isStaff && (
    role === 'admin' || 
    request?.assigned_case_manager_id === user?.id
  );
  const canStudentEdit =
    role === 'student' &&
    request?.student_id === user?.id &&
    request?.status === 'submitted';

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
        <div className="flex flex-wrap items-start gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold break-words">{request.title}</h1>
              {request.is_emergency && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Emergency
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Created {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <StatusBadge status={request.status} />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {(() => {
                const eta: Record<string, string> = {
                  emergency: 'Typical response: within 2 hours',
                  high: 'Typical response: within 8 hours',
                  medium: 'Typical response: within 24 hours',
                  low: 'Typical response: within 72 hours',
                };
                return eta[request.priority] || '';
              })()}
            </span>
            {canShare && (
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShareOpen(true)}>
                <Share2 className="h-4 w-4 mr-2" />
                Share as PDF
              </Button>
            )}
          </div>
        </div>

        {/* Status progression */}
        <StatusProgressBar
          status={request.status}
          isAssigned={!!request.assigned_case_manager_id}
        />

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left column - Request details and timeline */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
            {/* Request Details Card */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>Request Details</CardTitle>
                    <div className="flex gap-2 mt-2">
                      <PriorityBadge priority={request.priority} />
                      <CategoryBadge category={request.category} />
                    </div>
                  </div>
                  {canStudentEdit && (
                    <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap">{request.description}</p>
                
                {/* Monetary amounts for financial requests */}
                {request.category === 'financial' && (request.requested_amount || request.approved_amount) && (
                  <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                    {request.requested_amount && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Requested Amount</span>
                        <span className="font-semibold">
                          ${request.requested_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {request.approved_amount !== null && request.approved_amount !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Approved Amount</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          ${request.approved_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                
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
              <>
                {/* Show actions if request is actionable */}
                {(request.status === 'submitted' || request.status === 'in_progress' || request.status === 'escalated') ? (
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
                        requestedAmount={request.requested_amount}
                        requestTitle={request.title}
                        requestDescription={request.description}
                        requestCategory={request.category}
                        requestPriority={request.priority}
                        studentId={request.student_id}
                      />
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-6">
                      <p className="text-muted-foreground text-center">
                        {request.status === 'resolved' 
                          ? 'This request has been resolved. No further actions available.'
                          : request.status === 'cancelled'
                          ? 'This request was denied/cancelled. No further actions available.'
                          : 'No actions available for this request status.'}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Attachments */}
            <RequestAttachments requestId={request.id} />

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
                  requestId={request.id}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right column - Student info and metadata */}
          <div className="space-y-4 sm:space-y-6 min-w-0">
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
                    {(request.student as any)?.organization_id && (
                      <OrgBadgeInline orgId={(request.student as any).organization_id} />
                    )}
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {request.student?.email ? (
                      <a
                        href={`mailto:${request.student.email}`}
                        className="text-primary hover:underline truncate"
                        aria-label={`Email ${request.student.full_name || 'student'}`}
                      >
                        {request.student.email}
                      </a>
                    ) : (
                      <span>No email</span>
                    )}
                  </div>
                  {request.student?.phone && (
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <a
                        href={`tel:${request.student.phone}`}
                        className="text-primary hover:underline truncate"
                        aria-label={`Call ${request.student.full_name || 'student'}`}
                      >
                        {request.student.phone}
                      </a>
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
      {canStudentEdit && (
        <EditRequestDialog request={request} open={editOpen} onOpenChange={setEditOpen} />
      )}
      {canShare && (
        <SharePdfDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          requestId={request.id}
          requestTitle={request.title}
        />
      )}
    </SidebarLayout>
  );
}
