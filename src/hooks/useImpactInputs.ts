import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CostSettingInput {
  id?: string;
  organization_id?: string | null;
  period_start: string;
  period_end: string;
  annual_program_cost: number;
  cost_per_participant_override?: number | null;
  avg_public_benefit_offset?: number | null;
  currency?: string;
  notes?: string | null;
}

export function useUpsertCostSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CostSettingInput) => {
      const payload: any = {
        organization_id: input.organization_id || null,
        period_start: input.period_start,
        period_end: input.period_end,
        annual_program_cost: input.annual_program_cost,
        cost_per_participant_override: input.cost_per_participant_override ?? null,
        avg_public_benefit_offset: input.avg_public_benefit_offset ?? null,
        currency: input.currency || 'USD',
        notes: input.notes ?? null,
      };
      if (input.id) {
        const { error } = await supabase
          .from('program_cost_settings')
          .update(payload)
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('program_cost_settings').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['impact-analytics'] });
      qc.invalidateQueries({ queryKey: ['program-cost-settings'] });
      toast.success('Cost settings saved');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });
}

export function useDeleteCostSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('program_cost_settings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['impact-analytics'] });
      qc.invalidateQueries({ queryKey: ['program-cost-settings'] });
      toast.success('Cost period removed');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete'),
  });
}

export function useStudentsForOutcomes(studentIds: string[]) {
  return useQuery({
    queryKey: ['students-for-outcomes', studentIds.sort().join(',')],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const [{ data: profiles }, { data: outcomes }] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', studentIds),
        supabase.from('participant_outcomes').select('*').in('student_id', studentIds),
      ]);
      const outcomeMap = new Map<string, any>(
        (outcomes || []).map((o: any) => [o.student_id, o]),
      );
      return (profiles || []).map((p: any) => ({
        student_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        outcome: outcomeMap.get(p.user_id) || null,
      }));
    },
  });
}

export interface OutcomeInput {
  student_id: string;
  employment_status?: string | null;
  job_title?: string | null;
  employer?: string | null;
  placement_date?: string | null;
  hourly_wage?: number | null;
  weekly_hours?: number | null;
  baseline_wage?: number | null;
  program_completed?: boolean;
  program_completion_date?: string | null;
  completion_reason?: string | null;
  retention_30_met?: boolean;
  retention_60_met?: boolean;
  retention_90_met?: boolean;
  retention_180_met?: boolean;
  retention_365_met?: boolean;
}

export function useUpsertOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: OutcomeInput) => {
      const { data: existing } = await supabase
        .from('participant_outcomes')
        .select('id')
        .eq('student_id', input.student_id)
        .maybeSingle();
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = { ...input, updated_by: user?.id };
      if (existing?.id) {
        const { error } = await supabase
          .from('participant_outcomes')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('participant_outcomes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['impact-analytics'] });
      qc.invalidateQueries({ queryKey: ['students-for-outcomes'] });
      toast.success('Outcome saved');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save outcome'),
  });
}
