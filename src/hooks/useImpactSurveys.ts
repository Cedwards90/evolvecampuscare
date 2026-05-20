import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ImpactSurveyTemplate {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cadence_days: number;
  questions: Array<{ key: string; label: string; type: string }>;
  is_active: boolean;
  is_builtin: boolean;
}

export function useImpactSurveyTemplates(activeOnly = false) {
  return useQuery({
    queryKey: ["impact-survey-templates", activeOnly],
    queryFn: async () => {
      let q = supabase.from("impact_survey_templates").select("*").order("title");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ImpactSurveyTemplate[];
    },
  });
}

export function useImpactSurveyTemplate(slug: string | undefined) {
  return useQuery({
    queryKey: ["impact-survey-template", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("impact_survey_templates")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as ImpactSurveyTemplate | null;
    },
    enabled: !!slug,
  });
}

export function useUpsertSurveyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ImpactSurveyTemplate> & { slug: string; title: string }) => {
      const payload: any = { ...input };
      const { data, error } = payload.id
        ? await supabase.from("impact_survey_templates").update(payload).eq("id", payload.id).select().single()
        : await supabase.from("impact_survey_templates").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["impact-survey-templates"] }),
  });
}

export function useMyImpactSurveys() {
  return useQuery({
    queryKey: ["my-impact-surveys"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data: tpls } = await supabase
        .from("impact_survey_templates")
        .select("*")
        .eq("is_active", true);
      const { data: responses } = await supabase
        .from("impact_survey_responses")
        .select("template_id, submitted_at")
        .eq("student_id", u.user.id)
        .order("submitted_at", { ascending: false });
      const latestByTpl: Record<string, string> = {};
      (responses || []).forEach((r: any) => {
        if (!latestByTpl[r.template_id]) latestByTpl[r.template_id] = r.submitted_at;
      });
      return (tpls || []).map((t: any) => {
        const last = latestByTpl[t.id];
        const nextDue = last
          ? new Date(new Date(last).getTime() + t.cadence_days * 86400000)
          : new Date();
        return {
          template: t as ImpactSurveyTemplate,
          last_completed_at: last || null,
          next_due_at: nextDue.toISOString(),
          is_due: !last || nextDue <= new Date(),
        };
      });
    },
  });
}

export function useSubmitImpactSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { templateId: string; responses: Record<string, any> }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      // Compute a simple 0-100 score from likert (1-5) answers, treating likert_negative reversed
      const { data: tpl } = await supabase
        .from("impact_survey_templates")
        .select("questions")
        .eq("id", args.templateId)
        .single();
      const qs: any[] = (tpl?.questions as any[]) || [];
      let sum = 0;
      let count = 0;
      for (const q of qs) {
        const v = args.responses[q.key];
        if (q.type === "likert" && typeof v === "number") {
          sum += ((v - 1) / 4) * 100;
          count += 1;
        } else if (q.type === "likert_negative" && typeof v === "number") {
          sum += ((5 - v) / 4) * 100;
          count += 1;
        } else if (q.type === "boolean" && typeof v === "boolean") {
          sum += v ? 100 : 0;
          count += 1;
        }
      }
      const score = count > 0 ? Math.round(sum / count) : null;
      const { error } = await supabase.from("impact_survey_responses").insert({
        student_id: u.user.id,
        template_id: args.templateId,
        responses: args.responses,
        score_summary: { score, item_count: count },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-impact-surveys"] });
      qc.invalidateQueries({ queryKey: ["impact-metrics"] });
    },
  });
}
