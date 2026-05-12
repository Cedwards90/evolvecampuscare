import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CertificationCatalogEntry {
  id: string;
  name: string;
  category: string | null;
  default_validity_months: number | null;
  issuing_organization: string | null;
  organization_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useCertificationCatalog(opts: { activeOnly?: boolean } = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['certification-catalog', { activeOnly: !!opts.activeOnly }],
    queryFn: async () => {
      let q = supabase.from('certification_catalog').select('*').order('name');
      if (opts.activeOnly) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CertificationCatalogEntry[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Omit<Partial<CertificationCatalogEntry>, 'id' | 'created_at' | 'updated_at'> & { name: string }) => {
      const { error } = await supabase.from('certification_catalog').insert({
        name: input.name.trim(),
        category: input.category?.trim() || null,
        default_validity_months: input.default_validity_months ?? null,
        issuing_organization: input.issuing_organization?.trim() || null,
        organization_id: input.organization_id ?? null,
        is_active: input.is_active ?? true,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certification-catalog'] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CertificationCatalogEntry> & { id: string }) => {
      const { error } = await supabase.from('certification_catalog').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certification-catalog'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('certification_catalog').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certification-catalog'] }),
  });

  return { entries: list.data ?? [], isLoading: list.isLoading, create, update, remove };
}
