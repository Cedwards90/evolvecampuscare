import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SendResult {
  sent: number;
  failed: number;
  skipped: number;
}

async function dispatchEmails(args: {
  studentIds: string[];
  surveyType: string;
  notes?: string;
  isReminder?: boolean;
}): Promise<SendResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-survey-invitation', {
      body: args,
    });
    if (error) {
      console.warn('send-survey-invitation invoke error:', error);
      return { sent: 0, failed: args.studentIds.length, skipped: 0 };
    }
    return {
      sent: data?.sent ?? 0,
      failed: data?.failed ?? 0,
      skipped: data?.skipped ?? 0,
    };
  } catch (err) {
    console.warn('send-survey-invitation threw:', err);
    return { sent: 0, failed: args.studentIds.length, skipped: 0 };
  }
}

export function useSendSurvey() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ studentId, surveyType, notes }: { studentId: string; surveyType: string; notes?: string }): Promise<SendResult> => {
      const { error } = await supabase.from('survey_invitations').insert({
        student_id: studentId,
        survey_type: surveyType,
        sent_by: user!.id,
        notes: notes || null,
        email_status: 'pending',
      });
      if (error) throw error;

      // Email + in-app notification handled by edge function (uses service role to bypass RLS)
      return await dispatchEmails({ studentIds: [studentId], surveyType, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['pending-surveys'] });
      queryClient.invalidateQueries({ queryKey: ['pending-invitations-all'] });
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

export function useCancelInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('survey_invitations')
        .delete()
        .eq('id', invitationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invitations-all'] });
      queryClient.invalidateQueries({ queryKey: ['survey-invitations'] });
    },
  });
}

export function useResendInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, surveyType }: { studentId: string; surveyType: string }): Promise<SendResult> => {
      // Email + in-app reminder notification handled by edge function (uses service role)
      return await dispatchEmails({ studentIds: [studentId], surveyType, isReminder: true });
    },
    onSuccess: (result, variables) => {
      // Optimistically reset the row's last-sent timestamp so the "Today"/days
      // badge and Sent date update immediately, without waiting for the refetch.
      const nowIso = new Date().toISOString();
      queryClient.setQueryData<any[]>(['pending-invitations-all'], (prev) => {
        if (!prev) return prev;
        return prev.map((inv) => {
          if (inv.student_id !== variables.studentId || inv.survey_type !== variables.surveyType) {
            return inv;
          }
          return {
            ...inv,
            email_sent_at: nowIso,
            email_status: result.sent > 0 ? 'sent' : result.failed > 0 ? 'failed' : inv.email_status,
            email_error: result.failed > 0 ? inv.email_error : null,
          };
        });
      });
      queryClient.invalidateQueries({ queryKey: ['pending-invitations-all'] });
      queryClient.invalidateQueries({ queryKey: ['recently-sent-invitations'] });
    },
  });
}
