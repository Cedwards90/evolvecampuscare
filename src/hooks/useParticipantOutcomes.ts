import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useParticipantOutcome(studentId: string | undefined) {
  return useQuery({
    queryKey: ["participant-outcome", studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const { data, error } = await supabase
        .from("participant_outcomes")
        .select("*")
        .eq("student_id", studentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
  });
}

export function useUpsertParticipantOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => {
      const { data: u } = await supabase.auth.getUser();
      const payload = { ...input, updated_by: u.user?.id };
      const { error, data } = await supabase
        .from("participant_outcomes")
        .upsert(payload, { onConflict: "student_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["participant-outcome", v.student_id] });
      qc.invalidateQueries({ queryKey: ["impact-metrics"] });
    },
  });
}

export function useMyDemographics() {
  return useQuery({
    queryKey: ["my-demographics"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from("participant_demographics")
        .select("*")
        .eq("student_id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertMyDemographics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const payload = {
        ...input,
        student_id: u.user.id,
        consent_at: new Date().toISOString(),
        consent_version: "1",
      };
      const { error } = await supabase
        .from("participant_demographics")
        .upsert(payload, { onConflict: "student_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-demographics"] });
    },
  });
}
