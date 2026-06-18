import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Cohort {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
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
