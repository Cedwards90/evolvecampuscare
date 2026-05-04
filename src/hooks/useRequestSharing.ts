import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

async function authedFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(`${FN_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
}

export function useDownloadRequestPdf() {
  return useMutation({
    mutationFn: async (requestId: string) => {
      const res = await authedFetch(`/generate-request-pdf?request_id=${requestId}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `request-${requestId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useEmailRequestPdf() {
  return useMutation({
    mutationFn: async (vars: { requestId: string; recipients: string[]; message?: string }) => {
      const res = await authedFetch(`/share-request-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: vars.requestId,
          mode: "email",
          recipients: vars.recipients,
          message: vars.message,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Email failed");
      return json;
    },
  });
}

export type ShareLink = {
  id: string;
  request_id: string;
  token: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_accessed_at: string | null;
  access_count: number;
  url?: string;
};

export function useShareLinks(requestId: string | undefined) {
  return useQuery({
    queryKey: ["share-links", requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("request_share_links")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ShareLink[];
    },
  });
}

export function useCreateShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { requestId: string; expiresInHours: number }) => {
      const res = await authedFetch(`/share-request-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: vars.requestId,
          mode: "create_link",
          expires_in_hours: vars.expiresInHours,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not create link");
      return json.link as ShareLink;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["share-links", v.requestId] }),
  });
}

export function useRevokeShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { requestId: string; linkId: string }) => {
      const res = await authedFetch(`/share-request-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: vars.requestId,
          mode: "revoke_link",
          link_id: vars.linkId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not revoke");
      return json;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["share-links", v.requestId] }),
  });
}

export function shareLinkUrl(token: string) {
  return `${window.location.origin}/shared/request/${token}`;
}
