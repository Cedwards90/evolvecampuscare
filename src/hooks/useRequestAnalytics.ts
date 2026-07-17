import { useQuery } from '@tanstack/react-query';
import { subDays, startOfDay, format, eachDayOfInterval } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useGlobalFilters, GlobalFilters } from '@/contexts/GlobalFiltersContext';
import type { RequestStatus, RequestPriority, RequestCategory } from '@/types/database';

export interface RequestAnalyticsRow {
  id: string;
  student_id: string;
  assigned_case_manager_id: string | null;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  is_emergency: boolean;
  requested_amount: number | null;
  approved_amount: number | null;
  approval_status: string | null;
  created_at: string;
  resolved_at: string | null;
  organization_id: string | null;
  organization_name: string | null;
  cohort_id: string | null;
  cohort_name: string | null;
  case_manager_name: string | null;
  student_name: string | null;
  year_of_study: string | null;
  program: string | null;
  student_status: 'active' | 'inactive';
}

export interface RequestAnalyticsData {
  rows: RequestAnalyticsRow[];
  summary: {
    total: number;
    open: number;
    resolved: number;
    escalated: number;
    emergency: number;
    avgResolutionHours: number;
    medianResolutionHours: number;
    repeatRequesterRate: number;
    financialRequested: number;
    financialApproved: number;
    financialPending: number;
  };
  volume: { date: string; total: number; resolved: number; emergency: number }[];
  byCategory: { category: string; count: number; resolved: number; avgHours: number }[];
  byPriority: { priority: string; count: number }[];
  byStatus: { status: string; count: number }[];
  repeat: { studentId: string; studentName: string; count: number }[];
  backlogAge: { bucket: string; count: number }[];
  financialByCategory: { category: string; requested: number; approved: number; pending: number }[];
  financialByOrg: { organization: string; requested: number; approved: number; pending: number }[];
  breakdown: {
    key: string;
    organization: string;
    cohort: string;
    caseManager: string;
    category: string;
    total: number;
    resolved: number;
    resolvedPct: number;
    avgHours: number;
    approved: number;
  }[];
  byCaseManager: {
    id: string;
    name: string;
    total: number;
    open: number;
    resolved: number;
    avgHours: number;
  }[];
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function labelCategory(c: string): string {
  return c.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export function useRequestAnalytics(days: number = 30) {
  const { filters, isHydrated } = useGlobalFilters();

  return useQuery({
    enabled: isHydrated,
    queryKey: ['request-analytics', days, filters],
    staleTime: 60_000,
    queryFn: async (): Promise<RequestAnalyticsData> => {
      const fromDate = startOfDay(subDays(new Date(), days - 1));
      const toDate = new Date();

      const [reqRes, profRes, orgRes, cohortRes, rolesRes] = await Promise.all([
        supabase
          .from('support_requests')
          .select(
            'id, student_id, assigned_case_manager_id, category, priority, status, is_emergency, requested_amount, approved_amount, approval_status, created_at, resolved_at',
          )
          .gte('created_at', fromDate.toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('user_id, full_name, email, organization_id, cohort_id, year_of_study, department, deactivated_at'),
        supabase.from('training_organizations').select('id, name'),
        supabase.from('cohorts').select('id, name'),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      if (reqRes.error) throw reqRes.error;

      const profileMap = new Map<string, any>((profRes.data || []).map((p: any) => [p.user_id, p]));
      const orgMap = new Map<string, string>((orgRes.data || []).map((o: any) => [o.id, o.name]));
      const cohortMap = new Map<string, string>((cohortRes.data || []).map((c: any) => [c.id, c.name]));

      const requests = (reqRes.data || []) as any[];

      // Enrich with profile-derived context so global filters can be applied.
      const enriched: RequestAnalyticsRow[] = requests.map((r) => {
        const student = profileMap.get(r.student_id);
        const cm = r.assigned_case_manager_id ? profileMap.get(r.assigned_case_manager_id) : null;
        const orgId = student?.organization_id ?? null;
        return {
          id: r.id,
          student_id: r.student_id,
          assigned_case_manager_id: r.assigned_case_manager_id,
          category: r.category,
          priority: r.priority,
          status: r.status,
          is_emergency: !!r.is_emergency,
          requested_amount: r.requested_amount ?? null,
          approved_amount: r.approved_amount ?? null,
          approval_status: r.approval_status ?? null,
          created_at: r.created_at,
          resolved_at: r.resolved_at,
          organization_id: orgId,
          organization_name: orgId ? orgMap.get(orgId) || null : null,
          cohort_id: student?.cohort_id ?? null,
          cohort_name: student?.cohort_id ? cohortMap.get(student.cohort_id) || null : null,
          case_manager_name: cm?.full_name || cm?.email || null,
          student_name: student?.full_name || student?.email || null,
          year_of_study: student?.year_of_study ?? null,
          program: student?.department ?? null,
          student_status: student?.deactivated_at ? 'inactive' : 'active',
        };
      });

      // Apply global filters client-side (RLS already scoped the data)
      const rows = enriched.filter((r) => applyRow(r, filters));

      // ---- Summary ----
      const resolvedRows = rows.filter((r) => r.resolved_at);
      const resolutionHours = resolvedRows.map(
        (r) => (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 3_600_000,
      );
      const avgResolutionHours = resolutionHours.length
        ? Math.round((resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length) * 10) / 10
        : 0;
      const medianResolutionHours = Math.round(median(resolutionHours) * 10) / 10;

      const studentCounts = new Map<string, number>();
      rows.forEach((r) => studentCounts.set(r.student_id, (studentCounts.get(r.student_id) || 0) + 1));
      const repeatStudents = [...studentCounts.entries()].filter(([, c]) => c > 1);
      const repeatRequesterRate = studentCounts.size
        ? Math.round((repeatStudents.length / studentCounts.size) * 100)
        : 0;

      const financialRequested = rows.reduce((s, r) => s + (r.requested_amount || 0), 0);
      const financialApproved = rows.reduce((s, r) => s + (r.approved_amount || 0), 0);
      const financialPending = rows
        .filter((r) => r.category === 'financial' && (r.approval_status === 'pending' || !r.approval_status))
        .reduce((s, r) => s + (r.requested_amount || 0), 0);

      const summary = {
        total: rows.length,
        open: rows.filter((r) => r.status !== 'resolved' && r.status !== 'cancelled').length,
        resolved: rows.filter((r) => r.status === 'resolved').length,
        escalated: rows.filter((r) => r.status === 'escalated').length,
        emergency: rows.filter((r) => r.is_emergency).length,
        avgResolutionHours,
        medianResolutionHours,
        repeatRequesterRate,
        financialRequested,
        financialApproved,
        financialPending,
      };

      // ---- Volume trend ----
      const dateRange = eachDayOfInterval({ start: fromDate, end: toDate });
      const volume = dateRange.map((d) => {
        const key = format(d, 'yyyy-MM-dd');
        const dayRows = rows.filter((r) => format(new Date(r.created_at), 'yyyy-MM-dd') === key);
        const resolved = rows.filter(
          (r) => r.resolved_at && format(new Date(r.resolved_at), 'yyyy-MM-dd') === key,
        );
        return {
          date: format(d, 'MMM dd'),
          total: dayRows.length,
          resolved: resolved.length,
          emergency: dayRows.filter((r) => r.is_emergency).length,
        };
      });

      // ---- By category / priority / status ----
      const catStats = new Map<string, { count: number; resolved: number; hours: number[] }>();
      rows.forEach((r) => {
        const c = catStats.get(r.category) || { count: 0, resolved: 0, hours: [] };
        c.count++;
        if (r.resolved_at) {
          c.resolved++;
          c.hours.push((new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000);
        }
        catStats.set(r.category, c);
      });
      const byCategory = [...catStats.entries()]
        .map(([category, v]) => ({
          category: labelCategory(category),
          count: v.count,
          resolved: v.resolved,
          avgHours: v.hours.length ? Math.round((v.hours.reduce((a, b) => a + b, 0) / v.hours.length) * 10) / 10 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      const prioMap = new Map<string, number>();
      rows.forEach((r) => prioMap.set(r.priority, (prioMap.get(r.priority) || 0) + 1));
      const byPriority = [...prioMap.entries()].map(([priority, count]) => ({ priority: labelCategory(priority), count }));

      const statusMap = new Map<string, number>();
      rows.forEach((r) => statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1));
      const byStatus = [...statusMap.entries()].map(([status, count]) => ({ status: labelCategory(status), count }));

      // ---- Repeat requesters ----
      const repeat = repeatStudents
        .map(([studentId, count]) => ({
          studentId,
          studentName: profileMap.get(studentId)?.full_name || profileMap.get(studentId)?.email || 'Unknown',
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 25);

      // ---- Backlog age buckets ----
      const now = Date.now();
      const buckets: Record<string, number> = { '0-3 days': 0, '4-7 days': 0, '8-14 days': 0, '15+ days': 0 };
      rows
        .filter((r) => r.status !== 'resolved' && r.status !== 'cancelled')
        .forEach((r) => {
          const days = (now - new Date(r.created_at).getTime()) / 86_400_000;
          if (days <= 3) buckets['0-3 days']++;
          else if (days <= 7) buckets['4-7 days']++;
          else if (days <= 14) buckets['8-14 days']++;
          else buckets['15+ days']++;
        });
      const backlogAge = Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));

      // ---- Financial breakdowns ----
      const finByCat = new Map<string, { requested: number; approved: number; pending: number }>();
      const finByOrg = new Map<string, { requested: number; approved: number; pending: number }>();
      rows.forEach((r) => {
        if (r.category !== 'financial' && !r.requested_amount) return;
        const req = r.requested_amount || 0;
        const app = r.approved_amount || 0;
        const pend = r.approval_status === 'pending' || !r.approval_status ? req : 0;
        const cKey = labelCategory(r.category);
        const oKey = r.organization_name || 'Unassigned';
        const c = finByCat.get(cKey) || { requested: 0, approved: 0, pending: 0 };
        c.requested += req; c.approved += app; c.pending += pend;
        finByCat.set(cKey, c);
        const o = finByOrg.get(oKey) || { requested: 0, approved: 0, pending: 0 };
        o.requested += req; o.approved += app; o.pending += pend;
        finByOrg.set(oKey, o);
      });
      const financialByCategory = [...finByCat.entries()].map(([category, v]) => ({ category, ...v }));
      const financialByOrg = [...finByOrg.entries()]
        .map(([organization, v]) => ({ organization, ...v }))
        .sort((a, b) => b.requested - a.requested);

      // ---- Breakdown pivot (org x cohort x cm x category) ----
      const pivot = new Map<
        string,
        {
          organization: string;
          cohort: string;
          caseManager: string;
          category: string;
          total: number;
          resolved: number;
          hours: number[];
          approved: number;
        }
      >();
      rows.forEach((r) => {
        const key = [
          r.organization_name || '—',
          r.cohort_name || '—',
          r.case_manager_name || 'Unassigned',
          labelCategory(r.category),
        ].join('|');
        const v = pivot.get(key) || {
          organization: r.organization_name || '—',
          cohort: r.cohort_name || '—',
          caseManager: r.case_manager_name || 'Unassigned',
          category: labelCategory(r.category),
          total: 0,
          resolved: 0,
          hours: [],
          approved: 0,
        };
        v.total++;
        if (r.resolved_at) {
          v.resolved++;
          v.hours.push((new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000);
        }
        v.approved += r.approved_amount || 0;
        pivot.set(key, v);
      });
      const breakdown = [...pivot.entries()]
        .map(([key, v]) => ({
          key,
          organization: v.organization,
          cohort: v.cohort,
          caseManager: v.caseManager,
          category: v.category,
          total: v.total,
          resolved: v.resolved,
          resolvedPct: v.total ? Math.round((v.resolved / v.total) * 100) : 0,
          avgHours: v.hours.length ? Math.round((v.hours.reduce((a, b) => a + b, 0) / v.hours.length) * 10) / 10 : 0,
          approved: v.approved,
        }))
        .sort((a, b) => b.total - a.total);

      // ---- Per case manager ----
      const cmStats = new Map<
        string,
        { name: string; total: number; open: number; resolved: number; hours: number[] }
      >();
      rows.forEach((r) => {
        const id = r.assigned_case_manager_id || 'unassigned';
        const name = r.case_manager_name || 'Unassigned';
        const v = cmStats.get(id) || { name, total: 0, open: 0, resolved: 0, hours: [] };
        v.total++;
        if (r.status === 'resolved') {
          v.resolved++;
          if (r.resolved_at) v.hours.push((new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000);
        } else if (r.status !== 'cancelled') v.open++;
        cmStats.set(id, v);
      });
      const byCaseManager = [...cmStats.entries()]
        .map(([id, v]) => ({
          id,
          name: v.name,
          total: v.total,
          open: v.open,
          resolved: v.resolved,
          avgHours: v.hours.length ? Math.round((v.hours.reduce((a, b) => a + b, 0) / v.hours.length) * 10) / 10 : 0,
        }))
        .sort((a, b) => b.total - a.total);

      return {
        rows,
        summary,
        volume,
        byCategory,
        byPriority,
        byStatus,
        repeat,
        backlogAge,
        financialByCategory,
        financialByOrg,
        breakdown,
        byCaseManager,
      };
    },
  });
}

function applyRow(r: RequestAnalyticsRow, f: GlobalFilters): boolean {
  if (f.status.length && !f.status.includes(r.status)) return false;
  if (f.assignedCaseManagerId.length) {
    if (!r.assigned_case_manager_id || !f.assignedCaseManagerId.includes(r.assigned_case_manager_id)) return false;
  }
  if (f.organizationId.length) {
    if (!r.organization_id || !f.organizationId.includes(r.organization_id)) return false;
  }
  if (f.cohort.length) {
    if (!r.cohort_id || !f.cohort.includes(r.cohort_id)) return false;
  }
  if (f.yearOfStudy.length) {
    if (!r.year_of_study || !f.yearOfStudy.includes(r.year_of_study)) return false;
  }
  if (f.program.length) {
    if (!r.program || !f.program.includes(r.program)) return false;
  }
  if (f.studentStatus.length) {
    if (!f.studentStatus.includes(r.student_status)) return false;
  }
  return true;
}
