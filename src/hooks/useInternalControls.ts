import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const db = supabase as any;

export interface ControlsSettings {
  id: number;
  retention_months: number;
  designated_delete_admin_id: string | null;
  second_approval_threshold: number;
  spending_last_reconciled_at: string | null;
  spending_reconciled_by: string | null;
}

export function useControlsSettings() {
  return useQuery({
    queryKey: ['internal-controls-settings'],
    queryFn: async (): Promise<ControlsSettings | null> => {
      const { data, error } = await db
        .from('internal_controls_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return data as ControlsSettings | null;
    },
  });
}

export function useUpdateControlsSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (changes: Partial<Omit<ControlsSettings, 'id'>>) => {
      const { error } = await db.from('internal_controls_settings').update(changes).eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['internal-controls-settings'] }),
  });
}

/** True when the signed-in user is the one admin allowed to permanently delete. */
export function useIsDesignatedDeleteAdmin() {
  const { user, role } = useAuth();
  const { data } = useControlsSettings();
  return role === 'admin' && !!user && data?.designated_delete_admin_id === user.id;
}

export interface FundingSource {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export function useFundingSources(activeOnly = false) {
  return useQuery({
    queryKey: ['funding-sources', activeOnly],
    queryFn: async (): Promise<FundingSource[]> => {
      let q = db.from('funding_sources').select('*').order('name');
      if (activeOnly) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as FundingSource[];
    },
  });
}

export function useSaveFundingSource() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; description?: string | null; is_active?: boolean }) => {
      if (input.id) {
        const { error } = await db
          .from('funding_sources')
          .update({ name: input.name, description: input.description ?? null, is_active: input.is_active ?? true })
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await db.from('funding_sources').insert({
          name: input.name,
          description: input.description ?? null,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funding-sources'] }),
  });
}

export interface BudgetLine {
  id: string;
  code: string | null;
  name: string;
  grant_name: string | null;
  notes: string | null;
  is_active: boolean;
}

export function useBudgetLines() {
  return useQuery({
    queryKey: ['grant-budget-lines'],
    queryFn: async (): Promise<BudgetLine[]> => {
      const { data, error } = await db.from('grant_budget_lines').select('*').order('name');
      if (error) throw error;
      return (data || []) as BudgetLine[];
    },
  });
}

export function useSaveBudgetLine() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      code?: string | null;
      name: string;
      grant_name?: string | null;
      notes?: string | null;
      is_active?: boolean;
    }) => {
      const payload = {
        code: input.code ?? null,
        name: input.name,
        grant_name: input.grant_name ?? null,
        notes: input.notes ?? null,
        is_active: input.is_active ?? true,
      };
      if (input.id) {
        const { error } = await db.from('grant_budget_lines').update(payload).eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await db
          .from('grant_budget_lines')
          .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grant-budget-lines'] }),
  });
}

export function useDeleteBudgetLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('grant_budget_lines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grant-budget-lines'] });
      qc.invalidateQueries({ queryKey: ['category-budget-map'] });
    },
  });
}

export interface CategoryBudgetMapping {
  id: string;
  category: string;
  funding_source_id: string | null;
  budget_line_id: string;
}

export function useCategoryBudgetMap() {
  return useQuery({
    queryKey: ['category-budget-map'],
    queryFn: async (): Promise<CategoryBudgetMapping[]> => {
      const { data, error } = await db.from('request_category_budget_map').select('*');
      if (error) throw error;
      return (data || []) as CategoryBudgetMapping[];
    },
  });
}

export function useSaveCategoryMapping() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { category: string; fundingSourceId: string | null; budgetLineId: string | null }) => {
      const existing = await db
        .from('request_category_budget_map')
        .select('id')
        .eq('category', input.category)
        .is('funding_source_id', input.fundingSourceId === null ? null : undefined);

      const rows = (existing.data || []) as { id: string }[];
      const matchId = input.fundingSourceId
        ? (
            await db
              .from('request_category_budget_map')
              .select('id')
              .eq('category', input.category)
              .eq('funding_source_id', input.fundingSourceId)
          ).data?.[0]?.id
        : rows[0]?.id;

      if (!input.budgetLineId) {
        if (matchId) {
          const { error } = await db.from('request_category_budget_map').delete().eq('id', matchId);
          if (error) throw error;
        }
        return;
      }

      if (matchId) {
        const { error } = await db
          .from('request_category_budget_map')
          .update({ budget_line_id: input.budgetLineId })
          .eq('id', matchId);
        if (error) throw error;
      } else {
        const { error } = await db.from('request_category_budget_map').insert({
          category: input.category,
          funding_source_id: input.fundingSourceId,
          budget_line_id: input.budgetLineId,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['category-budget-map'] }),
  });
}

export interface DeleteAuditEntry {
  id: string;
  request_id: string;
  student_id: string | null;
  actor_id: string | null;
  reason: string;
  created_at: string;
  actor_name?: string | null;
}

export function useRequestDeleteLog() {
  return useQuery({
    queryKey: ['request-delete-audit'],
    queryFn: async (): Promise<DeleteAuditEntry[]> => {
      const { data, error } = await db
        .from('request_delete_audit')
        .select('id, request_id, student_id, actor_id, reason, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as DeleteAuditEntry[];
      const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
      if (actorIds.length === 0) return rows;
      const { data: actors } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', actorIds);
      const map = new Map((actors || []).map((a: any) => [a.user_id, a.full_name || a.email]));
      return rows.map((r) => ({ ...r, actor_name: r.actor_id ? map.get(r.actor_id) ?? null : null }));
    },
  });
}

export interface AccessReviewRow {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  is_active: boolean;
  mfa_exempt: boolean;
  last_sign_in_at: string | null;
}

/** Named-account access review: every account, its role, status and last sign-in. */
export function useAccessReview() {
  return useQuery({
    queryKey: ['access-review'],
    queryFn: async (): Promise<AccessReviewRow[]> => {
      const [profilesRes, rolesRes, loginsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, email, deactivated_at, mfa_exempt'),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('user_login_events').select('user_id, created_at').order('created_at', { ascending: false }),
      ]);
      if (profilesRes.error) throw profilesRes.error;

      const roleMap = new Map((rolesRes.data || []).map((r: any) => [r.user_id, r.role as string]));
      const lastLogin = new Map<string, string>();
      for (const ev of (loginsRes.data || []) as any[]) {
        if (!lastLogin.has(ev.user_id)) lastLogin.set(ev.user_id, ev.created_at);
      }

      return (profilesRes.data || []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name ?? null,
        email: p.email,
        role: roleMap.get(p.user_id) ?? 'student',
        is_active: !p.deactivated_at,
        mfa_exempt: !!p.mfa_exempt,
        last_sign_in_at: lastLogin.get(p.user_id) ?? null,
      }));
    },
  });
}

export interface ExportLogEntry {
  id: string;
  period_start: string;
  period_end: string;
  storage_path: string | null;
  created_at: string;
  row_counts: Record<string, number> | null;
}

export function useRetentionExportLog() {
  return useQuery({
    queryKey: ['retention-export-log'],
    queryFn: async (): Promise<ExportLogEntry[]> => {
      const { data, error } = await db
        .from('retention_export_log')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ExportLogEntry[];
    },
  });
}

export function useLogRetentionExport() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { periodStart: string; periodEnd: string; rowCounts?: Record<string, number> }) => {
      const { error } = await db.from('retention_export_log').insert({
        period_start: input.periodStart,
        period_end: input.periodEnd,
        row_counts: input.rowCounts ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['retention-export-log'] }),
  });
}

/** Requests with a recorded payment but no uploaded receipt attachment. */
export function useMissingReceipts() {
  return useQuery({
    queryKey: ['missing-receipts'],
    queryFn: async () => {
      const { data: paid, error } = await db
        .from('support_requests')
        .select('id, title, student_id, amount_paid, paid_at')
        .not('paid_at', 'is', null)
        .order('paid_at', { ascending: false });
      if (error) throw error;
      const rows = (paid || []) as any[];
      if (rows.length === 0) return [];
      const { data: attachments } = await supabase
        .from('request_attachments')
        .select('request_id')
        .in('request_id', rows.map((r) => r.id));
      const withFiles = new Set((attachments || []).map((a: any) => a.request_id));
      return rows.filter((r) => !withFiles.has(r.id));
    },
  });
}
