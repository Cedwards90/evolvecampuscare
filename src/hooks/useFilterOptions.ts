import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches options for the global filter bar selects:
 * organizations, case managers, cohorts (years), year-of-study, programs (department),
 * and student status values. RLS already restricts what each role can see.
 */
export function useFilterOptions() {
  return useQuery({
    queryKey: ['global-filter-options'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [orgsRes, profilesRes, rolesRes, cohortsRes] = await Promise.all([
        supabase.from('training_organizations').select('id, name').order('name'),
        supabase.from('profiles').select('user_id, full_name, email, year_of_study, department'),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('cohorts').select('id, name, organization_id').order('name'),
      ]);

      const organizations = (orgsRes.data || []).map((o) => ({ value: o.id, label: o.name }));
      const orgNameMap = new Map((orgsRes.data || []).map((o: any) => [o.id, o.name]));

      const roleMap = new Map((rolesRes.data || []).map((r: any) => [r.user_id, r.role]));
      const caseManagers = (profilesRes.data || [])
        .filter((p: any) => roleMap.get(p.user_id) === 'case_manager')
        .map((p: any) => ({ value: p.user_id, label: p.full_name || p.email }));

      // Detect duplicate cohort names to disambiguate with org suffix
      const nameCounts = new Map<string, number>();
      (cohortsRes.data || []).forEach((c: any) => {
        nameCounts.set(c.name, (nameCounts.get(c.name) || 0) + 1);
      });
      const cohorts = (cohortsRes.data || []).map((c: any) => ({
        value: c.id,
        label: (nameCounts.get(c.name) || 0) > 1
          ? `${c.name} — ${orgNameMap.get(c.organization_id) || ''}`.trim()
          : c.name,
      }));

      const yearSet = new Set<string>();
      const programSet = new Set<string>();
      (profilesRes.data || []).forEach((p: any) => {
        if (p.year_of_study) yearSet.add(p.year_of_study);
        if (p.department) programSet.add(p.department);
      });

      const yearsOfStudy = [...yearSet].sort().map((y) => ({ value: y, label: y }));
      const programs = [...programSet].sort().map((p) => ({ value: p, label: p }));
      const studentStatuses = [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ];

      return { organizations, caseManagers, cohorts, yearsOfStudy, programs, studentStatuses };
    },
  });
}
