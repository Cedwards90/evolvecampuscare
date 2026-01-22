import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile } from '@/types/database';

export interface MyAssignment {
  id: string;
  case_manager_id: string;
  case_manager: Profile;
  created_at: string;
}

export function useMyAssignment() {
  const { user, role } = useAuth();

  return useQuery({
    queryKey: ['my-assignment', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Fetch the student's assignment
      const { data: assignment, error } = await supabase
        .from('student_assignments')
        .select('*')
        .eq('student_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!assignment) return null;

      // Fetch the case manager's profile
      const { data: caseManagerProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', assignment.case_manager_id)
        .single();

      if (profileError) throw profileError;

      return {
        id: assignment.id,
        case_manager_id: assignment.case_manager_id,
        case_manager: caseManagerProfile as Profile,
        created_at: assignment.created_at,
      } as MyAssignment;
    },
    enabled: !!user?.id && role === 'student',
  });
}
