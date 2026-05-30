// supabase/functions/get-participant-export-url/index.ts
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

    const { export_id } = await req.json();
    if (!export_id) return j({ error: "export_id required" }, 400);

    const service = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: exp, error } = await service.from("participant_record_exports").select("*").eq("id", export_id).maybeSingle();
    if (error || !exp) return j({ error: "Not found" }, 404);

    const { data: canManage } = await userClient.rpc("can_staff_manage_student", { _actor: u.user.id, _student_id: exp.student_id });
    if (!canManage) return j({ error: "Forbidden" }, 403);

    const { data: signed, error: sErr } = await service.storage.from("participant-exports").createSignedUrl(exp.file_path, 60 * 10);
    if (sErr) throw sErr;

    await service.from("participant_record_access_log").insert({
      export_id: exp.id,
      actor_id: u.user.id,
      action: "download",
      ip: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return j({ signed_url: signed.signedUrl });
  } catch (e) {
    console.error("get-participant-export-url", e);
    return j({ error: (e as Error).message }, 500);
  }
});

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
