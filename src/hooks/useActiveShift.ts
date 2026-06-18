import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ActiveShift {
  case_manager_id: string;
  start_time: string;
  student_id: string | null;
  service_type: string;
  notes: string | null;
  created_at: string;
}

export function useActiveShift(userId: string | undefined) {
  return useQuery({
    queryKey: ['active-shift', userId],
    enabled: !!userId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<ActiveShift | null> => {
      const { data, error } = await supabase
        .from('active_time_sessions')
        .select('*')
        .eq('case_manager_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as ActiveShift) ?? null;
    },
  });
}

interface ClockInArgs {
  student_id?: string | null;
  service_type?: string;
  notes?: string | null;
}
interface ClockOutArgs {
  notes?: string | null;
  billable?: boolean;
}

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: ClockInArgs) => {
      const { data, error } = await supabase.functions.invoke('time-clock', {
        body: { action: 'clock_in', ...args },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-shift'] });
    },
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: ClockOutArgs) => {
      const { data, error } = await supabase.functions.invoke('time-clock', {
        body: { action: 'clock_out', ...args },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-shift'] });
      qc.invalidateQueries({ queryKey: ['time-entries'] });
    },
  });
}

export function useCancelShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('time-clock', {
        body: { action: 'cancel' },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-shift'] }),
  });
}
