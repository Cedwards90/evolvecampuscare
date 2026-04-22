import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTrainingOrganizations } from '@/hooks/useTrainingOrganizations';
import { toast } from 'sonner';

interface BulkCohortSurveyDialogProps {
  /** When provided, restricts the cohort recipient pool to this set of student IDs (for case manager scope). */
  scopedStudentIds?: string[];
  trigger?: React.ReactNode;
}

interface StudentRow {
  user_id: string;
  cohort_start_date: string | null;
  organization_id: string | null;
}

export function BulkCohortSurveyDialog({ scopedStudentIds, trigger }: BulkCohortSurveyDialogProps) {
  const [open, setOpen] = useState(false);
  const [surveyType, setSurveyType] = useState('');
  const [cohort, setCohort] = useState('all');
  const [orgId, setOrgId] = useState('all');
  const [notes, setNotes] = useState('');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: organizations } = useTrainingOrganizations();

  // Pull all student profiles (RLS will scope what staff can see).
  const { data: students } = useQuery({
    queryKey: ['cohort-survey-students', scopedStudentIds?.join(',') ?? 'all'],
    queryFn: async () => {
      const { data: roleRows, error: rolesErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');
      if (rolesErr) throw rolesErr;
      let studentIds = (roleRows ?? []).map((r) => r.user_id);
      if (scopedStudentIds) {
        const allowed = new Set(scopedStudentIds);
        studentIds = studentIds.filter((id) => allowed.has(id));
      }
      if (studentIds.length === 0) return [] as StudentRow[];

      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('user_id, cohort_start_date, organization_id')
        .in('user_id', studentIds);
      if (profErr) throw profErr;
      return (profiles ?? []) as StudentRow[];
    },
    enabled: open,
  });

  const cohortOptions = useMemo(() => {
    const set = new Set<string>();
    (students ?? []).forEach((s) => {
      if (s.cohort_start_date) set.add(s.cohort_start_date);
    });
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [students]);

  const recipients = useMemo(() => {
    return (students ?? []).filter((s) => {
      if (cohort !== 'all' && s.cohort_start_date !== cohort) return false;
      if (orgId !== 'all' && s.organization_id !== orgId) return false;
      return true;
    });
  }, [students, cohort, orgId]);

  const sendBulk = useMutation({
    mutationFn: async () => {
      if (!surveyType) throw new Error('Survey type required');
      if (recipients.length === 0) throw new Error('No recipients');

      const recipientIds = recipients.map((r) => r.user_id);

      // Skip students with an existing incomplete invitation of the same type
      const { data: existing, error: existErr } = await supabase
        .from('survey_invitations')
        .select('student_id')
        .eq('survey_type', surveyType)
        .is('completed_at', null)
        .in('student_id', recipientIds);
      if (existErr) throw existErr;
      const skip = new Set((existing ?? []).map((r) => r.student_id));
      const toSend = recipientIds.filter((id) => !skip.has(id));

      if (toSend.length === 0) {
        return { sent: 0, skipped: skip.size, emailSent: 0, emailFailed: 0, emailSkipped: 0 };
      }

      const invitations = toSend.map((studentId) => ({
        student_id: studentId,
        survey_type: surveyType,
        sent_by: user!.id,
        notes: notes.trim() || null,
        email_status: 'pending',
      }));
      const { error: insErr } = await supabase.from('survey_invitations').insert(invitations);
      if (insErr) throw insErr;

      // In-app notifications
      const title = surveyType === 'checkin' ? 'Check-In Requested' : 'Post-Graduation Plan Requested';
      const message =
        surveyType === 'checkin'
          ? 'Your case manager has requested you complete a check-in.'
          : 'Your case manager has requested you complete your 12-month post-graduation plan.';
      const link = surveyType === 'checkin' ? '/check-in' : '/post-graduation-plan';
      const notifs = toSend.map((studentId) => ({
        user_id: studentId,
        type: 'survey_request',
        title,
        message,
        link,
      }));
      // Best-effort; ignore notif errors so survey send still succeeds
      await supabase.from('notifications').insert(notifs);

      // Best-effort email dispatch via edge function
      let emailSent = 0;
      let emailFailed = 0;
      let emailSkipped = 0;
      try {
        const { data: emailRes, error: emailErr } = await supabase.functions.invoke(
          'send-survey-invitation',
          {
            body: {
              studentIds: toSend,
              surveyType,
              notes: notes.trim() || undefined,
            },
          },
        );
        if (emailErr) {
          console.warn('Email dispatch failed:', emailErr);
          emailFailed = toSend.length;
        } else {
          emailSent = emailRes?.sent ?? 0;
          emailFailed = emailRes?.failed ?? 0;
          emailSkipped = emailRes?.skipped ?? 0;
        }
      } catch (err) {
        console.warn('Email dispatch threw:', err);
        emailFailed = toSend.length;
      }

      return { sent: toSend.length, skipped: skip.size, emailSent, emailFailed, emailSkipped };
    },
    onSuccess: ({ sent, skipped, emailSent, emailFailed, emailSkipped }) => {
      queryClient.invalidateQueries({ queryKey: ['survey-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['pending-surveys'] });
      queryClient.invalidateQueries({ queryKey: ['pending-invitations-all'] });
      if (sent === 0) {
        toast.info(`No new surveys sent. ${skipped} student(s) already had a pending request.`);
      } else {
        const parts = [`Sent to ${sent} student${sent === 1 ? '' : 's'}`];
        parts.push(`${emailSent} email${emailSent === 1 ? '' : 's'} delivered`);
        if (emailFailed) parts.push(`${emailFailed} failed`);
        if (emailSkipped) parts.push(`${emailSkipped} skipped (no email)`);
        if (skipped) parts.push(`${skipped} already pending`);
        toast.success(parts.join(' · '));
      }
      setOpen(false);
      setSurveyType('');
      setCohort('all');
      setOrgId('all');
      setNotes('');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to send surveys.');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Users className="mr-2 h-4 w-4" />
            Send to Cohort
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Send Survey</DialogTitle>
          <DialogDescription>
            Send a survey request to an entire cohort or filtered group of students at once.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Survey Type</Label>
            <Select value={surveyType} onValueChange={setSurveyType}>
              <SelectTrigger>
                <SelectValue placeholder="Select a survey…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checkin">3-Week Check-In</SelectItem>
                <SelectItem value="post_graduation_plan">12-Month Post-Graduation Plan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cohort</Label>
            <Select value={cohort} onValueChange={setCohort}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cohorts</SelectItem>
                {cohortOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {format(new Date(d), 'MMMM yyyy')} Cohort
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {organizations && organizations.length > 0 && (
            <div className="space-y-2">
              <Label>Organization (optional)</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All organizations</SelectItem>
                  {organizations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Add any context or instructions for students…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            This will send to{' '}
            <span className="font-semibold text-foreground">{recipients.length}</span>{' '}
            student{recipients.length === 1 ? '' : 's'}.
            {recipients.length === 0 && ' Adjust filters to select recipients.'}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => sendBulk.mutate()}
            disabled={sendBulk.isPending || !surveyType || recipients.length === 0}
          >
            {sendBulk.isPending ? 'Sending…' : `Send to ${recipients.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
