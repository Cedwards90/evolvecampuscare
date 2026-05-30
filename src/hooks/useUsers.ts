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
  deactivated_at: string | null;
  deactivated_by: string | null;
  deactivation_reason: string | null;
  reactivated_at: string | null;
  reactivated_by: string | null;
  is_active: boolean;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async (): Promise<UserWithRole[]> => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, email, full_name, avatar_url, created_at, organization_id, deactivated_at, deactivated_by, deactivation_reason, reactivated_at, reactivated_by')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const { data: memberships, error: memError } = await supabase
        .from('organization_memberships')
        .select('user_id, organization_id, training_organizations(name)')
        .is('left_at', null);

      if (memError) throw memError;

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      const membershipMap = new Map(
        (memberships || []).map((m: any) => [
          m.user_id,
          { organization_id: m.organization_id, organization_name: m.training_organizations?.name || null },
        ])
      );

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

      return (profiles || []).map((profile: any) => {
        const membership = membershipMap.get(profile.user_id);
        const orgId = profile.organization_id || membership?.organization_id || null;
        const orgName = membership?.organization_name || (orgId ? orgNameMap.get(orgId) || null : null);

        return {
          ...profile,
          organization_id: orgId,
          organization_name: orgName,
          role: (roleMap.get(profile.user_id) || 'student') as AppRole,
          is_active: !profile.deactivated_at,
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
      queryClient.invalidateQueries({ queryKey: ['case-managers'] });
      queryClient.invalidateQueries({ queryKey: ['student-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-students'] });
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

export function useSetUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, active, reason }: { userId: string; active: boolean; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke('set-user-active', {
        body: { userId, active, reason },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onMutate: async ({ userId, active, reason }) => {
      await queryClient.cancelQueries({ queryKey: ['users-with-roles'] });
      const previous = queryClient.getQueryData<UserWithRole[]>(['users-with-roles']);
      if (previous) {
        const now = new Date().toISOString();
        queryClient.setQueryData<UserWithRole[]>(['users-with-roles'], previous.map(u =>
          u.user_id === userId
            ? {
                ...u,
                is_active: active,
                deactivated_at: active ? null : now,
                deactivation_reason: active ? null : (reason ?? null),
                reactivated_at: active ? now : u.reactivated_at,
              }
            : u
        ));
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['users-with-roles'], ctx.previous);
    },
    onSettled: (_d, _e, vars) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['user-status-history', vars.userId] });
    },
  });
}

export interface UserStatusAuditEntry {
  id: string;
  user_id: string;
  actor_id: string;
  action: 'deactivated' | 'reactivated';
  reason: string | null;
  created_at: string;
  actor_name?: string | null;
  actor_email?: string | null;
}

export function useUserStatusHistory(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['user-status-history', userId],
    enabled: !!userId,
    queryFn: async (): Promise<UserStatusAuditEntry[]> => {
      const { data, error } = await supabase
        .from('user_status_audit')
        .select('id, user_id, actor_id, action, reason, created_at')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as UserStatusAuditEntry[];
      const actorIds = [...new Set(rows.map(r => r.actor_id))];
      if (actorIds.length > 0) {
        const { data: actors } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', actorIds);
        const map = new Map((actors || []).map(a => [a.user_id, a]));
        return rows.map(r => ({
          ...r,
          actor_name: map.get(r.actor_id)?.full_name ?? null,
          actor_email: map.get(r.actor_id)?.email ?? null,
        }));
      }
      return rows;
    },
  });
}
