import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ServiceType, TimeEntryStatus } from './useTimeEntries';

export interface TimeEntryInput {
  case_manager_id: string;
  student_id: string | null;
  entry_date: string;
  start_time: string;
  end_time: string;
  service_type: ServiceType;
  notes?: string | null;
  billable: boolean;
}

export function useCreateTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TimeEntryInput) => {
      const { data, error } = await (supabase.from('time_entries' as any) as any)
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-entries'] }),
  });
}

export function useUpdateTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TimeEntryInput> }) => {
      const { data, error } = await (supabase.from('time_entries' as any) as any)
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-entries'] }),
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('time_entries' as any) as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-entries'] }),
  });
}

export function useReviewTimeEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      status,
      review_note,
    }: {
      ids: string[];
      status: TimeEntryStatus;
      review_note?: string | null;
    }) => {
      const { error } = await (supabase.from('time_entries' as any) as any)
        .update({ status, review_note: review_note ?? null })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-entries'] }),
  });
}
