import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CommunityResource {
  id: string;
  category: string;
  name: string;
  address: string | null;
  website: string | null;
  contact: string | null;
  phone: string | null;
  description: string | null;
  tags: string[];
  is_active: boolean;
}

export function useCommunityResources(opts?: { category?: string; search?: string; includeInactive?: boolean }) {
  return useQuery({
    queryKey: ['community_resources', opts?.category ?? null, opts?.search ?? '', !!opts?.includeInactive],
    queryFn: async () => {
      let q = supabase.from('community_resources').select('*').order('category').order('name');
      if (!opts?.includeInactive) q = q.eq('is_active', true);
      if (opts?.category) q = q.eq('category', opts.category);
      if (opts?.search && opts.search.trim()) {
        const s = `%${opts.search.trim()}%`;
        q = q.or(`name.ilike.${s},address.ilike.${s},description.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CommunityResource[];
    },
  });
}

export function useCommunityResource(id?: string) {
  return useQuery({
    queryKey: ['community_resource', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('community_resources').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as CommunityResource | null;
    },
  });
}
