// supabase/functions/acknowledge-participant-transfer/index.ts
// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return j({ error: "Missing auth" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return j({ error: "Unauthorized" }, 401);

    const { transfer_id, notes } = await req.json();
    if (!transfer_id) return j({ error: "transfer_id required" }, 400);

    const service = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: t, error } = await service.from("participant_transfers").select("*").eq("id", transfer_id).maybeSingle();
    if (error || !t) return j({ error: "Not found" }, 404);
    if (t.status !== "pending") return j({ error: `Cannot acknowledge a ${t.status} transfer` }, 400);

    // Must be org admin of receiving org
    const { data: isAdmin } = await userClient.rpc("is_org_admin_of", { _user_id: u.user.id, _org_id: t.to_organization_id });
    if (!isAdmin) return j({ error: "Forbidden" }, 403);

    const { error: updErr } = await service.from("participant_transfers").update({
      status: "acknowledged",
      acknowledged_by: u.user.id,
      acknowledged_at: new Date().toISOString(),
      acknowledgement_notes: notes || null,
    }).eq("id", transfer_id);
    if (updErr) throw updErr;

    await service.from("participant_transfer_events").insert({
      transfer_id,
      actor_id: u.user.id,
      event_type: "acknowledged",
      metadata: { notes: notes || null },
    });

    return j({ ok: true });
  } catch (e) {
    console.error("acknowledge-participant-transfer", e);
    return j({ error: (e as Error).message }, 500);
  }
});

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
