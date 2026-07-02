// Bulk-send a Life Skills survey to a class/cohort/org or to a hand-picked list.
// Staff-only. Validates scope, idempotently assigns templates, emails students.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const APP_URL = "https://evolvecampuscare.lovable.app";

const BodySchema = z.object({
  template_slug: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/),
  cohort_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  student_ids: z.array(z.string().uuid()).max(2000).optional(),
  notes: z.string().max(500).optional(),
  skip_already_sent: z.boolean().optional().default(true),
});

function sanitizeError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.length > 200 ? m.slice(0, 200) : m;
}

function escHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const actor = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = parsed.data;

    // Verify actor is staff (admin / org_admin / case_manager)
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", actor);
    const roleSet = new Set((roles || []).map((r: any) => r.role));
    const isAdmin = roleSet.has("admin");
    const isOrgAdmin = roleSet.has("org_admin");
    const isCM = roleSet.has("case_manager");
    if (!isAdmin && !isOrgAdmin && !isCM) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve template
    const { data: tpl, error: tplErr } = await admin
      .from("impact_survey_templates")
      .select("id, slug, title")
      .eq("slug", body.template_slug)
      .maybeSingle();
    if (tplErr || !tpl) {
      return new Response(JSON.stringify({ error: "Template not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve recipients
    let recipientIds: string[] = [];
    if (body.student_ids && body.student_ids.length > 0) {
      recipientIds = body.student_ids;
    } else if (body.cohort_id) {
      const { data: rows } = await admin.from("profiles").select("user_id").eq("cohort_id", body.cohort_id);
      recipientIds = (rows || []).map((r: any) => r.user_id);
    } else if (body.organization_id) {
      const { data: rows } = await admin
        .from("organization_memberships")
        .select("user_id")
        .eq("organization_id", body.organization_id)
        .is("left_at", null);
      recipientIds = (rows || []).map((r: any) => r.user_id);
    } else {
      return new Response(JSON.stringify({ error: "Provide cohort_id, organization_id, or student_ids" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ message: "No recipients", total: 0, sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    recipientIds = Array.from(new Set(recipientIds));

    // Only include students who are actually students and still active
    const { data: studentRoles } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "student")
      .in("user_id", recipientIds);
    const studentSet = new Set((studentRoles || []).map((r: any) => r.user_id));
    recipientIds = recipientIds.filter((id) => studentSet.has(id));

    // Scope check for non-admin staff
    if (!isAdmin) {
      const allowed: string[] = [];
      for (const sid of recipientIds) {
        const { data: ok } = await admin.rpc("can_staff_manage_student", { _actor: actor, _student: sid });
        if (ok) allowed.push(sid);
      }
      recipientIds = allowed;
    }

    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ message: "No recipients in scope", total: 0, sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // De-dupe: skip students who already have an open (uncompleted) invitation
    // for this template. Prevents duplicate sends on repeated "Send" clicks.
    let alreadySentSkipped = 0;
    if (body.skip_already_sent !== false) {
      const { data: openInvites } = await admin
        .from("survey_invitations")
        .select("student_id")
        .eq("survey_type", `lifeskills:${tpl.slug}`)
        .is("completed_at", null)
        .in("student_id", recipientIds);
      const openSet = new Set((openInvites || []).map((r: any) => r.student_id));
      if (openSet.size > 0) {
        const filtered = recipientIds.filter((id) => !openSet.has(id));
        alreadySentSkipped = recipientIds.length - filtered.length;
        recipientIds = filtered;
      }
      if (recipientIds.length === 0) {
        return new Response(
          JSON.stringify({
            message: "All recipients already have an open invitation",
            total: 0,
            assigned: 0,
            invited: 0,
            emailed: 0,
            failed: 0,
            skipped: 0,
            already_sent_skipped: alreadySentSkipped,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Get profiles for emailing
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, email, full_name, deactivated_at")
      .in("user_id", recipientIds);
    const profileMap = new Map<string, any>();
    for (const p of profiles || []) {
      if (!p.deactivated_at) profileMap.set(p.user_id, p);
    }

    // Distribution audit row
    const { data: dist } = await admin
      .from("scheduled_survey_distributions")
      .insert({
        created_by: actor,
        survey_type: `lifeskills:${tpl.slug}`,
        recipient_ids: recipientIds,
        notes: body.notes ?? null,
        scheduled_for: new Date().toISOString(),
        status: "running",
        total_recipients: recipientIds.length,
        sent_count: 0,
        failed_count: 0,
        skipped_count: 0,
      })
      .select("id")
      .single();

    let assigned = 0;
    let invited = 0;
    let emailed = 0;
    let failed = 0;
    let skipped = 0;

    const surveyUrl = `${APP_URL}/surveys/${encodeURIComponent(tpl.slug)}`;

    for (const id of recipientIds) {
      const p = profileMap.get(id);
      if (!p) { skipped++; continue; }

      // Upsert assignment (unique on student_id + template_id).
      // Reset last_completed_at so the new send becomes a fresh assignment.
      const { error: aErr } = await admin
        .from("impact_survey_assignments")
        .upsert({
          student_id: id,
          template_id: tpl.id,
          next_due_at: new Date().toISOString(),
          last_completed_at: null,
          assigned_by: actor,
          cohort_id: body.cohort_id ?? null,
        }, { onConflict: "student_id,template_id" });
      if (!aErr) assigned++;

      // Invitation row → shows in student "pending surveys" banner
      const { error: iErr } = await admin.from("survey_invitations").insert({
        student_id: id,
        survey_type: `lifeskills:${tpl.slug}`,
        sent_by: actor,
        notes: body.notes ?? tpl.title,
      });
      if (!iErr) invited++;

      // Notification
      await admin.from("notifications").insert({
        user_id: id,
        type: "survey_request",
        title: tpl.title,
        message: body.notes ?? "Your case manager has invited you to complete a Life Skills survey.",
        link: `/surveys/${tpl.slug}`,
      });

      // Email
      if (RESEND_API_KEY && LOVABLE_API_KEY && p.email) {
        try {
          const first = (p.full_name || "").split(" ")[0] || "there";
          const html = `
            <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background:#ffffff;">
              <h2 style="color:#054D3B; margin-top:0;">Hi ${escHtml(first)} 👋</h2>
              <p style="color:#333; line-height:1.6;">You've been invited to complete: <strong>${escHtml(tpl.title)}</strong>.</p>
              ${body.notes ? `<p style="color:#555; line-height:1.6;">${escHtml(body.notes)}</p>` : ""}
              <div style="text-align:center; margin:28px 0;">
                <a href="${surveyUrl}" style="background:#054D3B; color:#fff; padding:12px 24px; border-radius:9999px; text-decoration:none; font-weight:600; display:inline-block;">Open the survey</a>
              </div>
              <p style="color:#666; font-size:13px;">It only takes a couple of minutes — your honest answers help us measure the impact of Life Skills.</p>
              <hr style="border:none; border-top:1px solid #eee; margin:20px 0;" />
              <p style="color:#999; font-size:12px;">Evolve Foundation — Supporting your journey</p>
            </div>`;
          const resp = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": RESEND_API_KEY,
            },
            body: JSON.stringify({
              from: "Evolve Foundation <noreply@evolvefoundation.us>",
              to: [p.email],
              subject: tpl.title,
              html,
            }),
          });
          if (resp.ok) emailed++; else failed++;
        } catch (_) { failed++; }
      } else {
        skipped++;
      }
    }

    if (dist?.id) {
      await admin.from("scheduled_survey_distributions").update({
        status: failed > 0 && emailed === 0 ? "failed" : "completed",
        sent_count: emailed,
        failed_count: failed,
        skipped_count: skipped,
        completed_at: new Date().toISOString(),
      }).eq("id", dist.id);
    }

    return new Response(
      JSON.stringify({ message: "ok", total: recipientIds.length, assigned, invited, emailed, failed, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("send-lifeskills-survey error:", e);
    return new Response(JSON.stringify({ error: sanitizeError(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
