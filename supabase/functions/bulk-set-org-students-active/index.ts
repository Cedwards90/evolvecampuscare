import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, sanitizeError } from "../_shared/security.ts";

interface Body {
  organizationId?: string;
  active?: boolean;
  mode?: "preview" | "apply";
  reason?: string;
  confirmation?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body) return json({ error: "Invalid JSON" }, 400);

    const { organizationId, active, mode = "preview" } = body;
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined;
    const confirmation = typeof body.confirmation === "string" ? body.confirmation : "";

    if (!organizationId || !UUID_RE.test(organizationId)) {
      return json({ error: "Valid organizationId is required" }, 400);
    }
    if (typeof active !== "boolean") return json({ error: "active (boolean) required" }, 400);
    if (mode !== "preview" && mode !== "apply") return json({ error: "Invalid mode" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Admin role required" }, 403);

    // Resolve all student user_ids in the org (profiles.org or active membership)
    const [profilesRes, membersRes, rolesRes] = await Promise.all([
      admin.from("profiles").select("user_id").eq("organization_id", organizationId),
      admin
        .from("organization_memberships")
        .select("user_id")
        .eq("organization_id", organizationId)
        .is("left_at", null),
      admin.from("user_roles").select("user_id, role").eq("role", "student"),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (membersRes.error) throw membersRes.error;
    if (rolesRes.error) throw rolesRes.error;

    const studentSet = new Set((rolesRes.data ?? []).map((r) => r.user_id));
    const candidateIds = new Set<string>();
    for (const r of profilesRes.data ?? []) if (studentSet.has(r.user_id)) candidateIds.add(r.user_id);
    for (const r of membersRes.data ?? []) if (studentSet.has(r.user_id)) candidateIds.add(r.user_id);
    candidateIds.delete(user.id);

    if (candidateIds.size === 0) {
      return json({ count: 0, totalAffected: 0, sample: [], batchId: null });
    }

    // Filter by current activation status
    const idsArr = Array.from(candidateIds);
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("user_id, full_name, email, deactivated_at")
      .in("user_id", idsArr);
    if (pErr) throw pErr;

    const affected = (profiles ?? []).filter((p) =>
      active ? p.deactivated_at !== null : p.deactivated_at === null
    );

    const sample = affected.slice(0, 25).map((p) => ({
      user_id: p.user_id,
      full_name: p.full_name,
      email: p.email,
    }));

    if (mode === "preview") {
      return json({
        count: affected.length,
        totalAffected: affected.length,
        sample,
      });
    }

    // Apply mode
    if (!active && confirmation !== "DEACTIVATE") {
      return json({ error: "Confirmation 'DEACTIVATE' required" }, 400);
    }
    if (active && confirmation !== "REACTIVATE") {
      return json({ error: "Confirmation 'REACTIVATE' required" }, 400);
    }
    if (!active && (!reason || reason.trim().length < 3)) {
      return json({ error: "Reason is required when deactivating" }, 400);
    }

    const batchId = crypto.randomUUID();
    const now = new Date().toISOString();
    const taggedReason = `[BULK:org=${organizationId}:batch=${batchId}] ${reason ?? ""}`.trim();

    const update = active
      ? {
          deactivated_at: null,
          deactivated_by: null,
          deactivation_reason: null,
          reactivated_at: now,
          reactivated_by: user.id,
        }
      : {
          deactivated_at: now,
          deactivated_by: user.id,
          deactivation_reason: taggedReason,
        };

    let processed = 0;
    let failed = 0;
    const BATCH = 50;
    for (let i = 0; i < affected.length; i += BATCH) {
      const slice = affected.slice(i, i + BATCH);
      const ids = slice.map((p) => p.user_id);

      const { error: upErr } = await admin.from("profiles").update(update).in("user_id", ids);
      if (upErr) {
        console.error("bulk update error", upErr);
        failed += ids.length;
        continue;
      }

      const auditRows = ids.map((uid) => ({
        user_id: uid,
        actor_id: user.id,
        action: active ? "reactivated" : "deactivated",
        reason: taggedReason,
      }));
      const { error: audErr } = await admin.from("user_status_audit").insert(auditRows);
      if (audErr) console.error("audit insert error", audErr);

      if (!active) {
        for (const uid of ids) {
          try {
            await admin.auth.admin.signOut(uid, "global");
          } catch (e) {
            console.warn("signOut failed", uid, e);
          }
        }
      }
      processed += ids.length;
    }

    return json({
      success: true,
      batchId,
      processed,
      failed,
      skipped: 0,
      sample,
      organizationId,
      action: active ? "reactivated" : "deactivated",
    });
  } catch (err) {
    return json({ error: sanitizeError(err, "bulk-set-org-students-active") }, 500);
  }
});
