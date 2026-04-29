import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import type { SupportRequest, RequestStatus, RequestPriority, RequestCategory, Profile } from '@/types/database';

export interface RequestFilters {
  status?: RequestStatus | 'all';
  priority?: RequestPriority | 'all';
  category?: RequestCategory | 'all';
  isEmergency?: boolean;
  search?: string;
  assignedCaseManagerId?: string;
  studentId?: string;
}

export function useRequests(filters: RequestFilters = {}) {
  return useQuery({
    queryKey: queryKeys.requests.list(filters),
    queryFn: async () => {
      let query = supabase
        .from('support_requests')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      
      if (filters.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority);
      }
      
      if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }
      
      if (filters.isEmergency !== undefined) {
        query = query.eq('is_emergency', filters.isEmergency);
      }
      
      if (filters.assignedCaseManagerId) {
        query = query.eq('assigned_case_manager_id', filters.assignedCaseManagerId);
      }
      
      if (filters.studentId) {
        query = query.eq('student_id', filters.studentId);
      }
      
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data: requests, error } = await query;

      if (error) throw error;
      
      // Fetch profiles for students and case managers
      const studentIds = [...new Set((requests || []).map(r => r.student_id))];
      const caseManagerIds = [...new Set((requests || []).filter(r => r.assigned_case_manager_id).map(r => r.assigned_case_manager_id!))];
      const allUserIds = [...new Set([...studentIds, ...caseManagerIds])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', allUserIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      // Enrich requests with profiles
      const enrichedRequests = (requests || []).map(request => ({
        ...request,
        student: profileMap.get(request.student_id) as Profile | undefined,
        case_manager: request.assigned_case_manager_id 
          ? profileMap.get(request.assigned_case_manager_id) as Profile | undefined
          : undefined,
      }));

      return enrichedRequests as SupportRequest[];
    },
  });
}

export function useRequestsByCategory(category: RequestCategory) {
  return useRequests({ category });
}

export function useRequestsByStatus(status: RequestStatus) {
  return useRequests({ status });
}

export function useEmergencyRequests() {
  return useRequests({ isEmergency: true });
}
