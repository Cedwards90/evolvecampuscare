import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type SendMode = 'student' | 'cohort' | 'organization';

interface SendSurveyArgs {
  surveyType: string;
  notes?: string;
  skipAlreadySent?: boolean;
  // Targeting — provide exactly one of these:
  studentId?: string;              // single student (back-compat)
  studentIds?: string[];           // explicit list
  cohortId?: string;               // all students in cohort
  organizationId?: string;         // all active students in org
  mode?: SendMode;                 // optional hint; inferred otherwise
}

const NOTIFICATION_MAP: Record<string, { title: string; message: string; link: string }> = {
  checkin: {
    title: 'Check-In Requested',
    message: 'Your case manager has requested you complete a check-in.',
    link: '/check-in',
  },
  post_graduation_plan: {
    title: 'Post-Graduation Plan Requested',
    message: 'Your case manager has requested you complete your 12-month post-graduation plan.',
    link: '/post-graduation-plan',
  },
  intake: {
    title: 'Intake Survey Requested',
    message: 'Your case manager has requested you complete the intake survey.',
    link: '/intake-survey',
  },
  career_intake: {
    title: 'Career Intake Requested',
    message: 'Your case manager has requested you complete the career intake survey.',
    link: '/onboarding/career-intake',
  },
};

async function resolveStudentIds(args: SendSurveyArgs): Promise<string[]> {
  if (args.studentIds?.length) return Array.from(new Set(args.studentIds));
  if (args.studentId) return [args.studentId];

  if (args.cohortId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, user_roles!inner(role)')
      .eq('cohort_id', args.cohortId)
      .eq('user_roles.role', 'student');
    if (error) throw error;
    return (data ?? []).map((r: any) => r.user_id);
  }

  if (args.organizationId) {
    const { data, error } = await supabase
      .from('organization_memberships')
      .select('user_id, user_roles!inner(role)')
      .eq('organization_id', args.organizationId)
      .is('left_at', null)
      .eq('user_roles.role', 'student');
    if (error) throw error;
    return Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
  }

  return [];
}

export function useSendSurvey() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (args: SendSurveyArgs) => {
      const { surveyType, notes, skipAlreadySent = true } = args;
      let targets = await resolveStudentIds(args);

      if (targets.length === 0) {
        return { assigned: 0, skipped: 0 };
      }

      let skipped = 0;
      if (skipAlreadySent) {
        const { data: existing, error: exErr } = await supabase
          .from('survey_invitations')
          .select('student_id')
          .in('student_id', targets)
          .eq('survey_type', surveyType)
          .is('completed_at', null);
        if (exErr) throw exErr;
        const already = new Set((existing ?? []).map((r: any) => r.student_id));
        const before = targets.length;
        targets = targets.filter((id) => !already.has(id));
        skipped = before - targets.length;
      }

      if (targets.length === 0) {
        return { assigned: 0, skipped };
      }

      const invRows = targets.map((sid) => ({
        student_id: sid,
        survey_type: surveyType,
        sent_by: user!.id,
        notes: notes || null,
      }));
      const { error: invErr } = await supabase.from('survey_invitations').insert(invRows);
      if (invErr) throw invErr;

      const notif = NOTIFICATION_MAP[surveyType] || {
        title: 'Survey Requested',
        message: 'Your case manager has requested you complete a survey.',
        link: '/surveys',
      };
      const noteRows = targets.map((sid) => ({
        user_id: sid,
        type: 'survey_request',
        title: notif.title,
        message: notif.message,
        link: notif.link,
      }));
      await supabase.from('notifications').insert(noteRows);

      return { assigned: targets.length, skipped };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['pending-surveys'] });
    },
  });
}

export function usePendingSurveys() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pending-surveys', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_invitations')
        .select('*')
        .eq('student_id', user!.id)
        .is('completed_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useStudentSurveyHistory(studentId?: string) {
  return useQuery({
    queryKey: ['survey-invitations', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_invitations')
        .select('*')
        .eq('student_id', studentId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
  });
}

export function useMarkSurveyComplete() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (surveyType: string) => {
      const { data: pending } = await supabase
        .from('survey_invitations')
        .select('id')
        .eq('student_id', user!.id)
        .eq('survey_type', surveyType)
        .is('completed_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (pending && pending.length > 0) {
        const { error } = await supabase
          .from('survey_invitations')
          .update({ completed_at: new Date().toISOString() })
          .eq('id', pending[0].id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-surveys'] });
      queryClient.invalidateQueries({ queryKey: ['survey-invitations'] });
    },
  });
}
