import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface StaffAppointment {
  id: string;
  student_id: string;
  case_manager_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link: string | null;
  status: string;
  request_id: string | null;
  student?: { user_id: string; full_name: string | null; email: string; organization_id: string | null };
  case_manager?: { user_id: string; full_name: string | null; email: string };
}

export function useStaffAppointments(opts?: { from?: Date; to?: Date; status?: string }) {
  const { user, role } = useAuth();

  return useQuery({
    queryKey: ['staff-appointments', user?.id, role, opts?.from?.toISOString(), opts?.to?.toISOString(), opts?.status],
    queryFn: async () => {
      if (!user?.id || !role) return [];

      let q = supabase
        .from('appointments')
        .select('*')
        .order('scheduled_at', { ascending: true });

      if (opts?.status && opts.status !== 'all') q = q.eq('status', opts.status);
      if (opts?.from) q = q.gte('scheduled_at', opts.from.toISOString());
      if (opts?.to) q = q.lte('scheduled_at', opts.to.toISOString());

      if (role === 'case_manager') {
        q = q.eq('case_manager_id', user.id);
      }
      // admins & org_admins: RLS on appointments already scopes visibility

      const { data, error } = await q;
      if (error) throw error;

      const ids = new Set<string>();
      (data || []).forEach((a) => {
        ids.add(a.student_id);
        ids.add(a.case_manager_id);
      });
      if (ids.size === 0) return (data || []) as StaffAppointment[];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, organization_id')
        .in('user_id', Array.from(ids));

      const pMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      return (data || []).map((a) => ({
        ...a,
        student: pMap.get(a.student_id),
        case_manager: pMap.get(a.case_manager_id),
      })) as StaffAppointment[];
    },
    enabled: !!user?.id && !!role,
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);
      if (error) throw error;

      // Fire-and-forget notification
      supabase.functions
        .invoke('create-calendar-event', {
          body: { mode: 'cancel', appointmentId },
        })
        .catch(() => void 0);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-appointments'] });
      qc.invalidateQueries({ queryKey: ['my-appointments'] });
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'Appointment cancelled', description: 'Participants have been notified.' });
    },
    onError: (e: Error) =>
      toast({ variant: 'destructive', title: 'Cancel failed', description: e.message }),
  });
}

export function useRescheduleAppointment() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (p: { appointmentId: string; scheduledAt: Date; durationMinutes: number; title?: string; description?: string }) => {
      const patch: Record<string, unknown> = {
        scheduled_at: p.scheduledAt.toISOString(),
        duration_minutes: p.durationMinutes,
      };
      if (p.title !== undefined) patch.title = p.title;
      if (p.description !== undefined) patch.description = p.description;

      const { error } = await supabase.from('appointments').update(patch).eq('id', p.appointmentId);
      if (error) throw error;

      supabase.functions
        .invoke('create-calendar-event', {
          body: { mode: 'update', appointmentId: p.appointmentId },
        })
        .catch(() => void 0);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-appointments'] });
      qc.invalidateQueries({ queryKey: ['my-appointments'] });
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'Appointment updated', description: 'Participants have been notified of the change.' });
    },
    onError: (e: Error) =>
      toast({ variant: 'destructive', title: 'Update failed', description: e.message }),
  });
}
