import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DonorReportTemplate {
  id: string;
  title: string;
  description: string | null;
  sections: string[];
  branding: Record<string, any>;
  is_active: boolean;
}

export function useDonorReportTemplates() {
  return useQuery({
    queryKey: ["donor-report-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donor_report_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as DonorReportTemplate[];
    },
  });
}

export function useUpsertDonorReportTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<DonorReportTemplate> & { title: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = { ...input };
      if (!payload.id) payload.created_by = u.user?.id;
      const { data, error } = payload.id
        ? await supabase.from("donor_report_templates").update(payload).eq("id", payload.id).select().single()
        : await supabase.from("donor_report_templates").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["donor-report-templates"] }),
  });
}

export function useDeleteDonorReportTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("donor_report_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["donor-report-templates"] }),
  });
}
