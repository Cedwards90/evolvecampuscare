import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FundingGoal {
  id: string;
  organization_id: string | null;
  title: string;
  description: string | null;
  metric_key: string;
  target_value: number;
  period_start: string;
  period_end: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useFundingGoals() {
  return useQuery({
    queryKey: ["funding-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funding_goals")
        .select("*")
        .order("period_end", { ascending: false });
      if (error) throw error;
      return (data || []) as FundingGoal[];
    },
  });
}

export function useUpsertFundingGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<FundingGoal> & { title: string; metric_key: string; target_value: number; period_start: string; period_end: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = { ...input };
      if (!payload.id) payload.created_by = u.user?.id;
      const { error, data } = payload.id
        ? await supabase.from("funding_goals").update(payload).eq("id", payload.id).select().single()
        : await supabase.from("funding_goals").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funding-goals"] });
      qc.invalidateQueries({ queryKey: ["impact-metrics"] });
    },
  });
}

export function useDeleteFundingGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funding_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funding-goals"] });
      qc.invalidateQueries({ queryKey: ["impact-metrics"] });
    },
  });
}
