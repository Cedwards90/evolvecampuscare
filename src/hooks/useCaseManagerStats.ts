import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, SupportRequest, RequestUpdate } from '@/types/database';

export interface CaseManagerStats {
  caseManager: Profile;
  activeRequests: number;
  resolvedRequests: number;
  emergencyRequests: number;
  escalatedRequests: number;
  avgResponseTimeHours: number;
  resolutionRate: number;
  requestsByCategory: Record<string, number>;
  requestsByPriority: Record<string, number>;
  recentActivity: RequestUpdate[];
  assignedRequests: SupportRequest[];
}

export function useCaseManagerStats(caseManagerId: string | undefined) {
  return useQuery({
    queryKey: ['case-manager-stats', caseManagerId],
    queryFn: async () => {
      if (!caseManagerId) throw new Error('Case manager ID required');

      // Fetch case manager profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', caseManagerId)
        .single();

      if (profileError) throw profileError;

      // Fetch all assigned requests
      const { data: requests, error: requestsError } = await supabase
        .from('support_requests')
        .select('*')
        .eq('assigned_case_manager_id', caseManagerId)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Fetch student profiles for the requests
      const studentIds = [...new Set((requests || []).map(r => r.student_id))];
      const { data: studentProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', studentIds);

      const studentMap = new Map((studentProfiles || []).map(p => [p.user_id, p]));

      // Enrich requests with student profiles
      const enrichedRequests = (requests || []).map(request => ({
        ...request,
        student: studentMap.get(request.student_id) as Profile | undefined,
      })) as SupportRequest[];

      // Fetch recent activity (request updates by this case manager)
      const { data: activity, error: activityError } = await supabase
        .from('request_updates')
        .select('*')
        .eq('user_id', caseManagerId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (activityError) throw activityError;

      // Fetch user profiles for activity
      const activityUserIds = [...new Set((activity || []).map(a => a.user_id))];
      const { data: activityProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', activityUserIds);

      const activityProfileMap = new Map((activityProfiles || []).map(p => [p.user_id, p]));

      const enrichedActivity = (activity || []).map(a => ({
        ...a,
        user: activityProfileMap.get(a.user_id) as Profile | undefined,
      })) as RequestUpdate[];

      // Calculate stats
      const activeRequests = enrichedRequests.filter(
        r => r.status !== 'resolved' && r.status !== 'cancelled'
      ).length;

      const resolvedRequests = enrichedRequests.filter(r => r.status === 'resolved').length;
      const emergencyRequests = enrichedRequests.filter(r => r.is_emergency).length;
      const escalatedRequests = enrichedRequests.filter(r => r.status === 'escalated').length;

      const totalRequests = enrichedRequests.length;
      const resolutionRate = totalRequests > 0 ? (resolvedRequests / totalRequests) * 100 : 0;

      // Calculate average response time (simplified - time from created to first update)
      let totalResponseTime = 0;
      let responseCount = 0;
      
      enrichedRequests.forEach(request => {
        if (request.updated_at && request.created_at) {
          const responseTime = new Date(request.updated_at).getTime() - new Date(request.created_at).getTime();
          totalResponseTime += responseTime;
          responseCount++;
        }
      });

      const avgResponseTimeHours = responseCount > 0 
        ? Math.round(totalResponseTime / responseCount / (1000 * 60 * 60)) 
        : 0;

      // Group by category
      const requestsByCategory: Record<string, number> = {};
      enrichedRequests.forEach(r => {
        requestsByCategory[r.category] = (requestsByCategory[r.category] || 0) + 1;
      });

      // Group by priority
      const requestsByPriority: Record<string, number> = {};
      enrichedRequests.forEach(r => {
        requestsByPriority[r.priority] = (requestsByPriority[r.priority] || 0) + 1;
      });

      return {
        caseManager: profile as Profile,
        activeRequests,
        resolvedRequests,
        emergencyRequests,
        escalatedRequests,
        avgResponseTimeHours,
        resolutionRate,
        requestsByCategory,
        requestsByPriority,
        recentActivity: enrichedActivity,
        assignedRequests: enrichedRequests,
      } satisfies CaseManagerStats;
    },
    enabled: !!caseManagerId,
  });
}

export function useCaseManagers() {
  return useQuery({
    queryKey: ['case-managers'],
    queryFn: async () => {
      // Get all users with case_manager role
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'case_manager');

      if (rolesError) throw rolesError;

      const userIds = roles?.map(r => r.user_id) || [];
      if (userIds.length === 0) return [];

      // Get their profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Get request counts for each
      const caseManagersWithStats = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { count: activeCount } = await supabase
            .from('support_requests')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_case_manager_id', profile.user_id)
            .not('status', 'in', '("resolved","cancelled")');

          const { count: emergencyCount } = await supabase
            .from('support_requests')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_case_manager_id', profile.user_id)
            .eq('is_emergency', true)
            .not('status', 'in', '("resolved","cancelled")');

          // Count assigned students
          const { count: studentCount } = await supabase
            .from('student_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('case_manager_id', profile.user_id);

          return {
            ...profile,
            active_requests: activeCount || 0,
            emergency_requests: emergencyCount || 0,
            assigned_students: studentCount || 0,
          };
        })
      );

      return caseManagersWithStats;
    },
  });
}
