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
      const [orgsRes, profilesRes, rolesRes] = await Promise.all([
        supabase.from('training_organizations').select('id, name').eq('is_active', true).order('name'),
        supabase.from('profiles').select('user_id, full_name, email, cohort_start_date, year_of_study, department'),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      const organizations = (orgsRes.data || []).map((o) => ({ value: o.id, label: o.name }));

      const roleMap = new Map((rolesRes.data || []).map((r: any) => [r.user_id, r.role]));
      const caseManagers = (profilesRes.data || [])
        .filter((p: any) => roleMap.get(p.user_id) === 'case_manager')
        .map((p: any) => ({ value: p.user_id, label: p.full_name || p.email }));

      const cohortSet = new Set<string>();
      const yearSet = new Set<string>();
      const programSet = new Set<string>();
      (profilesRes.data || []).forEach((p: any) => {
        if (p.cohort_start_date) {
          const y = new Date(p.cohort_start_date).getUTCFullYear();
          if (!Number.isNaN(y)) cohortSet.add(String(y));
        }
        if (p.year_of_study) yearSet.add(p.year_of_study);
        if (p.department) programSet.add(p.department);
      });

      const cohorts = [...cohortSet].sort().reverse().map((y) => ({ value: y, label: `Class of ${y}` }));
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
