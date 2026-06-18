import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ClockInBody {
  action: "clock_in";
  student_id?: string | null;
  service_type?: string;
  notes?: string | null;
}
interface ClockOutBody {
  action: "clock_out";
  notes?: string | null;
  billable?: boolean;
}
interface CancelBody {
  action: "cancel";
}
type Body = ClockInBody | ClockOutBody | CancelBody;

const VALID_SERVICES = new Set([
  "direct_service",
  "case_management",
  "documentation",
  "meeting",
  "outreach",
  "travel",
  "other",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing auth" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const uid = userData.user.id;

    // Check role: must be case_manager or admin
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("case_manager") && !roleSet.has("admin")) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = (await req.json()) as Body;

    if (body.action === "clock_in") {
      const svc = body.service_type && VALID_SERVICES.has(body.service_type)
        ? body.service_type
        : "case_management";
      const { data: existing } = await admin
        .from("active_time_sessions")
        .select("case_manager_id")
        .eq("case_manager_id", uid)
        .maybeSingle();
      if (existing) return json({ error: "Already clocked in" }, 409);

      const { data, error } = await admin
        .from("active_time_sessions")
        .insert({
          case_manager_id: uid,
          start_time: new Date().toISOString(),
          student_id: body.student_id ?? null,
          service_type: svc,
          notes: body.notes ?? null,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ session: data });
    }

    if (body.action === "cancel") {
      const { error } = await admin
        .from("active_time_sessions")
        .delete()
        .eq("case_manager_id", uid);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === "clock_out") {
      const { data: session, error: sessErr } = await admin
        .from("active_time_sessions")
        .select("*")
        .eq("case_manager_id", uid)
        .maybeSingle();
      if (sessErr) return json({ error: sessErr.message }, 400);
      if (!session) return json({ error: "No active shift" }, 404);

      const end = new Date();
      const start = new Date(session.start_time);
      if (end <= start) return json({ error: "End must be after start" }, 400);

      const entryDate = end.toISOString().slice(0, 10);
      const combinedNotes = [session.notes, body.notes]
        .filter(Boolean)
        .join("\n")
        .trim() || null;

      const { data: entry, error: insErr } = await admin
        .from("time_entries")
        .insert({
          case_manager_id: uid,
          student_id: session.student_id,
          service_type: session.service_type,
          start_time: session.start_time,
          end_time: end.toISOString(),
          entry_date: entryDate,
          notes: combinedNotes,
          billable: body.billable ?? true,
          status: "pending",
        })
        .select()
        .single();
      if (insErr) return json({ error: insErr.message }, 400);

      await admin.from("active_time_sessions").delete().eq("case_manager_id", uid);
      return json({ entry });
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
