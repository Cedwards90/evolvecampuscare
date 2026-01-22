import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, SupportRequest, Appointment, RequestUpdate } from '@/types/database';

export interface StudentDetail {
  profile: Profile;
  assignment: {
    id: string;
    case_manager_id: string;
    case_manager: Profile | null;
    assigned_at: string;
    notes: string | null;
  } | null;
  requests: SupportRequest[];
  appointments: Appointment[];
  recentActivity: RequestUpdate[];
  stats: {
    total_requests: number;
    pending_requests: number;
    resolved_requests: number;
    avg_resolution_days: number | null;
  };
}

export function useStudentDetail(studentId: string | undefined) {
  return useQuery({
    queryKey: ['student-detail', studentId],
    queryFn: async (): Promise<StudentDetail | null> => {
      if (!studentId) return null;

      // Fetch student profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', studentId)
        .single();

      if (profileError) throw profileError;

      // Fetch assignment info
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('student_assignments')
        .select('id, case_manager_id, created_at, notes')
        .eq('student_id', studentId)
        .maybeSingle();

      if (assignmentError) throw assignmentError;

      let assignment = null;
      if (assignmentData) {
        // Fetch case manager profile
        const { data: cmProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', assignmentData.case_manager_id)
          .single();

        assignment = {
          id: assignmentData.id,
          case_manager_id: assignmentData.case_manager_id,
          case_manager: cmProfile as Profile | null,
          assigned_at: assignmentData.created_at,
          notes: assignmentData.notes,
        };
      }

      // Fetch all requests for this student
      const { data: requests, error: requestError } = await supabase
        .from('support_requests')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (requestError) throw requestError;

      // Fetch appointments
      const { data: appointments, error: appointmentError } = await supabase
        .from('appointments')
        .select('*')
        .eq('student_id', studentId)
        .order('scheduled_at', { ascending: false });

      if (appointmentError) throw appointmentError;

      // Fetch recent activity (request updates)
      const requestIds = (requests || []).map(r => r.id);
      let recentActivity: RequestUpdate[] = [];
      
      if (requestIds.length > 0) {
        const { data: updates, error: updateError } = await supabase
          .from('request_updates')
          .select('*')
          .in('request_id', requestIds)
          .order('created_at', { ascending: false })
          .limit(20);

        if (updateError) throw updateError;
        recentActivity = (updates || []) as RequestUpdate[];
      }

      // Calculate stats
      const pendingStatuses = ['submitted', 'in_progress', 'escalated'];
      const pendingRequests = (requests || []).filter(r => pendingStatuses.includes(r.status)).length;
      const resolvedRequests = (requests || []).filter(r => r.status === 'resolved');
      
      let avgResolutionDays: number | null = null;
      if (resolvedRequests.length > 0) {
        const totalDays = resolvedRequests.reduce((sum, r) => {
          if (r.resolved_at) {
            const created = new Date(r.created_at);
            const resolved = new Date(r.resolved_at);
            const days = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
          }
          return sum;
        }, 0);
        avgResolutionDays = Math.round((totalDays / resolvedRequests.length) * 10) / 10;
      }

      return {
        profile: profile as Profile,
        assignment,
        requests: (requests || []) as SupportRequest[],
        appointments: (appointments || []) as Appointment[],
        recentActivity,
        stats: {
          total_requests: (requests || []).length,
          pending_requests: pendingRequests,
          resolved_requests: resolvedRequests.length,
          avg_resolution_days: avgResolutionDays,
        },
      };
    },
    enabled: !!studentId,
  });
}
