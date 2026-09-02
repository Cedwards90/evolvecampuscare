import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format, startOfDay, eachDayOfInterval } from 'date-fns';
import type { GlobalFilters } from '@/contexts/GlobalFiltersContext';

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
  avgResolutionHours: number | null;
}

/** Provenance so every figure can be traced back to its inputs. */
export interface AnalyticsMeta {
  generatedAt: string;
  rangeLabel: string;
  rowCount: number;
  truncated: boolean;
  /** Filters that were actually applied, for display. */
  appliedFilterLabels: string[];
}

export interface AnalyticsData {
  workloadTrends: WorkloadTrend[];
  resolutionByCategory: ResolutionTimeByCategory[];
  caseManagerMetrics: CaseManagerMetrics[];
  summary: {
    totalStudents: number;
    totalRequests: number;
    /** Null when no request was resolved — never shown as 0h. */
    avgResolutionTime: number | null;
    /** Null when the denominator is empty. */
    resolutionRate: number | null;
    fundsDispersed: number;
  };
  meta: AnalyticsMeta;
}

/** Hard ceiling so a huge org can't hang the browser; surfaced via meta.truncated. */
const ROW_CAP = 5000;

const REQUEST_COLUMNS = `
  id, student_id, assigned_case_manager_id, category, priority, status,
  created_at, resolved_at, requested_amount, approved_amount, approval_status,
  student:profiles!support_requests_student_id_fkey(user_id, organization_id, cohort_id, year_of_study)
`;

function emptyFilters(f?: Partial<GlobalFilters>): GlobalFilters {
  return {
    cohort: [],
    yearOfStudy: [],
    organizationId: [],
    status: [],
    role: [],
    assignedCaseManagerId: [],
    studentStatus: [],
    program: [],
    ...(f as GlobalFilters | undefined),
  } as GlobalFilters;
}

/**
 * Analytics for the admin dashboard.
 *
 * Filters are pushed to the database wherever the column lives on
 * support_requests, and applied to the nested student record otherwise, so the
 * numbers always match the filter bar above them.
 */
export function useAnalyticsData(days: number = 30, filters?: GlobalFilters) {
  const f = emptyFilters(filters);

  return useQuery({
    queryKey: ['analytics', days, f],
    queryFn: async (): Promise<AnalyticsData> => {
      const now = new Date();
      const startDate = subDays(now, days);
      const dateRange = eachDayOfInterval({ start: startDate, end: now });

      // --- Requests: filter server-side where possible ---
      let requestQuery = supabase
        .from('support_requests')
        .select(REQUEST_COLUMNS)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(ROW_CAP + 1);

      if (f.status.length) requestQuery = requestQuery.in('status', f.status as never[]);
      if (f.assignedCaseManagerId.length) {
        requestQuery = requestQuery.in('assigned_case_manager_id', f.assignedCaseManagerId);
      }

      const { data: rawRequests, error: requestsError } = await requestQuery;
      if (requestsError) throw requestsError;

      const truncated = (rawRequests?.length ?? 0) > ROW_CAP;
      const capped = (rawRequests ?? []).slice(0, ROW_CAP) as any[];

      // Student-scoped filters live on the joined profile.
      const requests = capped.filter((r) => {
        const s = r.student;
        if (f.organizationId.length && (!s?.organization_id || !f.organizationId.includes(s.organization_id))) return false;
        if (f.cohort.length && (!s?.cohort_id || !f.cohort.includes(s.cohort_id))) return false;
        if (f.yearOfStudy.length && (!s?.year_of_study || !f.yearOfStudy.includes(s.year_of_study))) return false;
        return true;
      });

      // --- Assignments, scoped to the same student population ---
      let assignmentQuery = supabase
        .from('student_assignments')
        .select('id, student_id, case_manager_id, created_at, student:profiles!student_assignments_student_id_fkey(user_id, organization_id, cohort_id, year_of_study)');

      if (f.assignedCaseManagerId.length) {
        assignmentQuery = assignmentQuery.in('case_manager_id', f.assignedCaseManagerId);
      }

      const { data: rawAssignments, error: assignmentsError } = await assignmentQuery;
      if (assignmentsError) throw assignmentsError;

      const assignments = ((rawAssignments ?? []) as any[]).filter((a) => {
        const s = a.student;
        if (f.organizationId.length && (!s?.organization_id || !f.organizationId.includes(s.organization_id))) return false;
        if (f.cohort.length && (!s?.cohort_id || !f.cohort.includes(s.cohort_id))) return false;
        if (f.yearOfStudy.length && (!s?.year_of_study || !f.yearOfStudy.includes(s.year_of_study))) return false;
        return true;
      });

      // --- Case managers ---
      const { data: caseManagerRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'case_manager');
      if (rolesError) throw rolesError;

      let caseManagerIds = caseManagerRoles?.map((r) => r.user_id) ?? [];
      if (f.assignedCaseManagerId.length) {
        caseManagerIds = caseManagerIds.filter((id) => f.assignedCaseManagerId.includes(id));
      }

      let caseManagers: { user_id: string; full_name: string | null }[] = [];
      if (caseManagerIds.length > 0) {
        const { data, error: cmError } = await supabase
          .from('profiles')
          .select('user_id, full_name, organization_id')
          .in('user_id', caseManagerIds);
        if (cmError) throw cmError;
        caseManagers = (data ?? []).filter((cm: any) => {
          if (!f.organizationId.length) return true;
          return !!cm.organization_id && f.organizationId.includes(cm.organization_id);
        });
      }

      // --- Daily trends ---
      const workloadTrends: WorkloadTrend[] = dateRange.map((date) => {
        const dayStart = startOfDay(date);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const dayRequests = requests.filter((r) => {
          const createdAt = new Date(r.created_at);
          return createdAt >= dayStart && createdAt <= dayEnd;
        });

        const dayResolved = requests.filter((r) => {
          if (!r.resolved_at) return false;
          const resolvedAt = new Date(r.resolved_at);
          return resolvedAt >= dayStart && resolvedAt <= dayEnd;
        });

        // Cumulative distinct students assigned as of this day. Assignment
        // removals are not timestamped, which is why the student_growth metric
        // is flagged as not derivable rather than charted as fact.
        const studentCount = new Set(
          assignments
            .filter((a) => new Date(a.created_at) <= dayEnd)
            .map((a) => a.student_id),
        ).size;

        return {
          date: format(date, 'MMM dd'),
          studentCount,
          requestCount: dayRequests.length,
          resolvedCount: dayResolved.length,
        };
      });

      // --- Resolution time by category (resolved only) ---
      const resolvedRequests = requests.filter((r) => r.resolved_at);
      const categoryStats: Record<string, { total: number; count: number }> = {};

      resolvedRequests.forEach((r) => {
        const resolutionHours =
          (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60);
        if (!categoryStats[r.category]) categoryStats[r.category] = { total: 0, count: 0 };
        categoryStats[r.category].total += resolutionHours;
        categoryStats[r.category].count++;
      });

      const resolutionByCategory: ResolutionTimeByCategory[] = Object.entries(categoryStats)
        .map(([category, stats]) => ({
          category: category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          avgHours: Math.round((stats.total / stats.count) * 10) / 10,
          count: stats.count,
        }))
        .sort((a, b) => b.count - a.count);

      // --- Per case manager ---
      const monthAgo = subDays(now, 30);
      const caseManagerMetrics: CaseManagerMetrics[] = caseManagers
        .map((cm) => {
          const cmStudents = new Set(
            assignments.filter((a) => a.case_manager_id === cm.user_id).map((a) => a.student_id),
          );
          const cmRequests = requests.filter((r) => r.assigned_case_manager_id === cm.user_id);
          const activeRequests = cmRequests.filter(
            (r) => r.status !== 'resolved' && r.status !== 'cancelled',
          );
          const resolvedThisMonth = cmRequests.filter(
            (r) => r.resolved_at && new Date(r.resolved_at) >= monthAgo,
          );

          const totalResolutionTime = resolvedThisMonth.reduce(
            (acc, r) => acc + (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()),
            0,
          );

          return {
            id: cm.user_id,
            name: cm.full_name || 'Unknown',
            activeStudents: cmStudents.size,
            activeRequests: activeRequests.length,
            resolvedThisMonth: resolvedThisMonth.length,
            // Null, not 0, when nothing was resolved — 0h would read as instant.
            avgResolutionHours:
              resolvedThisMonth.length > 0
                ? Math.round((totalResolutionTime / resolvedThisMonth.length / (1000 * 60 * 60)) * 10) / 10
                : null,
          };
        })
        .sort((a, b) => b.activeRequests - a.activeRequests);

      // --- Summary ---
      const totalStudents = new Set(assignments.map((a) => a.student_id)).size;
      // Cancelled requests are excluded from the resolution-rate denominator:
      // they were never eligible to be resolved.
      const rateEligible = requests.filter((r) => r.status !== 'cancelled');
      const resolutionRate =
        rateEligible.length > 0
          ? Math.round((rateEligible.filter((r) => r.resolved_at).length / rateEligible.length) * 100)
          : null;

      const avgResolutionMs = resolvedRequests.reduce(
        (acc, r) => acc + (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()),
        0,
      );
      const avgResolutionTime =
        resolvedRequests.length > 0
          ? Math.round((avgResolutionMs / resolvedRequests.length / (1000 * 60 * 60)) * 10) / 10
          : null;

      // Only approved amounts count as dispersed.
      const fundsDispersed = requests.reduce((sum, r) => {
        if (r.approval_status !== 'approved') return sum;
        return sum + (Number(r.approved_amount) || 0);
      }, 0);

      const appliedFilterLabels: string[] = [];
      if (f.organizationId.length) appliedFilterLabels.push(`${f.organizationId.length} organization(s)`);
      if (f.cohort.length) appliedFilterLabels.push(`${f.cohort.length} cohort(s)`);
      if (f.yearOfStudy.length) appliedFilterLabels.push(`${f.yearOfStudy.length} class year(s)`);
      if (f.status.length) appliedFilterLabels.push(`Status: ${f.status.join(', ')}`);
      if (f.assignedCaseManagerId.length) {
        appliedFilterLabels.push(`${f.assignedCaseManagerId.length} case manager(s)`);
      }

      return {
        workloadTrends,
        resolutionByCategory,
        caseManagerMetrics,
        summary: {
          totalStudents,
          totalRequests: requests.length,
          avgResolutionTime,
          resolutionRate,
          fundsDispersed,
        },
        meta: {
          generatedAt: now.toISOString(),
          rangeLabel: `${format(startDate, 'MMM d, yyyy')} – ${format(now, 'MMM d, yyyy')} (last ${days} days)`,
          rowCount: requests.length,
          truncated,
          appliedFilterLabels,
        },
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
