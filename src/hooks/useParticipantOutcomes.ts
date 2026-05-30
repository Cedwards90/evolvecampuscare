import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logFunnelEvent } from '@/lib/funnelEvents';

export interface ParticipantOutcome {
  id: string;
  student_id: string;
  employment_status: string | null;
  employer: string | null;
  job_title: string | null;
  placement_date: string | null;
  hourly_wage: number | null;
  weekly_hours: number | null;
  baseline_wage: number | null;
  program_completed: boolean | null;
  program_completion_date: string | null;
  completion_reason: string | null;
  retention_30_met: boolean | null;
  retention_30_date: string | null;
  retention_60_met: boolean | null;
  retention_60_date: string | null;
  retention_90_met: boolean | null;
  retention_90_date: string | null;
  retention_180_met: boolean | null;
  retention_180_date: string | null;
  retention_365_met: boolean | null;
  retention_365_date: string | null;
  updated_at: string;
  updated_by: string | null;
}

export type OutcomeUpsert = Partial<Omit<ParticipantOutcome, 'id' | 'updated_at' | 'updated_by'>> & {
  student_id: string;
};

export function useParticipantOutcomes(studentId?: string) {
  return useQuery({
    queryKey: ['participant-outcomes', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participant_outcomes')
        .select('*')
        .eq('student_id', studentId!)
        .order('updated_at', { ascending: false })
        .maybeSingle();
      if (error) throw error;
      return data as ParticipantOutcome | null;
    },
  });
}

export function useUpsertParticipantOutcome() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: OutcomeUpsert & { organizationId?: string | null }) => {
      const { organizationId, ...rest } = payload;
      const { data: userRes } = await supabase.auth.getUser();
      const actorId = userRes?.user?.id ?? null;

      // Find existing row
      const { data: existing } = await supabase
        .from('participant_outcomes')
        .select('id, placement_date')
        .eq('student_id', rest.student_id)
        .maybeSingle();

      const row = { ...rest, updated_by: actorId };

      let result;
      if (existing) {
        result = await supabase
          .from('participant_outcomes')
          .update(row as any)
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('participant_outcomes')
          .insert(row as any)
          .select()
          .single();
      }
      if (result.error) throw result.error;

      // Fire funnel event when placement_date is newly set
      const placementJustSet =
        !!rest.placement_date && (!existing || !existing.placement_date);
      if (placementJustSet) {
        logFunnelEvent({
          eventType: 'placement_recorded',
          userId: rest.student_id,
          organizationId: organizationId ?? null,
          metadata: { placement_date: rest.placement_date },
        });
      }

      return result.data as ParticipantOutcome;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['participant-outcomes', vars.student_id] });
      qc.invalidateQueries({ queryKey: ['student-detail', vars.student_id] });
      toast({ title: 'Outcomes saved' });
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to save outcomes',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });
}
