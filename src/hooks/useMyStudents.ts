import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/types/database';

export interface MyStudent {
  id: string;
  student_id: string;
  student: Profile;
  assigned_at: string;
  pending_requests: number;
  total_requests: number;
  last_activity: string | null;
}

export function useMyStudents(caseManagerId: string | undefined) {
  return useQuery({
    queryKey: ['my-students', caseManagerId],
    queryFn: async () => {
      if (!caseManagerId) return [];

      // Fetch student assignments for this case manager
      const { data: assignments, error: assignmentError } = await supabase
        .from('student_assignments')
        .select('id, student_id, created_at')
        .eq('case_manager_id', caseManagerId);

      if (assignmentError) throw assignmentError;
      if (!assignments || assignments.length === 0) return [];

      const studentIds = assignments.map(a => a.student_id);

      // Fetch profiles for these students
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', studentIds);

      if (profileError) throw profileError;

      // Fetch request counts for each student
      const { data: requests, error: requestError } = await supabase
        .from('support_requests')
        .select('id, student_id, status, updated_at')
        .in('student_id', studentIds);

      if (requestError) throw requestError;

      // Build the enriched student list
      const myStudents: MyStudent[] = assignments.map(assignment => {
        const profile = profiles?.find(p => p.user_id === assignment.student_id);
        const studentRequests = requests?.filter(r => r.student_id === assignment.student_id) || [];
        const pendingRequests = studentRequests.filter(r => 
          ['submitted', 'in_progress', 'escalated'].includes(r.status)
        ).length;
        const lastActivity = studentRequests.length > 0 
          ? studentRequests.sort((a, b) => 
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            )[0]?.updated_at 
          : null;

        return {
          id: assignment.id,
          student_id: assignment.student_id,
          student: profile as Profile,
          assigned_at: assignment.created_at,
          pending_requests: pendingRequests,
          total_requests: studentRequests.length,
          last_activity: lastActivity,
        };
      });

      return myStudents;
    },
    enabled: !!caseManagerId,
  });
}
