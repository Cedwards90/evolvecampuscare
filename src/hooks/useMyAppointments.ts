import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useMyAppointments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-appointments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('student_id', user.id)
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      // Fetch case manager profiles
      const cmIds = [...new Set((data || []).map(a => a.case_manager_id))];
      if (cmIds.length === 0) return data || [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', cmIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      return (data || []).map(apt => ({
        ...apt,
        case_manager: profileMap.get(apt.case_manager_id),
      }));
    },
    enabled: !!user?.id,
  });
}
