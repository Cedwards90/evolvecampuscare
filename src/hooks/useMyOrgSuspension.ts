import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MyOrgSuspension {
  suspended: boolean;
  orgId: string | null;
  orgName: string | null;
  reason: string | null;
  suspendedAt: string | null;
}

/**
 * Returns whether the current user belongs to any suspended organization.
 * Checks both their profile.organization_id and active memberships.
 */
export function useMyOrgSuspension() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-org-suspension', user?.id],
    enabled: !!user,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<MyOrgSuspension> => {
      const none: MyOrgSuspension = {
        suspended: false, orgId: null, orgName: null, reason: null, suspendedAt: null,
      };
      if (!user) return none;

      // Collect candidate org ids from profile + active memberships
      const [{ data: profile }, { data: memberships }] = await Promise.all([
        supabase.from('profiles').select('organization_id').eq('user_id', user.id).maybeSingle(),
        supabase.from('organization_memberships').select('organization_id')
          .eq('user_id', user.id).is('left_at', null),
      ]);

      const ids = new Set<string>();
      if (profile?.organization_id) ids.add(profile.organization_id);
      (memberships ?? []).forEach((m: any) => m.organization_id && ids.add(m.organization_id));
      if (ids.size === 0) return none;

      const { data: orgs } = await supabase
        .from('training_organizations')
        .select('id, name, suspended_at, suspension_reason')
        .in('id', Array.from(ids))
        .not('suspended_at', 'is', null);

      const suspended = (orgs ?? [])[0] as any;
      if (!suspended) return none;
      return {
        suspended: true,
        orgId: suspended.id,
        orgName: suspended.name,
        reason: suspended.suspension_reason ?? null,
        suspendedAt: suspended.suspended_at ?? null,
      };
    },
  });
}
