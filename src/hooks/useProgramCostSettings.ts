import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProgramCostSetting {
  id: string;
  organization_id: string | null;
  period_start: string;
  period_end: string;
  annual_program_cost: number;
  cost_per_participant_override: number | null;
  avg_public_benefit_offset: number | null;
  currency: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ProgramCostInput = Omit<
  ProgramCostSetting,
  'id' | 'created_at' | 'updated_at' | 'created_by'
>;

export function useProgramCostSettings(organizationId?: string | null) {
  return useQuery({
    queryKey: ['program-cost-settings', organizationId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('program_cost_settings')
        .select('*')
        .order('period_start', { ascending: false });
      if (organizationId !== undefined) {
        if (organizationId === null) {
          q = q.is('organization_id', null);
        } else {
          q = q.eq('organization_id', organizationId);
        }
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ProgramCostSetting[];
    },
  });
}

export function useUpsertProgramCostSetting() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: ProgramCostInput & { id?: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const actorId = userRes?.user?.id ?? null;
      if (input.id) {
        const { id, ...rest } = input;
        const { data, error } = await supabase
          .from('program_cost_settings')
          .update(rest as any)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('program_cost_settings')
        .insert({ ...input, created_by: actorId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['program-cost-settings'] });
      toast({ title: 'Cost settings saved' });
    },
    onError: (e: any) =>
      toast({
        title: 'Failed to save cost settings',
        description: e?.message,
        variant: 'destructive',
      }),
  });
}

export function useDeleteProgramCostSetting() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('program_cost_settings')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['program-cost-settings'] });
      toast({ title: 'Cost settings deleted' });
    },
    onError: (e: any) =>
      toast({
        title: 'Failed to delete',
        description: e?.message,
        variant: 'destructive',
      }),
  });
}
