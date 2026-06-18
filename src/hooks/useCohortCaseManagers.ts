import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CohortCaseManager {
  id: string;
  cohort_id: string;
  case_manager_id: string;
  created_at: string;
  full_name: string | null;
  email: string | null;
}

/** Case managers currently linked to a cohort. */
export function useCohortCaseManagers(cohortId: string | null | undefined) {
  return useQuery({
    queryKey: ['cohort-case-managers', cohortId],
    enabled: !!cohortId,
    queryFn: async (): Promise<CohortCaseManager[]> => {
      const { data, error } = await supabase
        .from('cohort_case_managers')
        .select('id, cohort_id, case_manager_id, created_at')
        .eq('cohort_id', cohortId!);
      if (error) throw error;
      const rows = data || [];
      if (rows.length === 0) return [];
      const ids = rows.map((r: any) => r.case_manager_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids);
      const pmap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return rows.map((r: any) => ({
        ...r,
        full_name: pmap.get(r.case_manager_id)?.full_name ?? null,
        email: pmap.get(r.case_manager_id)?.email ?? null,
      }));
    },
  });
}

/** All case managers visible to the current user (RLS-scoped), used for "Add CM" combobox. */
export function useAvailableCaseManagers() {
  return useQuery({
    queryKey: ['available-case-managers'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'case_manager');
      if (error) throw error;
      const ids = (roles || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [] as { user_id: string; full_name: string | null; email: string | null }[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids)
        .order('full_name', { ascending: true, nullsFirst: false });
      return (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
      }));
    },
  });
}

export function useAddCohortCaseManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cohortId, caseManagerId }: { cohortId: string; caseManagerId: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('cohort_case_managers')
        .insert({ cohort_id: cohortId, case_manager_id: caseManagerId, assigned_by: u.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['cohort-case-managers', vars.cohortId] });
      qc.invalidateQueries({ queryKey: ['student-assignments'] });
      qc.invalidateQueries({ queryKey: ['my-students'] });
      qc.invalidateQueries({ queryKey: ['student-folders'] });
    },
  });
}

export function useRemoveCohortCaseManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; cohortId: string }) => {
      const { error } = await supabase.from('cohort_case_managers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['cohort-case-managers', vars.cohortId] });
    },
  });
}
