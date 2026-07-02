import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Availability {
  id: string;
  case_manager_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  timezone: string;
  is_active: boolean;
}

export interface Blackout {
  id: string;
  case_manager_id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
}

export function useAvailability(caseManagerId?: string) {
  return useQuery({
    queryKey: ['availability', caseManagerId],
    queryFn: async (): Promise<Availability[]> => {
      if (!caseManagerId) return [];
      const { data, error } = await supabase
        .from('case_manager_availability')
        .select('*')
        .eq('case_manager_id', caseManagerId)
        .order('day_of_week');
      if (error) throw error;
      return (data || []) as Availability[];
    },
    enabled: !!caseManagerId,
  });
}

export function useBlackouts(caseManagerId?: string) {
  return useQuery({
    queryKey: ['blackouts', caseManagerId],
    queryFn: async (): Promise<Blackout[]> => {
      if (!caseManagerId) return [];
      const { data, error } = await supabase
        .from('appointment_blackouts')
        .select('*')
        .eq('case_manager_id', caseManagerId)
        .gte('end_at', new Date().toISOString())
        .order('start_at');
      if (error) throw error;
      return (data || []) as Blackout[];
    },
    enabled: !!caseManagerId,
  });
}

export function useSaveAvailability() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (row: Omit<Availability, 'id'> & { id?: string }) => {
      if (row.id) {
        const { error } = await supabase
          .from('case_manager_availability')
          .update({
            day_of_week: row.day_of_week,
            start_time: row.start_time,
            end_time: row.end_time,
            slot_minutes: row.slot_minutes,
            timezone: row.timezone,
            is_active: row.is_active,
          })
          .eq('id', row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('case_manager_availability').insert({
          case_manager_id: row.case_manager_id,
          day_of_week: row.day_of_week,
          start_time: row.start_time,
          end_time: row.end_time,
          slot_minutes: row.slot_minutes,
          timezone: row.timezone,
          is_active: row.is_active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['availability'] });
      toast({ title: 'Availability saved' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Failed', description: e.message }),
  });
}

export function useDeleteAvailability() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('case_manager_availability').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['availability'] });
      toast({ title: 'Removed' });
    },
  });
}

export function useSaveBlackout() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (row: Omit<Blackout, 'id'> & { id?: string }) => {
      if (row.id) {
        const { error } = await supabase
          .from('appointment_blackouts')
          .update({ start_at: row.start_at, end_at: row.end_at, reason: row.reason })
          .eq('id', row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('appointment_blackouts').insert({
          case_manager_id: row.case_manager_id,
          start_at: row.start_at,
          end_at: row.end_at,
          reason: row.reason,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blackouts'] });
      toast({ title: 'Blackout saved' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Failed', description: e.message }),
  });
}

export function useDeleteBlackout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointment_blackouts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blackouts'] });
    },
  });
}
