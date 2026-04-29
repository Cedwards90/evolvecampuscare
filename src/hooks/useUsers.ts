import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/types/database';

export interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole;
  created_at: string;
  organization_id: string | null;
  organization_name: string | null;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async (): Promise<UserWithRole[]> => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, email, full_name, avatar_url, created_at, organization_id')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch active memberships with org names
      const { data: memberships, error: memError } = await supabase
        .from('organization_memberships')
        .select('user_id, organization_id, training_organizations(name)')
        .is('left_at', null);

      if (memError) throw memError;

      // Build lookup maps
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      const membershipMap = new Map(
        (memberships || []).map((m: any) => [
          m.user_id,
          { organization_id: m.organization_id, organization_name: m.training_organizations?.name || null },
        ])
      );

      // Fetch org names for profiles that have organization_id but no membership
      const orgIds = new Set(
        (profiles || [])
          .map(p => p.organization_id)
          .filter((id): id is string => !!id)
      );
      
      let orgNameMap = new Map<string, string>();
      if (orgIds.size > 0) {
        const { data: orgs } = await supabase
          .from('training_organizations')
          .select('id, name')
          .in('id', [...orgIds]);
        orgNameMap = new Map((orgs || []).map(o => [o.id, o.name]));
      }

      return (profiles || []).map(profile => {
        const membership = membershipMap.get(profile.user_id);
        const orgId = profile.organization_id || membership?.organization_id || null;
        const orgName = membership?.organization_name || (orgId ? orgNameMap.get(orgId) || null : null);

        return {
          ...profile,
          organization_id: orgId,
          organization_name: orgName,
          role: (roleMap.get(profile.user_id) || 'student') as AppRole,
        };
      });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['case-managers'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}
