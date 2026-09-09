import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Resolve a set of user ids to display names, for approval-chain labels. */
export function useStaffNames(userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: ['staff-names', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of data || []) {
        map[(p as any).user_id] = (p as any).full_name || (p as any).email;
      }
      return map;
    },
  });
}
