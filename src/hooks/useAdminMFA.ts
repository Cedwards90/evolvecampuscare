import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useMFAFactors(userId: string | null) {
  return useQuery({
    queryKey: ['admin-mfa-factors', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-mfa-manage', {
        body: { action: 'list_factors', user_id: userId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { factors: any[]; verified_count: number };
    },
  });
}

export function useSetMFAExempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      user_id,
      exempt,
      reason,
    }: { user_id: string; exempt: boolean; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-mfa-manage', {
        body: { action: 'set_exempt', user_id, exempt, reason },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-with-roles'] });
      qc.invalidateQueries({ queryKey: ['mfa-audit'] });
    },
  });
}

export function useForceUnenrollMFA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ user_id, reason }: { user_id: string; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-mfa-manage', {
        body: { action: 'force_unenroll', user_id, reason },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-mfa-factors'] });
      qc.invalidateQueries({ queryKey: ['mfa-audit'] });
    },
  });
}

export function useMFAAudit(userId: string | null) {
  return useQuery({
    queryKey: ['mfa-audit', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mfa_exemption_audit')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}
