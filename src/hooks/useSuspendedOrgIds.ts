import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the set of organization IDs that are currently suspended.
 * Used to render visual indicators on rows belonging to those orgs.
 * RLS allows everyone to read training_organizations id+suspended_at.
 */
export function useSuspendedOrgIds() {
  return useQuery({
    queryKey: ['suspended-org-ids'],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('training_organizations')
        .select('id, suspended_at')
        .not('suspended_at', 'is', null);
      if (error) throw error;
      return new Set((data || []).map((o: any) => o.id));
    },
  });
}
