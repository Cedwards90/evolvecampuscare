// Weekly student check-in reminders.
// Designed to be invoked by pg_cron twice a week:
//   - Monday  ~14:00 UTC: "first nudge" for students with no check-in in 7+ days
//   - Thursday ~14:00 UTC: "follow-up" for students still missing at 10+ days
// Idempotent per (student, ISO week, mode) via email_send_log lookup.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = "https://evolvecampuscare.lovable.app";

type Mode = "first" | "followup";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aB = new TextEncoder().encode(a);
  const bB = new TextEncoder().encode(b);
  let r = 0;
  for (let i = 0; i < aB.length; i++) r |= aB[i] ^ bB[i];
  return r === 0;
}

function validateCronSecret(provided: string | null): boolean {
  const s = Deno.env.get("CRON_SECRET");
  if (!s || s.length < 32) {
    console.error("CRON_SECRET not configured or too weak (must be 32+ chars)");
    return false;
  }
  if (!provided) return false;
  return timingSafeEqual(provided, s);
}

async function isAdminCaller(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(SUPABASE_URL, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return false;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    return (roles || []).some((r: any) => r.role === "admin");
  } catch {
    return false;
  }
}

function isoWeekKey(d = new Date()): string {
  // YYYY-WW style key in UTC
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function renderEmail(firstName: string, mode: Mode): { subject: string; html: string } {
  const greeting = firstName || "there";
  if (mode === "followup") {
    return {
      subject: "Reminder: your weekly check-in is waiting 📋",
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background:#ffffff;">
          <h2 style="color:#054D3B; margin-top:0;">Hi ${greeting},</h2>
          <p style="color:#333; line-height:1.6;">Just a friendly nudge — your weekly check-in is still open. It takes less than a minute and helps your case manager support you better.</p>
          <div style="text-align:center; margin:28px 0;">
            <a href="${APP_URL}/check-in" style="background:#054D3B; color:#fff; padding:12px 24px; border-radius:9999px; text-decoration:none; font-weight:600; display:inline-block;">Complete this week's check-in</a>
          </div>
          <p style="color:#666; font-size:13px;">If you've already checked in this week, you can safely ignore this email.</p>
          <hr style="border:none; border-top:1px solid #eee; margin:20px 0;" />
          <p style="color:#999; font-size:12px;">Evolve Foundation — Supporting your journey</p>
        </div>`,
    };
  }
  return {
    subject: "Time for your weekly check-in ✨",
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background:#ffffff;">
        <h2 style="color:#054D3B; margin-top:0;">Hi ${greeting} 👋</h2>
        <p style="color:#333; line-height:1.6;">It's time for your weekly check-in. Share how you're doing — your mood, recent wins, and anything that's getting in the way.</p>
        <p style="color:#333; line-height:1.6;">It only takes a minute, and it helps your case manager show up for you when it matters.</p>
        <div style="text-align:center; margin:28px 0;">
          <a href="${APP_URL}/check-in" style="background:#054D3B; color:#fff; padding:12px 24px; border-radius:9999px; text-decoration:none; font-weight:600; display:inline-block;">Complete check-in</a>
        </div>
        <hr style="border:none; border-top:1px solid #eee; margin:20px 0;" />
        <p style="color:#999; font-size:12px;">Evolve Foundation — Supporting your journey</p>
      </div>`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Require either cron secret or admin user
  const cronHeader = req.headers.get("X-Cron-Secret");
  const authorized = validateCronSecret(cronHeader) || (await isAdminCaller(req));
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let mode: Mode = "first";
    try {
      const body = await req.json();
      if (body?.mode === "followup") mode = "followup";
    } catch (_) { /* GET / empty body */ }

    // Respect site-wide notification toggles
    const { data: settingsRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "notifications")
      .maybeSingle();
    const settings: any = settingsRow?.value ?? {};
    const emailEnabled = settings?.email_enabled !== false;
    const checkinEnabled = settings?.types?.checkin_reminders !== false; // default true
    if (!emailEnabled || !checkinEnabled) {
      return new Response(JSON.stringify({ message: "Check-in reminders disabled", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const firstThreshold = new Date(now.getTime() - 7 * 86400000);   // ≥ 7d
    const followupThreshold = new Date(now.getTime() - 10 * 86400000); // ≥ 10d
    const accountMinAge = new Date(now.getTime() - 7 * 86400000);    // skip brand new accounts

    // All active students
    const { data: studentRoles, error: rolesError } = await supabase
      .from("user_roles").select("user_id").eq("role", "student");
    if (rolesError) throw rolesError;
    const studentIds = (studentRoles || []).map((r) => r.user_id);
    if (studentIds.length === 0) {
      return new Response(JSON.stringify({ message: "No students", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Latest checkin per student
    const { data: checkins } = await supabase
      .from("student_checkins")
      .select("student_id, created_at")
      .in("student_id", studentIds)
      .order("created_at", { ascending: false });
    const latest = new Map<string, string>();
    for (const c of checkins || []) {
      if (!latest.has(c.student_id)) latest.set(c.student_id, c.created_at);
    }

    // Profiles (skip deactivated)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, created_at, deactivated_at")
      .in("user_id", studentIds);

    const threshold = mode === "followup" ? followupThreshold : firstThreshold;
    const eligible = (profiles || []).filter((p) => {
      if (!p.email) return false;
      if (p.deactivated_at) return false;
      if (new Date(p.created_at) > accountMinAge) return false; // account too new
      const last = latest.get(p.user_id);
      if (!last) return true; // never checked in
      return new Date(last) < threshold;
    });

    if (eligible.length === 0) {
      return new Response(JSON.stringify({ message: "No reminders needed", mode, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY || !LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Email gateway not configured", eligible: eligible.length }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const weekKey = isoWeekKey(now);
    const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
    let sent = 0;
    let skipped = 0;

    for (const p of eligible) {
      const messageId = `checkin-${mode}-${p.user_id}-${weekKey}`;

      // Idempotency: skip if we've already logged this exact message_id
      const { data: existing } = await supabase
        .from("email_send_log")
        .select("id")
        .eq("message_id", messageId)
        .limit(1)
        .maybeSingle();
      if (existing) { skipped++; continue; }

      const { subject, html } = renderEmail(p.full_name?.split(" ")[0] || "", mode);

      try {
        const resp = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: "Evolve Foundation <noreply@evolvefoundation.us>",
            to: [p.email],
            subject,
            html,
          }),
        });
        const ok = resp.ok;
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: "weekly-checkin-reminder",
          recipient_email: p.email,
          status: ok ? "sent" : "failed",
          error_message: ok ? null : `Gateway ${resp.status}`,
          metadata: { mode, week: weekKey },
        });
        if (ok) sent++;
      } catch (e) {
        console.error(`Failed for ${p.email}:`, e);
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: "weekly-checkin-reminder",
          recipient_email: p.email,
          status: "failed",
          error_message: String((e as Error)?.message || e),
          metadata: { mode, week: weekKey },
        });
      }
    }

    return new Response(
      JSON.stringify({ message: `Sent ${sent}`, mode, eligible: eligible.length, sent, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
