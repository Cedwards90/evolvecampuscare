import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DistributeSurveyParams {
  surveyType: 'checkin' | 'post_graduation_plan';
  recipientIds: string[];
  notes?: string;
  scheduledFor?: string;
}

export interface DistributeSurveyResult {
  scheduled: boolean;
  scheduledId?: string;
  scheduledFor?: string;
  sent?: number;
  failed?: number;
  skipped?: number;
  alreadyPending?: number;
}

export function useDistributeSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: DistributeSurveyParams): Promise<DistributeSurveyResult> => {
      const { data, error } = await supabase.functions.invoke('distribute-survey', {
        body: params,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as DistributeSurveyResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['survey-invitations'] });
      qc.invalidateQueries({ queryKey: ['pending-invitations-all'] });
      qc.invalidateQueries({ queryKey: ['scheduled-distributions'] });
    },
  });
}

export interface ScheduledDistribution {
  id: string;
  created_by: string;
  survey_type: string;
  recipient_ids: string[];
  notes: string | null;
  scheduled_for: string;
  status: 'scheduled' | 'processing' | 'complete' | 'failed' | 'cancelled';
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export function useScheduledDistributions() {
  return useQuery({
    queryKey: ['scheduled-distributions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_survey_distributions')
        .select('*')
        .order('scheduled_for', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ScheduledDistribution[];
    },
  });
}

export function useCancelScheduledDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_survey_distributions')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-distributions'] });
    },
  });
}
