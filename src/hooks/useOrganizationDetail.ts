import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrgMember {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  joined_at: string;
  left_at: string | null;
}

export function useOrganizationDetail(orgId: string | undefined) {
  const orgQuery = useQuery({
    queryKey: ['organization-detail', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('training_organizations')
        .select('*')
        .eq('id', orgId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const membersQuery = useQuery({
    queryKey: ['organization-members', orgId],
    queryFn: async (): Promise<OrgMember[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('organization_memberships')
        .select('user_id, joined_at, left_at')
        .eq('organization_id', orgId)
        .order('joined_at', { ascending: false });
      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Get profiles and roles for these users
      const userIds = [...new Set(data.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));

      return data.map(m => ({
        user_id: m.user_id,
        full_name: profileMap.get(m.user_id)?.full_name || null,
        email: profileMap.get(m.user_id)?.email || '',
        role: roleMap.get(m.user_id) || 'student',
        joined_at: m.joined_at,
        left_at: m.left_at,
      }));
    },
    enabled: !!orgId,
  });

  const statsQuery = useQuery({
    queryKey: ['organization-request-stats', orgId],
    queryFn: async () => {
      if (!orgId) return { total: 0, pending: 0, resolved: 0 };
      // Get all current member user_ids
      const { data: members } = await supabase
        .from('organization_memberships')
        .select('user_id')
        .eq('organization_id', orgId);
      if (!members || members.length === 0) return { total: 0, pending: 0, resolved: 0 };

      const userIds = [...new Set(members.map(m => m.user_id))];
      const { data: requests } = await supabase
        .from('support_requests')
        .select('status')
        .in('student_id', userIds);

      const all = requests || [];
      return {
        total: all.length,
        pending: all.filter(r => r.status === 'submitted' || r.status === 'in_progress').length,
        resolved: all.filter(r => r.status === 'resolved').length,
      };
    },
    enabled: !!orgId,
  });

  return { org: orgQuery, members: membersQuery, stats: statsQuery };
}
