import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useSendSurvey() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ studentId, surveyType, notes }: { studentId: string; surveyType: string; notes?: string }) => {
      const { error } = await supabase.from('survey_invitations').insert({
        student_id: studentId,
        survey_type: surveyType,
        sent_by: user!.id,
        notes: notes || null,
      });
      if (error) throw error;

      // Create in-app notification for the student
      const map: Record<string, { title: string; message: string; link: string }> = {
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
      const { title, message, link } = map[surveyType] || {
        title: 'Survey Requested',
        message: 'Your case manager has requested you complete a survey.',
        link: '/surveys',
      };

      await supabase.from('notifications').insert({
        user_id: studentId,
        type: 'survey_request',
        title,
        message,
        link,
      });
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
      // Mark the most recent uncompleted invitation of this type
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
