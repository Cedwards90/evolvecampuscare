import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BulkPreviewResult {
  count: number;
  totalAffected: number;
  sample: Array<{ user_id: string; full_name: string | null; email: string }>;
}

export interface BulkApplyResult {
  success: true;
  batchId: string;
  processed: number;
  failed: number;
  skipped: number;
  organizationId: string;
  action: "deactivated" | "reactivated";
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("bulk-set-org-students-active", { body });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export function useBulkOrgStudentPreview(
  organizationId: string | undefined,
  active: boolean,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["bulk-org-student-preview", organizationId, active],
    enabled: enabled && !!organizationId,
    queryFn: () =>
      invoke<BulkPreviewResult>({
        organizationId,
        active,
        mode: "preview",
      }),
    staleTime: 0,
  });
}

export function useBulkOrgStudentApply(organizationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { active: boolean; reason: string; confirmation: string }) =>
      invoke<BulkApplyResult>({
        organizationId,
        active: vars.active,
        reason: vars.reason,
        confirmation: vars.confirmation,
        mode: "apply",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
      qc.invalidateQueries({ queryKey: ["organization-members", organizationId] });
      qc.invalidateQueries({ queryKey: ["user-status-audit"] });
      qc.invalidateQueries({ queryKey: ["bulk-org-student-preview", organizationId] });
    },
  });
}
