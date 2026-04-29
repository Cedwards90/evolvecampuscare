import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
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
    queryKey: queryKeys.students.detail(studentId),
    queryFn: async (): Promise<StudentDetail | null> => {
      if (!studentId) return null;

      // Round 1: profile, assignment, requests, appointments — all independent
      const [profileRes, assignmentRes, requestsRes, appointmentsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', studentId).single(),
        supabase
          .from('student_assignments')
          .select('id, case_manager_id, created_at, notes')
          .eq('student_id', studentId)
          .maybeSingle(),
        supabase
          .from('support_requests')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false }),
        supabase
          .from('appointments')
          .select('*')
          .eq('student_id', studentId)
          .order('scheduled_at', { ascending: false }),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (assignmentRes.error) throw assignmentRes.error;
      if (requestsRes.error) throw requestsRes.error;
      if (appointmentsRes.error) throw appointmentsRes.error;

      const profile = profileRes.data;
      const assignmentData = assignmentRes.data;
      const requests = requestsRes.data || [];
      const appointments = appointmentsRes.data || [];
      const requestIds = requests.map(r => r.id);

      // Round 2: case manager profile + recent activity — both depend on round 1
      const [cmProfileRes, updatesRes] = await Promise.all([
        assignmentData
          ? supabase
              .from('profiles')
              .select('*')
              .eq('user_id', assignmentData.case_manager_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        requestIds.length > 0
          ? supabase
              .from('request_updates')
              .select('*')
              .in('request_id', requestIds)
              .order('created_at', { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (updatesRes.error) throw updatesRes.error;

      const assignment = assignmentData
        ? {
            id: assignmentData.id,
            case_manager_id: assignmentData.case_manager_id,
            case_manager: (cmProfileRes.data as Profile | null) ?? null,
            assigned_at: assignmentData.created_at,
            notes: assignmentData.notes,
          }
        : null;

      const recentActivity = (updatesRes.data || []) as RequestUpdate[];

      // Stats
      const pendingStatuses = ['submitted', 'in_progress', 'escalated'];
      const pendingRequests = requests.filter(r => pendingStatuses.includes(r.status)).length;
      const resolvedRequests = requests.filter(r => r.status === 'resolved');

      let avgResolutionDays: number | null = null;
      if (resolvedRequests.length > 0) {
        const totalDays = resolvedRequests.reduce((sum, r) => {
          if (r.resolved_at) {
            const created = new Date(r.created_at);
            const resolved = new Date(r.resolved_at);
            return sum + (resolved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
          }
          return sum;
        }, 0);
        avgResolutionDays = Math.round((totalDays / resolvedRequests.length) * 10) / 10;
      }

      return {
        profile: profile as Profile,
        assignment,
        requests: requests as SupportRequest[],
        appointments: appointments as Appointment[],
        recentActivity,
        stats: {
          total_requests: requests.length,
          pending_requests: pendingRequests,
          resolved_requests: resolvedRequests.length,
          avg_resolution_days: avgResolutionDays,
        },
      };
    },
    enabled: !!studentId,
  });
}
