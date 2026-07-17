import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EditableProfileFields {
  full_name?: string | null;
  legal_first_name?: string | null;
  legal_last_name?: string | null;
  preferred_name?: string | null;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state_region?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

/**
 * Update a user's profile. RLS enforces role-based permissions:
 *   - Self-edit allowed by existing profile policies.
 *   - Staff edits (admin / case_manager / org_admin) allowed by policy.
 * The `profile_edit_audit` DB trigger records field-level changes automatically.
 */
export function useEditProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      changes,
      markReviewed = false,
    }: {
      userId: string;
      changes: EditableProfileFields;
      markReviewed?: boolean;
    }) => {
      const payload: Record<string, unknown> = { ...changes };
      if (markReviewed) payload.profile_last_reviewed_at = new Date().toISOString();
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['student-detail', vars.userId] });
      queryClient.invalidateQueries({ queryKey: ['profile', vars.userId] });
      queryClient.invalidateQueries({ queryKey: ['profile-audit', vars.userId] });
    },
  });
}

export interface ProfileAuditEntry {
  id: string;
  profile_user_id: string;
  actor_id: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  actor_name?: string | null;
  actor_email?: string | null;
}

export function useProfileAudit(userId: string | null | undefined, limit = 100) {
  return useQuery({
    queryKey: ['profile-audit', userId, limit],
    enabled: !!userId,
    queryFn: async (): Promise<ProfileAuditEntry[]> => {
      const { data, error } = await supabase
        .from('profile_edit_audit')
        .select('id, profile_user_id, actor_id, field, old_value, new_value, created_at')
        .eq('profile_user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = (data || []) as ProfileAuditEntry[];
      const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((v): v is string => !!v))];
      if (actorIds.length === 0) return rows;
      const { data: actors } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', actorIds);
      const map = new Map((actors || []).map((a) => [a.user_id, a]));
      return rows.map((r) => ({
        ...r,
        actor_name: r.actor_id ? map.get(r.actor_id)?.full_name ?? null : null,
        actor_email: r.actor_id ? map.get(r.actor_id)?.email ?? null : null,
      }));
    },
  });
}
