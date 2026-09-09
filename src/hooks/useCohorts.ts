import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Cohort {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  /** Set when the cohort has graduated; requests dated on/after it draw on the Alumni Support fund. */
  graduated_at: string | null;
  created_at: string;
  updated_at: string;
  student_count?: number;
}

export interface CohortInput {
  organization_id: string;
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  graduated_at?: string | null;
}

/** All cohorts visible to the current user (RLS-scoped). */
export function useAllCohorts() {
  return useQuery({
    queryKey: ['cohorts', 'all'],
    queryFn: async (): Promise<Cohort[]> => {
      const { data, error } = await supabase
        .from('cohorts')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as Cohort[];
    },
  });
}

export interface CohortWithDetails extends Cohort {
  organization_name: string | null;
  student_count: number;
  case_manager_count: number;
}

/**
 * Every cohort the current user may see, across organizations, with the
 * organization name plus student and case-manager counts for the index page.
 */
export function useAllCohortsDetailed() {
  return useQuery({
    queryKey: ['cohorts', 'all-detailed'],
    queryFn: async (): Promise<CohortWithDetails[]> => {
      const { data: cohorts, error } = await supabase.from('cohorts').select('*').order('name');
      if (error) throw error;
      const list = (cohorts || []) as Cohort[];
      if (list.length === 0) return [];

      const ids = list.map((c) => c.id);
      const [orgsRes, profilesRes, cmRes] = await Promise.all([
        supabase.from('training_organizations').select('id, name'),
        supabase.from('profiles').select('cohort_id').in('cohort_id', ids),
        supabase.from('cohort_case_managers').select('cohort_id').in('cohort_id', ids),
      ]);

      const orgNames = new Map((orgsRes.data || []).map((o: any) => [o.id, o.name as string]));
      const studentCounts = new Map<string, number>();
      (profilesRes.data || []).forEach((p: any) => {
        if (p.cohort_id) studentCounts.set(p.cohort_id, (studentCounts.get(p.cohort_id) || 0) + 1);
      });
      const cmCounts = new Map<string, number>();
      (cmRes.data || []).forEach((c: any) => {
        cmCounts.set(c.cohort_id, (cmCounts.get(c.cohort_id) || 0) + 1);
      });

      return list.map((c) => ({
        ...c,
        organization_name: orgNames.get(c.organization_id) ?? null,
        student_count: studentCounts.get(c.id) || 0,
        case_manager_count: cmCounts.get(c.id) || 0,
      }));
    },
  });
}

/** Cohorts for a single organization, with student counts. */
export function useOrgCohorts(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['cohorts', 'org', organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Cohort[]> => {
      const { data: cohorts, error } = await supabase
        .from('cohorts')
        .select('*')
        .eq('organization_id', organizationId!)
        .order('name');
      if (error) throw error;
      const list = (cohorts || []) as Cohort[];
      if (list.length === 0) return list;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('cohort_id')
        .in('cohort_id', list.map((c) => c.id));
      const counts = new Map<string, number>();
      (profiles || []).forEach((p: any) => {
        if (p.cohort_id) counts.set(p.cohort_id, (counts.get(p.cohort_id) || 0) + 1);
      });
      return list.map((c) => ({ ...c, student_count: counts.get(c.id) || 0 }));
    },
  });
}

export function useCreateCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CohortInput) => {
      const { data, error } = await supabase
        .from('cohorts')
        .insert({
          organization_id: input.organization_id,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          start_date: input.start_date || null,
          end_date: input.end_date || null,
          graduated_at: input.graduated_at || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Cohort;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['cohorts'] });
      qc.invalidateQueries({ queryKey: ['cohorts', 'org', vars.organization_id] });
    },
  });
}

export function useUpdateCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<CohortInput>) => {
      const { data, error } = await supabase
        .from('cohorts')
        .update({
          ...('name' in patch ? { name: patch.name?.trim() } : {}),
          ...('description' in patch ? { description: patch.description?.toString().trim() || null } : {}),
          ...('start_date' in patch ? { start_date: patch.start_date || null } : {}),
          ...('end_date' in patch ? { end_date: patch.end_date || null } : {}),
          ...('graduated_at' in patch ? { graduated_at: patch.graduated_at || null } : {}),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Cohort;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cohorts'] });
    },
  });
}

export function useDeleteCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cohorts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cohorts'] });
      qc.invalidateQueries({ queryKey: ['student-folders'] });
      qc.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
  });
}

/** Assigns a single student to a cohort (or clears it with null). */
export function useAssignStudentCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, cohortId }: { studentId: string; cohortId: string | null }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ cohort_id: cohortId })
        .eq('user_id', studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cohorts'] });
      qc.invalidateQueries({ queryKey: ['student-folders'] });
      qc.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
  });
}

export interface OrgStudent {
  user_id: string;
  full_name: string | null;
  email: string | null;
  cohort_id: string | null;
  /** True when the student has no organization yet, so assigning also sets one. */
  needs_organization?: boolean;
}

/** Students whose profile.organization_id matches the given org. */
export function useOrgStudents(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['cohorts', 'org-students', organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<OrgStudent[]> => {
      // Get student user_ids in this org via profiles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, cohort_id')
        .eq('organization_id', organizationId!)
        .order('full_name', { ascending: true, nullsFirst: false });
      if (error) throw error;
      const ids = (profiles || []).map((p: any) => p.user_id);
      if (ids.length === 0) return [];

      // Filter to those with student role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', ids)
        .eq('role', 'student');
      const studentSet = new Set((roles || []).map((r: any) => r.user_id));

      return (profiles || [])
        .filter((p: any) => studentSet.has(p.user_id))
        .map((p: any) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          cohort_id: p.cohort_id,
        }));
    },
  });
}

/**
 * Students who can be put into a class: everyone in the class's organization,
 * plus students who have no organization yet so older records aren't stranded.
 */
export function useAssignableStudents(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['cohorts', 'assignable-students', organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<OrgStudent[]> => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, cohort_id, organization_id')
        .order('full_name', { ascending: true, nullsFirst: false });
      if (error) throw error;

      const candidates = (profiles || []).filter(
        (p: any) => p.organization_id === organizationId || !p.organization_id,
      );
      const ids = candidates.map((p: any) => p.user_id);
      if (ids.length === 0) return [];

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', ids)
        .eq('role', 'student');
      const studentSet = new Set((roles || []).map((r: any) => r.user_id));

      return candidates
        .filter((p: any) => studentSet.has(p.user_id))
        .map((p: any) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          cohort_id: p.cohort_id,
          needs_organization: !p.organization_id,
        }));
    },
  });
}

/** How many students are in no class at all (visible to the current user). */
export function useUnassignedStudentsCount() {
  return useQuery({
    queryKey: ['cohorts', 'unassigned-count'],
    queryFn: async (): Promise<number> => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, cohort_id'),
        supabase.from('user_roles').select('user_id').eq('role', 'student'),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      const students = new Set((rolesRes.data || []).map((r: any) => r.user_id));
      return (profilesRes.data || []).filter((p: any) => students.has(p.user_id) && !p.cohort_id).length;
    },
  });
}

/**
 * Bulk assign/unassign students to a cohort. When an organization is given,
 * students who have no organization yet join it too; existing values are kept.
 */
export function useBulkAssignCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      studentIds,
      cohortId,
      organizationId,
    }: {
      studentIds: string[];
      cohortId: string | null;
      organizationId?: string | null;
    }) => {
      if (studentIds.length === 0) return;

      const { error } = await supabase
        .from('profiles')
        .update({ cohort_id: cohortId })
        .in('user_id', studentIds);
      if (error) throw error;

      if (cohortId && organizationId) {
        const { data: needOrg } = await supabase
          .from('profiles')
          .select('user_id')
          .in('user_id', studentIds)
          .is('organization_id', null);
        const orphanIds = (needOrg || []).map((p: any) => p.user_id);
        if (orphanIds.length > 0) {
          const { error: orgError } = await supabase
            .from('profiles')
            .update({ organization_id: organizationId })
            .in('user_id', orphanIds);
          if (orgError) throw orgError;

          // Membership history mirrors the profile organization elsewhere in the app.
          const { error: memberError } = await supabase
            .from('organization_memberships')
            .insert(orphanIds.map((id) => ({ user_id: id, organization_id: organizationId })));
          if (memberError && !String(memberError.message).toLowerCase().includes('duplicate')) {
            console.error('Failed to record organization membership:', memberError);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cohorts'] });
      qc.invalidateQueries({ queryKey: ['student-folders'] });
      qc.invalidateQueries({ queryKey: ['users-with-roles'] });
      qc.invalidateQueries({ queryKey: ['student-detail'] });
      qc.invalidateQueries({ queryKey: ['student-crm'] });
    },
  });
}
