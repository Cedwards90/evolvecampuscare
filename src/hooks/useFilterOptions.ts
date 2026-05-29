import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Fetches options for the global filter bar selects:
 * organizations, case managers, available cohorts (years), and year-of-study values.
 * RLS already restricts what each role can see. Platform admins additionally see
 * suspended organizations (labelled accordingly) so they can filter to them.
 */
export function useFilterOptions() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  return useQuery({
    queryKey: ['global-filter-options', isAdmin],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const orgQuery = supabase
        .from('training_organizations')
        .select('id, name, suspended_at, is_active')
        .order('name');
      // Non-admins keep the existing active-only behavior.
      if (!isAdmin) orgQuery.eq('is_active', true);

      const [orgsRes, profilesRes, rolesRes] = await Promise.all([
        orgQuery,
        supabase.from('profiles').select('user_id, full_name, email, cohort_start_date, year_of_study'),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      const organizations = (orgsRes.data || []).map((o: any) => ({
        value: o.id,
        label: o.suspended_at ? `${o.name} (suspended)` : o.name,
      }));

      const roleMap = new Map((rolesRes.data || []).map((r: any) => [r.user_id, r.role]));
      const caseManagers = (profilesRes.data || [])
        .filter((p: any) => roleMap.get(p.user_id) === 'case_manager')
        .map((p: any) => ({ value: p.user_id, label: p.full_name || p.email }));

      const cohortSet = new Set<string>();
      const yearSet = new Set<string>();
      (profilesRes.data || []).forEach((p: any) => {
        if (p.cohort_start_date) {
          const y = new Date(p.cohort_start_date).getUTCFullYear();
          if (!Number.isNaN(y)) cohortSet.add(String(y));
        }
        if (p.year_of_study) yearSet.add(p.year_of_study);
      });

      const cohorts = [...cohortSet].sort().reverse().map((y) => ({ value: y, label: `Class of ${y}` }));
      const yearsOfStudy = [...yearSet].sort().map((y) => ({ value: y, label: y }));

      return { organizations, caseManagers, cohorts, yearsOfStudy };
    },
  });
}
