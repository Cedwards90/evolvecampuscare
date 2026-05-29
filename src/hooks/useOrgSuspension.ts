import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OrgSuspensionAuditRow {
  id: string;
  organization_id: string;
  actor_id: string;
  action: 'suspended' | 'reinstated';
  reason: string | null;
  created_at: string;
}

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  ['training-organizations', 'organization-detail', 'organization-members',
   'users', 'users-with-roles', 'student-folders', 'student-detail',
   'requests', 'analytics', 'workload-analytics', 'case-manager-stats',
   'my-org-suspension', 'org-suspension-audit'
  ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
};

export function useSuspendOrg() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ orgId, reason }: { orgId: string; reason: string }) => {
      const { error } = await supabase
        .from('training_organizations')
        .update({
          suspended_at: new Date().toISOString(),
          suspended_by: user?.id ?? null,
          suspension_reason: reason || null,
        })
        .eq('id', orgId);
      if (error) throw error;
      const { error: auditErr } = await supabase.from('org_suspension_audit').insert({
        organization_id: orgId,
        actor_id: user!.id,
        action: 'suspended',
        reason: reason || null,
      });
      if (auditErr) throw auditErr;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useReinstateOrg() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ orgId, reason }: { orgId: string; reason?: string }) => {
      const { error } = await supabase
        .from('training_organizations')
        .update({
          suspended_at: null,
          suspended_by: null,
          suspension_reason: null,
        })
        .eq('id', orgId);
      if (error) throw error;
      const { error: auditErr } = await supabase.from('org_suspension_audit').insert({
        organization_id: orgId,
        actor_id: user!.id,
        action: 'reinstated',
        reason: reason || null,
      });
      if (auditErr) throw auditErr;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useOrgSuspensionAudit(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-suspension-audit', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<OrgSuspensionAuditRow[]> => {
      const { data, error } = await supabase
        .from('org_suspension_audit')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrgSuspensionAuditRow[];
    },
  });
}
