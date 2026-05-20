import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ImpactScope {
  organization_id?: string | null;
  cohort_start_date?: string | null;
  case_manager_id?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  demographic_filters?: Record<string, string> | null;
}

export interface ImpactMetrics {
  generated_at: string;
  scope: ImpactScope;
  participant_growth: {
    total_participants: number;
    certifications_earned: number;
    certifications_in_range: number;
    job_placements: number;
    placements_in_range: number;
    avg_baseline_wage: number;
    avg_current_wage: number;
    wage_growth_pct: number;
    retention: { d30: number; d60: number; d90: number; d180: number; d365: number };
    program_completed: number;
    completion_rate_pct: number;
    attendance_rate_pct: number;
    appointments_total: number;
    appointments_attended: number;
    check_in_count: number;
    avg_check_ins_per_participant: number;
    support_requests_total: number;
    support_requests_resolved: number;
    avg_resolution_hours: number;
  };
  social_impact: {
    surveys: Record<
      string,
      {
        title: string;
        response_count: number;
        avg_score: number | null;
        sample_size: number;
        suppressed?: boolean;
      }
    >;
    has_mentor_count: number;
  };
  funding_goals: any[];
  demographic_breakdown: Record<string, Record<string, number>> | null;
  trends: Array<{
    month: string;
    placements: number;
    certifications: number;
    requests_resolved: number;
  }>;
}

export function useImpactMetrics(scope: ImpactScope) {
  return useQuery({
    queryKey: ["impact-metrics", scope],
    queryFn: async (): Promise<ImpactMetrics> => {
      const { data, error } = await supabase.functions.invoke("impact-metrics-aggregate", {
        body: scope,
      });
      if (error) throw new Error(error.message || "Failed to load impact metrics");
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as ImpactMetrics;
    },
    staleTime: 60_000,
  });
}
