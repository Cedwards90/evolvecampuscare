import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { subDays, format, startOfDay, eachDayOfInterval } from 'date-fns';

export interface WorkloadTrend {
  date: string;
  studentCount: number;
  requestCount: number;
  resolvedCount: number;
}

export interface ResolutionTimeByCategory {
  category: string;
  avgHours: number;
  count: number;
}

export interface CaseManagerMetrics {
  id: string;
  name: string;
  activeStudents: number;
  activeRequests: number;
  resolvedThisMonth: number;
  avgResolutionHours: number;
}

export interface AnalyticsData {
  workloadTrends: WorkloadTrend[];
  resolutionByCategory: ResolutionTimeByCategory[];
  caseManagerMetrics: CaseManagerMetrics[];
  summary: {
    totalStudents: number;
    totalRequests: number;
    avgResolutionTime: number;
    resolutionRate: number;
  };
}

export function useAnalyticsData(days: number = 30) {
  return useQuery({
    queryKey: queryKeys.analytics.range(days),
    queryFn: async (): Promise<AnalyticsData> => {
      const startDate = subDays(new Date(), days);
      const dateRange = eachDayOfInterval({ start: startDate, end: new Date() });

      // Fetch all support requests
      const { data: requests, error: requestsError } = await supabase
        .from('support_requests')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (requestsError) throw requestsError;

      // Fetch student assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('student_assignments')
        .select('*, case_manager:profiles!student_assignments_case_manager_id_fkey(full_name)');

      if (assignmentsError) throw assignmentsError;

      // Fetch case managers
      const { data: caseManagerRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'case_manager');

      if (rolesError) throw rolesError;

      const caseManagerIds = caseManagerRoles?.map(r => r.user_id) || [];
      
      const { data: caseManagers, error: cmError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', caseManagerIds);

      if (cmError) throw cmError;

      // Calculate workload trends by day
      const workloadTrends: WorkloadTrend[] = dateRange.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayStart = startOfDay(date);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const dayRequests = (requests || []).filter(r => {
          const createdAt = new Date(r.created_at);
          return createdAt >= dayStart && createdAt <= dayEnd;
        });

        const resolvedRequests = (requests || []).filter(r => {
          if (!r.resolved_at) return false;
          const resolvedAt = new Date(r.resolved_at);
          return resolvedAt >= dayStart && resolvedAt <= dayEnd;
        });

        // Count unique students with assignments up to this date
        const studentCount = (assignments || []).filter(a => {
          const createdAt = new Date(a.created_at);
          return createdAt <= dayEnd;
        }).length;

        return {
          date: format(date, 'MMM dd'),
          studentCount,
          requestCount: dayRequests.length,
          resolvedCount: resolvedRequests.length,
        };
      });

      // Calculate resolution time by category
      const resolvedRequests = (requests || []).filter(r => r.resolved_at);
      const categoryStats: Record<string, { total: number; count: number }> = {};

      resolvedRequests.forEach(r => {
        const resolutionHours = 
          (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60);
        
        if (!categoryStats[r.category]) {
          categoryStats[r.category] = { total: 0, count: 0 };
        }
        categoryStats[r.category].total += resolutionHours;
        categoryStats[r.category].count++;
      });

      const resolutionByCategory: ResolutionTimeByCategory[] = Object.entries(categoryStats)
        .map(([category, stats]) => ({
          category: category.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
          avgHours: Math.round(stats.total / stats.count * 10) / 10,
          count: stats.count,
        }))
        .sort((a, b) => b.count - a.count);

      // Calculate case manager metrics
      const caseManagerMetrics: CaseManagerMetrics[] = (caseManagers || []).map(cm => {
        const cmAssignments = (assignments || []).filter(a => a.case_manager_id === cm.user_id);
        const cmRequests = (requests || []).filter(r => r.assigned_case_manager_id === cm.user_id);
        const activeRequests = cmRequests.filter(r => r.status !== 'resolved' && r.status !== 'cancelled');
        const resolvedThisMonth = cmRequests.filter(r => {
          if (!r.resolved_at) return false;
          const resolved = new Date(r.resolved_at);
          const monthAgo = subDays(new Date(), 30);
          return resolved >= monthAgo;
        });

        const totalResolutionTime = resolvedThisMonth.reduce((acc, r) => {
          return acc + (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime());
        }, 0);
        const avgResolutionHours = resolvedThisMonth.length > 0 
          ? totalResolutionTime / resolvedThisMonth.length / (1000 * 60 * 60)
          : 0;

        return {
          id: cm.user_id,
          name: cm.full_name || 'Unknown',
          activeStudents: cmAssignments.length,
          activeRequests: activeRequests.length,
          resolvedThisMonth: resolvedThisMonth.length,
          avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
        };
      }).sort((a, b) => b.activeRequests - a.activeRequests);

      // Calculate summary
      const totalStudents = new Set((assignments || []).map(a => a.student_id)).size;
      const totalRequests = (requests || []).length;
      const totalResolved = resolvedRequests.length;
      const resolutionRate = totalRequests > 0 ? (totalResolved / totalRequests) * 100 : 0;
      
      const avgResolutionMs = resolvedRequests.reduce((acc, r) => {
        return acc + (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime());
      }, 0);
      const avgResolutionTime = resolvedRequests.length > 0 
        ? avgResolutionMs / resolvedRequests.length / (1000 * 60 * 60)
        : 0;

      return {
        workloadTrends,
        resolutionByCategory,
        caseManagerMetrics,
        summary: {
          totalStudents,
          totalRequests,
          avgResolutionTime: Math.round(avgResolutionTime * 10) / 10,
          resolutionRate: Math.round(resolutionRate),
        },
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
