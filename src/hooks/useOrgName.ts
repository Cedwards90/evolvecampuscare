import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Resolve a training organization's display name by id.
 * Shared cache (`['org-name', id]`) so it dedupes with OrgBadgeInline.
 */
export function useOrgName(orgId?: string | null) {
  const { data } = useQuery({
    queryKey: ['org-name', orgId],
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_organizations')
        .select('id, name')
        .eq('id', orgId as string)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });
  return data?.name || null;
}
