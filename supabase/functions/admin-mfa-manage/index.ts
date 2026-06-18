import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SetExemptBody {
  action: "set_exempt";
  user_id: string;
  exempt: boolean;
  reason?: string | null;
}
interface UnenrollBody {
  action: "force_unenroll";
  user_id: string;
  reason?: string | null;
}
interface ListFactorsBody {
  action: "list_factors";
  user_id: string;
}
type Body = SetExemptBody | UnenrollBody | ListFactorsBody;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const actorId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    // Must be admin
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", actorId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) return json({ error: "Admin role required" }, 403);

    const body = (await req.json()) as Body;
    if (!body.user_id || typeof body.user_id !== "string") {
      return json({ error: "user_id required" }, 400);
    }

    if (body.action === "list_factors") {
      const { data: factors, error } = await (admin as any).auth.admin.mfa.listFactors({
        userId: body.user_id,
      });
      if (error) return json({ error: error.message }, 400);
      const verified = (factors?.factors ?? []).filter((f: any) => f.status === "verified");
      return json({ factors: factors?.factors ?? [], verified_count: verified.length });
    }

    if (body.action === "set_exempt") {
      const exempt = !!body.exempt;
      const patch: Record<string, unknown> = {
        mfa_exempt: exempt,
        mfa_exempt_at: exempt ? new Date().toISOString() : null,
        mfa_exempt_by: exempt ? actorId : null,
        mfa_exempt_reason: exempt ? (body.reason ?? null) : null,
      };
      const { error: pErr } = await admin
        .from("profiles")
        .update(patch)
        .eq("user_id", body.user_id);
      if (pErr) return json({ error: pErr.message }, 400);

      await admin.from("mfa_exemption_audit").insert({
        user_id: body.user_id,
        actor_id: actorId,
        action: exempt ? "exempt_granted" : "exempt_revoked",
        reason: body.reason ?? null,
      });
      return json({ ok: true, exempt });
    }

    if (body.action === "force_unenroll") {
      const { data: factorsRes, error: lfErr } = await (admin as any).auth.admin.mfa.listFactors({
        userId: body.user_id,
      });
      if (lfErr) return json({ error: lfErr.message }, 400);
      const factors = factorsRes?.factors ?? [];
      let removed = 0;
      for (const f of factors) {
        const { error: dErr } = await (admin as any).auth.admin.mfa.deleteFactor({
          userId: body.user_id,
          id: f.id,
        });
        if (!dErr) removed++;
      }
      await admin.from("mfa_exemption_audit").insert({
        user_id: body.user_id,
        actor_id: actorId,
        action: "force_unenroll",
        reason: body.reason ?? `Removed ${removed} factor(s)`,
      });
      return json({ ok: true, removed });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
