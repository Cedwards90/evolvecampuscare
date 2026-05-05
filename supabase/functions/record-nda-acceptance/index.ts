import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function clientIp(req: Request): string | null {
  const fwd =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for");
  if (!fwd) return null;
  return fwd.split(",")[0].trim().slice(0, 64) || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const ndaDocumentId = String(body?.nda_document_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(ndaDocumentId)) {
      return new Response(JSON.stringify({ error: "Invalid nda_document_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify it's the current NDA
    const { data: nda, error: ndaErr } = await admin
      .from("nda_documents")
      .select("id, version, is_current")
      .eq("id", ndaDocumentId)
      .maybeSingle();
    if (ndaErr || !nda || !nda.is_current) {
      return new Response(JSON.stringify({ error: "NDA not current" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = clientIp(req);
    const ua = (req.headers.get("user-agent") || "").slice(0, 512);

    const { error: insErr } = await admin.from("nda_acceptances").upsert(
      {
        user_id: user.id,
        nda_document_id: nda.id,
        version: nda.version,
        ip_address: ip,
        user_agent: ua,
      },
      { onConflict: "user_id,nda_document_id" },
    );
    if (insErr) {
      return new Response(JSON.stringify({ error: "Failed to record" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
