import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateAge } from '@/lib/age';

export interface StudentCrmRequest {
  id: string;
  title: string;
  category: string;
  status: string;
  approval_status: string | null;
  requested_amount: number | null;
  approved_amount: number | null;
  created_at: string;
}

export interface StudentCrmRow {
  user_id: string;
  full_name: string | null;
  preferred_name: string | null;
  legal_first_name: string | null;
  legal_last_name: string | null;
  student_id: string | null;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  age: number | null;

  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;

  organization_id: string | null;
  organization_name: string | null;
  cohort_id: string | null;
  cohort_name: string | null;
  cohort_graduated_at: string | null;

  case_manager_id: string | null;
  case_manager_name: string | null;

  department: string | null;
  year_of_study: string | null;

  cohort_start_date: string | null;
  graduation_date: string | null;
  placement_date: string | null;

  is_active: boolean;
  deactivation_reason: string | null;
  profile_last_reviewed_at: string | null;
  created_at: string;

  /** Requests still open (submitted / in_progress / escalated). */
  open_requests: number;
  total_requests: number;
  /** Sum of approved amounts on requests that were not denied. */
  dispersed: number;
  requested_total: number;
  last_activity_at: string | null;
  requests: StudentCrmRequest[];
}

const OPEN_STATUSES = new Set(['submitted', 'in_progress', 'escalated']);

/**
 * Every student visible to the current user (RLS scopes admins / org admins /
 * case managers automatically), enriched with class, enrollment, assignment and
 * funding data so the CRM table can show a complete record in one row.
 */
export function useStudentCrm() {
  return useQuery({
    queryKey: ['student-crm'],
    queryFn: async (): Promise<StudentCrmRow[]> => {
      const [rolesRes, profilesRes] = await Promise.all([
        supabase.from('user_roles').select('user_id, role').eq('role', 'student'),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      ]);
      if (rolesRes.error) throw rolesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const studentIds = new Set((rolesRes.data || []).map((r: any) => r.user_id));
      const students = (profilesRes.data || []).filter((p: any) => studentIds.has(p.user_id));
      if (students.length === 0) return [];

      const ids = students.map((p: any) => p.user_id);

      const [orgsRes, cohortsRes, assignRes, requestsRes] = await Promise.all([
        supabase.from('training_organizations').select('id, name'),
        supabase.from('cohorts').select('id, name, graduated_at'),
        supabase.from('student_assignments').select('student_id, case_manager_id').in('student_id', ids),
        supabase
          .from('support_requests')
          .select('id, student_id, title, category, status, approval_status, requested_amount, approved_amount, created_at, updated_at')
          .in('student_id', ids),
      ]);

      const orgNames = new Map((orgsRes.data || []).map((o: any) => [o.id, o.name as string]));
      const cohortMap = new Map(
        (cohortsRes.data || []).map((c: any) => [c.id, { name: c.name as string, graduated_at: c.graduated_at as string | null }]),
      );

      const cmByStudent = new Map<string, string>();
      for (const a of assignRes.data || []) {
        if (!cmByStudent.has((a as any).student_id)) cmByStudent.set((a as any).student_id, (a as any).case_manager_id);
      }

      const cmIds = [...new Set([...cmByStudent.values()])];
      let cmNames = new Map<string, string>();
      if (cmIds.length > 0) {
        const { data: cms } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', cmIds);
        cmNames = new Map((cms || []).map((c: any) => [c.user_id, c.full_name || c.email]));
      }

      const requestsByStudent = new Map<string, StudentCrmRequest[]>();
      const lastActivity = new Map<string, string>();
      for (const r of (requestsRes.data || []) as any[]) {
        const list = requestsByStudent.get(r.student_id) || [];
        list.push({
          id: r.id,
          title: r.title,
          category: r.category,
          status: r.status,
          approval_status: r.approval_status ?? null,
          requested_amount: r.requested_amount ?? null,
          approved_amount: r.approved_amount ?? null,
          created_at: r.created_at,
        });
        requestsByStudent.set(r.student_id, list);

        const stamp = r.updated_at || r.created_at;
        const prev = lastActivity.get(r.student_id);
        if (!prev || new Date(stamp) > new Date(prev)) lastActivity.set(r.student_id, stamp);
      }

      return students.map((p: any) => {
        const requests = (requestsByStudent.get(p.user_id) || []).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        const cohort = p.cohort_id ? cohortMap.get(p.cohort_id) : undefined;
        const cmId = cmByStudent.get(p.user_id) || null;

        const dispersed = requests.reduce((sum, r) => {
          if (r.approval_status === 'denied') return sum;
          return sum + (typeof r.approved_amount === 'number' ? r.approved_amount : 0);
        }, 0);
        const requestedTotal = requests.reduce(
          (sum, r) => sum + (typeof r.requested_amount === 'number' ? r.requested_amount : 0),
          0,
        );

        return {
          user_id: p.user_id,
          full_name: p.full_name ?? null,
          preferred_name: p.preferred_name ?? null,
          legal_first_name: p.legal_first_name ?? null,
          legal_last_name: p.legal_last_name ?? null,
          student_id: p.student_id ?? null,
          email: p.email,
          phone: p.phone ?? null,
          date_of_birth: p.date_of_birth ?? null,
          age: calculateAge(p.date_of_birth ?? null),

          address_line1: p.address_line1 ?? null,
          address_line2: p.address_line2 ?? null,
          city: p.city ?? null,
          state_region: p.state_region ?? null,
          postal_code: p.postal_code ?? null,
          country: p.country ?? null,

          organization_id: p.organization_id ?? null,
          organization_name: p.organization_id ? orgNames.get(p.organization_id) ?? null : null,
          cohort_id: p.cohort_id ?? null,
          cohort_name: cohort?.name ?? null,
          cohort_graduated_at: cohort?.graduated_at ?? null,

          case_manager_id: cmId,
          case_manager_name: cmId ? cmNames.get(cmId) ?? null : null,

          department: p.department ?? null,
          year_of_study: p.year_of_study ?? null,

          cohort_start_date: p.cohort_start_date ?? null,
          graduation_date: p.graduation_date ?? null,
          placement_date: p.placement_date ?? null,

          is_active: !p.deactivated_at,
          deactivation_reason: p.deactivation_reason ?? null,
          profile_last_reviewed_at: p.profile_last_reviewed_at ?? null,
          created_at: p.created_at,

          open_requests: requests.filter((r) => OPEN_STATUSES.has(r.status)).length,
          total_requests: requests.length,
          dispersed,
          requested_total: requestedTotal,
          last_activity_at: lastActivity.get(p.user_id) ?? null,
          requests,
        };
      });
    },
  });
}

export interface StudentInvitationCounts {
  total: number;
  accepted: number;
  pending: number;
}

/** Invitation counts for students, used by the enrollment funnel. */
export function useStudentInvitationCounts() {
  return useQuery({
    queryKey: ['student-crm', 'invitations'],
    queryFn: async (): Promise<StudentInvitationCounts | null> => {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('id, accepted_at, invited_role')
        .eq('invited_role', 'student');
      if (error) return null;
      const rows = data || [];
      return {
        total: rows.length,
        accepted: rows.filter((r: any) => !!r.accepted_at).length,
        pending: rows.filter((r: any) => !r.accepted_at).length,
      };
    },
  });
}
