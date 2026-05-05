import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface NdaDocument {
  id: string;
  version: number;
  title: string;
  body_markdown: string;
  effective_at: string;
  is_current: boolean;
  created_at: string;
}

export function useCurrentNda() {
  return useQuery({
    queryKey: ["nda", "current"],
    queryFn: async (): Promise<NdaDocument | null> => {
      const { data, error } = await supabase
        .from("nda_documents")
        .select("*")
        .eq("is_current", true)
        .maybeSingle();
      if (error) throw error;
      return data as NdaDocument | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyNdaAcceptance(ndaDocumentId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["nda", "acceptance", user?.id, ndaDocumentId],
    enabled: !!user?.id && !!ndaDocumentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nda_acceptances")
        .select("id, accepted_at, version")
        .eq("user_id", user!.id)
        .eq("nda_document_id", ndaDocumentId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
  });
}

export function useAcceptNda() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (ndaDocumentId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "record-nda-acceptance",
        { body: { nda_document_id: ndaDocumentId } },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nda", "acceptance", user?.id] });
    },
  });
}
