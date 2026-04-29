import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { useAllCheckIns, useAllPostGradPlans, usePendingInvitations, useRecentlySentInvitations } from '@/hooks/useSurveyResponses';
import { useCancelInvitation, useResendInvitation } from '@/hooks/useSurveyInvitations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Search, ChevronDown, ChevronRight, ExternalLink, Smile, TrendingUp, Eye, Bell, X, Mail, MailX, Clock, Send, CheckCircle2, AlertCircle, XCircle, CalendarClock } from 'lucide-react';
import { SurveyPreviewDialog } from '@/components/admin/SurveyPreviewDialog';
import { DistributeSurveyDialog } from '@/components/admin/DistributeSurveyDialog';
import { useScheduledDistributions, useCancelScheduledDistribution } from '@/hooks/useSurveyDistribution';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

type ResendResult = {
  status: 'delivered' | 'skipped' | 'failed';
  error?: string;
};

function MoodBadge({ rating }: { rating: number }) {
  const colors = rating >= 4 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    : rating >= 3 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  return <Badge className={colors}>{rating}/5</Badge>;
}

export default function SurveyResponses() {
  const [search, setSearch] = useState('');
  const [previewType, setPreviewType] = useState<'checkin' | 'post_grad' | null>(null);
  const { data: checkIns, isLoading: loadingCheckIns } = useAllCheckIns();
  const { data: plans, isLoading: loadingPlans } = useAllPostGradPlans();
  const { data: pending, isLoading: loadingPending } = usePendingInvitations();
  const { data: recentlySent } = useRecentlySentInvitations();

  const filteredCheckIns = checkIns?.filter(c =>
    (c.student_name || c.student_email).toLowerCase().includes(search.toLowerCase())
  ) || [];

  const filteredPlans = plans?.filter(p =>
    (p.student_name || p.student_email).toLowerCase().includes(search.toLowerCase())
  ) || [];

  const filteredPending = pending?.filter(p =>
    (p.student_name || p.student_email).toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <SidebarLayout>
      <PageHeader title="Survey Responses" description="View all student check-ins and post-graduation plans" />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by student name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewType('checkin')}>
            <Eye className="mr-2 h-4 w-4" /> Preview Check-In
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPreviewType('post_grad')}>
            <Eye className="mr-2 h-4 w-4" /> Preview Post-Grad Plan
          </Button>
          <DistributeSurveyDialog trigger={
            <Button size="sm"><Send className="mr-2 h-4 w-4" /> Distribute Survey</Button>
          } />
        </div>
      </div>

      <SurveyPreviewDialog
        open={previewType !== null}
        onOpenChange={(open) => !open && setPreviewType(null)}
        surveyType={previewType || 'checkin'}
      />

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({filteredPending.length})</TabsTrigger>
          <TabsTrigger value="distributions">Distributions</TabsTrigger>
          <TabsTrigger value="checkins">Check-Ins ({filteredCheckIns.length})</TabsTrigger>
          <TabsTrigger value="plans">Post-Graduation Plans ({filteredPlans.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <RecentlySentSection invitations={recentlySent || []} />
          {loadingPending ? <LoadingSpinner /> : filteredPending.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No pending surveys.</CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Survey Type</TableHead>
                    <TableHead>Sent By</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPending.map(p => (
                    <PendingRow key={p.id} invitation={p} />
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="checkins">
          {loadingCheckIns ? <LoadingSpinner /> : filteredCheckIns.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No check-ins found.</CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Mood</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCheckIns.map(c => (
                    <CheckInRow key={c.id} checkIn={c} />
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="plans">
          {loadingPlans ? <LoadingSpinner /> : filteredPlans.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No plans found.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filteredPlans.map(p => (
                <PlanCard key={p.id} plan={p} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </SidebarLayout>
  );
}

function CheckInRow({ checkIn }: { checkIn: ReturnType<typeof useAllCheckIns>['data'] extends (infer T)[] | undefined ? T : never }) {
  const [open, setOpen] = useState(false);
  const hasDetails = checkIn.wins || checkIn.blockers || checkIn.additional_notes;

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => hasDetails && setOpen(!open)}>
        <TableCell>
          <Link to={`/students/${checkIn.student_id}`} className="font-medium text-primary hover:underline" onClick={e => e.stopPropagation()}>
            {checkIn.student_name || checkIn.student_email}
          </Link>
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {new Date(checkIn.created_at).toLocaleDateString()}
        </TableCell>
        <TableCell><MoodBadge rating={checkIn.mood_rating} /></TableCell>
        <TableCell><MoodBadge rating={checkIn.progress_rating} /></TableCell>
        <TableCell>
          {hasDetails && (open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
        </TableCell>
      </TableRow>
      {open && hasDetails && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30 px-6 py-4">
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              {checkIn.wins && (
                <div>
                  <span className="font-medium text-green-700 dark:text-green-400">Wins:</span>
                  <p className="mt-1 text-muted-foreground">{checkIn.wins}</p>
                </div>
              )}
              {checkIn.blockers && (
                <div>
                  <span className="font-medium text-red-700 dark:text-red-400">Blockers:</span>
                  <p className="mt-1 text-muted-foreground">{checkIn.blockers}</p>
                </div>
              )}
              {checkIn.additional_notes && (
                <div>
                  <span className="font-medium">Notes:</span>
                  <p className="mt-1 text-muted-foreground">{checkIn.additional_notes}</p>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function PlanCard({ plan }: { plan: ReturnType<typeof useAllPostGradPlans>['data'] extends (infer T)[] | undefined ? T : never }) {
  const [open, setOpen] = useState(false);

  const sections = [
    { label: 'Career Goals', value: plan.career_goals },
    { label: 'Education Goals', value: plan.education_goals },
    { label: 'Housing Plan', value: plan.housing_plan },
    { label: 'Financial Plan', value: plan.financial_plan },
    { label: 'Health & Wellness', value: plan.health_wellness },
    { label: 'Support Needed', value: plan.support_needed },
    { label: 'Months 1-3', value: plan.month_1_3_actions },
    { label: 'Months 4-6', value: plan.month_4_6_actions },
    { label: 'Months 7-9', value: plan.month_7_9_actions },
    { label: 'Months 10-12', value: plan.month_10_12_actions },
  ].filter(s => s.value);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <div>
                  <CardTitle className="text-base">
                    <Link to={`/students/${plan.student_id}`} className="text-primary hover:underline" onClick={e => e.stopPropagation()}>
                      {plan.student_name || plan.student_email}
                    </Link>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Submitted {new Date(plan.created_at).toLocaleDateString()}
                    {plan.graduation_date && ` · Graduation: ${new Date(plan.graduation_date).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <Badge variant="outline">{sections.length} sections</Badge>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid gap-4 md:grid-cols-2">
              {sections.map(s => (
                <div key={s.label} className="rounded-lg border border-border/40 p-3">
                  <h4 className="text-sm font-medium mb-1">{s.label}</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{s.value}</p>
                </div>
              ))}
            </div>
            {plan.additional_notes && (
              <div className="mt-4 rounded-lg bg-muted/30 p-3">
                <h4 className="text-sm font-medium mb-1">Additional Notes</h4>
                <p className="text-sm text-muted-foreground">{plan.additional_notes}</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function PendingRow({ invitation }: { invitation: ReturnType<typeof usePendingInvitations>['data'] extends (infer T)[] | undefined ? T : never }) {
  const cancel = useCancelInvitation();
  const resend = useResendInvitation();
  const [resultOpen, setResultOpen] = useState(false);
  const [result, setResult] = useState<ResendResult | null>(null);
  // Use the most recent send timestamp so resends reset the age clock.
  const lastSentAt = invitation.email_sent_at || invitation.created_at;
  const days = Math.floor((Date.now() - new Date(lastSentAt).getTime()) / 86400000);

  const daysClass = days >= 14
    ? 'bg-destructive/10 text-destructive border-destructive/20'
    : days >= 7
    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
    : 'bg-muted text-muted-foreground';

  const typeLabel = invitation.survey_type === 'checkin' ? 'Check-In' : 'Post-Grad Plan';

  const statusMeta = result?.status === 'delivered'
    ? { Icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', title: 'Reminder delivered', body: 'The reminder email was sent successfully.' }
    : result?.status === 'skipped'
    ? { Icon: AlertCircle, color: 'text-amber-600 dark:text-amber-400', title: 'Reminder skipped', body: 'No email address on file for this student.' }
    : { Icon: XCircle, color: 'text-destructive', title: 'Reminder failed', body: 'The email service did not accept the message.' };

  return (
    <>
    <TableRow>
      <TableCell>
        <Link to={`/students/${invitation.student_id}`} className="font-medium text-primary hover:underline">
          {invitation.student_name || invitation.student_email}
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{typeLabel}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">{invitation.sender_name || '—'}</TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {new Date(lastSentAt).toLocaleDateString()}
      </TableCell>
      <TableCell>
        <EmailStatusBadge status={invitation.email_status} error={invitation.email_error} />
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={daysClass}>
          {days === 0 ? 'Today' : `${days}d`}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={resend.isPending}
            onClick={async () => {
              const toastId = `resend-${invitation.id}`;
              toast.loading('Sending reminder...', { id: toastId });
              try {
                const r = await resend.mutateAsync({
                  studentId: invitation.student_id,
                  surveyType: invitation.survey_type,
                });
                const parts = ['Reminder sent'];
                let status: ResendResult['status'] = 'delivered';
                let errorMsg: string | undefined;
                if (r.sent) {
                  parts.push('email delivered');
                  status = 'delivered';
                } else if (r.failed) {
                  parts.push('email failed');
                  status = 'failed';
                  errorMsg = invitation.email_error || undefined;
                } else if (r.skipped) {
                  parts.push('no email on file');
                  status = 'skipped';
                }
                toast.success(parts.join(' · '), { id: toastId });
                setResult({ status, error: errorMsg });
                setResultOpen(true);
              } catch (err: any) {
                console.error('Resend failed:', err);
                toast.error('Failed to send reminder', { id: toastId });
                setResult({ status: 'failed', error: err?.message || 'Unknown error' });
                setResultOpen(true);
              }
            }}
          >
            <Bell className="h-3.5 w-3.5 mr-1" /> Resend
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={cancel.isPending}
            onClick={async () => {
              if (!confirm('Cancel this pending survey invitation?')) return;
              const toastId = `cancel-${invitation.id}`;
              toast.loading('Cancelling...', { id: toastId });
              try {
                await cancel.mutateAsync(invitation.id);
                toast.success('Invitation cancelled', { id: toastId });
              } catch (err) {
                console.error('Cancel failed:', err);
                toast.error('Failed to cancel invitation', { id: toastId });
              }
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
    <Dialog open={resultOpen} onOpenChange={setResultOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className={`flex items-center gap-2 ${statusMeta.color}`}>
            <statusMeta.Icon className="h-5 w-5" />
            <DialogTitle>{statusMeta.title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">{statusMeta.body}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">To:</span>{' '}
            <span className="font-medium">{invitation.student_email || '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Survey:</span>{' '}
            <span className="font-medium">{typeLabel}</span>
          </div>
          {result?.status === 'failed' && (
            <div className="mt-3 rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground break-all">
              {result.error || 'The email service did not accept the message.'}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => setResultOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function EmailStatusBadge({ status, error }: { status: string | null; error?: string | null }) {
  const config = {
    sent: { icon: Mail, label: 'Delivered', cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300/40' },
    pending: { icon: Clock, label: 'Pending', cls: 'bg-muted text-muted-foreground' },
    failed: { icon: MailX, label: 'Failed', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
    skipped_no_email: { icon: MailX, label: 'No email', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
    disabled_by_admin: { icon: MailX, label: 'Disabled', cls: 'bg-muted text-muted-foreground' },
  } as const;
  const c = (status && config[status as keyof typeof config]) || config.pending;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`${c.cls} gap-1`} title={error || undefined}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}

function RecentlySentSection({ invitations }: { invitations: ReturnType<typeof useRecentlySentInvitations>['data'] extends (infer T)[] | undefined ? T[] : never }) {
  if (!invitations.length) return null;

  // Group by batch: same created_at minute + sent_by + survey_type
  const groups = new Map<string, typeof invitations>();
  invitations.forEach(inv => {
    const minute = new Date(inv.created_at).toISOString().slice(0, 16);
    const key = `${minute}|${inv.sent_by}|${inv.survey_type}`;
    const arr = groups.get(key) || [];
    arr.push(inv);
    groups.set(key, arr);
  });
  const batches = Array.from(groups.values()).sort(
    (a, b) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime(),
  ).slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" />
          Recently Sent (last 7 days)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {batches.map((batch, idx) => {
            const first = batch[0];
            const typeLabel = first.survey_type === 'checkin' ? 'Check-In' : 'Post-Grad Plan';
            const sentCount = batch.filter(b => b.email_status === 'sent').length;
            const failedCount = batch.filter(b => b.email_status === 'failed').length;
            const completedCount = batch.filter(b => b.completed_at).length;
            return (
              <div key={idx} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{typeLabel}</Badge>
                  <span className="font-medium">{batch.length} recipient{batch.length === 1 ? '' : 's'}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">by {first.sender_name || 'staff'}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{new Date(first.created_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  {sentCount > 0 && (
                    <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300/40">
                      {sentCount} delivered
                    </Badge>
                  )}
                  {failedCount > 0 && (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                      {failedCount} failed
                    </Badge>
                  )}
                  {completedCount > 0 && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {completedCount} completed
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
