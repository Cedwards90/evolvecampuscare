import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Orgs the current user administers (empty if not org_admin). */
export function useMyOrgAdminOrgs() {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ['org-admin-orgs', user?.id],
    enabled: !!user && role === 'org_admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_admins')
        .select('organization_id')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.organization_id as string);
    },
  });
}

/** Org assignments for a specific user (admin-only view). */
export function useOrgAdminAssignments(userId: string | null) {
  return useQuery({
    queryKey: ['org-admin-assignments', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_admins')
        .select('id, organization_id, created_at')
        .eq('user_id', userId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSetOrgAdminAssignments() {
  const qc = useQueryClient();
  const { user: actor } = useAuth();
  return useMutation({
    mutationFn: async ({
      userId,
      organizationIds,
    }: {
      userId: string;
      organizationIds: string[];
    }) => {
      // Strategy: delete all current rows for this user, then insert the desired set.
      const { error: delErr } = await supabase
        .from('org_admins')
        .delete()
        .eq('user_id', userId);
      if (delErr) throw delErr;

      if (organizationIds.length > 0) {
        const rows = organizationIds.map((orgId) => ({
          user_id: userId,
          organization_id: orgId,
          created_by: actor?.id ?? null,
        }));
        const { error: insErr } = await supabase.from('org_admins').insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['org-admin-assignments', vars.userId] });
      qc.invalidateQueries({ queryKey: ['org-admin-orgs'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
