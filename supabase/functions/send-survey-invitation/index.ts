import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  getCorsHeaders,
  sanitizeError,
  verifyMFAForPrivilegedRole,
  createMFARequiredResponse,
} from "../_shared/security.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const SITE_URL = "https://evolvecampuscare.lovable.app";

interface RequestBody {
  studentIds: string[];
  surveyType: "checkin" | "post_graduation_plan";
  isReminder?: boolean;
  notes?: string;
}

interface NotificationSettings {
  email_enabled: boolean;
  in_app_enabled: boolean;
  types: Record<string, boolean>;
}

// deno-lint-ignore no-explicit-any
async function getNotificationSettings(supabase: any): Promise<NotificationSettings> {
  const defaults: NotificationSettings = {
    email_enabled: true,
    in_app_enabled: true,
    types: {},
  };
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "notifications")
      .single();
    return (data?.value as NotificationSettings) || defaults;
  } catch {
    return defaults;
  }
}

function buildEmail(opts: {
  surveyType: "checkin" | "post_graduation_plan";
  isReminder: boolean;
  fullName: string | null;
  notes?: string;
}): { subject: string; html: string } {
  const isCheckin = opts.surveyType === "checkin";
  const baseSubject = isCheckin
    ? "Time for your 3-week check-in"
    : "Your 12-month post-graduation plan";
  const subject = opts.isReminder ? `Reminder: ${baseSubject}` : baseSubject;

  const ctaLabel = isCheckin ? "Complete Check-In" : "Start My Plan";
  const ctaPath = isCheckin ? "/check-in" : "/post-graduation-plan";
  const ctaUrl = `${SITE_URL}${ctaPath}`;

  const intro = isCheckin
    ? "This is a quick survey about how you're doing — your mood, your progress, any wins, and any blockers. It usually takes less than 3 minutes."
    : "Your 12-month post-graduation plan helps you map out career goals, education, housing, finances, and the support you'll need. You can save and revise it as your plans evolve.";

  const reminderLine = opts.isReminder
    ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 16px 0; font-style: italic;">We noticed you haven't completed this yet — when you have a few minutes, we'd love to hear from you.</p>`
    : "";

  const notesSection = opts.notes
    ? `<div style="background-color: #f3f4f6; border-left: 4px solid #88A98C; padding: 14px 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
         <p style="color: #374151; margin: 0; font-size: 14px;">
           <strong>Note from your case manager:</strong><br>${opts.notes}
         </p>
       </div>`
    : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f9fafb;padding:40px 20px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.08);overflow:hidden;">
    <div style="background-color:#054D3B;padding:28px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;">${isCheckin ? "3-Week Check-In" : "Post-Graduation Plan"}</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;margin:0 0 16px 0;">Hi ${opts.fullName || "there"},</p>
      ${reminderLine}
      <p style="color:#374151;font-size:16px;line-height:1.5;margin:0 0 20px 0;">${intro}</p>
      ${notesSection}
      <div style="text-align:center;margin:32px 0 8px 0;">
        <a href="${ctaUrl}" style="display:inline-block;background-color:#054D3B;color:#ffffff;padding:14px 36px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:15px;">${ctaLabel}</a>
      </div>
    </div>
    <div style="background-color:#f9fafb;padding:18px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.5;">
        You're receiving this because your case manager at Evolve Foundation requested it.
      </p>
    </div>
  </div>
</body></html>`;

  return { subject, html };
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error("Configuration error");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Verify role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (!roleData || !["admin", "case_manager"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // MFA enforcement for staff
    const mfaResult = await verifyMFAForPrivilegedRole(authClient, roleData.role);
    if (!mfaResult.verified) {
      return createMFARequiredResponse(mfaResult, corsHeaders);
    }

    const body = (await req.json()) as RequestBody;
    if (!body || !Array.isArray(body.studentIds) || body.studentIds.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid request data" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!["checkin", "post_graduation_plan"].includes(body.surveyType)) {
      return new Response(JSON.stringify({ error: "Invalid request data" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const isReminder = !!body.isReminder;

    // Notification settings
    const settings = await getNotificationSettings(supabase);
    if (!settings.email_enabled) {
      // Mark all as disabled_by_admin where applicable
      await supabase
        .from("survey_invitations")
        .update({ email_status: "disabled_by_admin" })
        .in("student_id", body.studentIds)
        .eq("survey_type", body.surveyType)
        .is("email_sent_at", null);
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, skipped: body.studentIds.length, reason: "disabled_by_admin" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Lookup recipients
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", body.studentIds);
    if (profErr) throw profErr;

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.user_id, p as { user_id: string; email: string | null; full_name: string | null }]),
    );

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // Helper to update the most recent matching invitation row for a student
    async function updateInvitationStatus(
      studentId: string,
      patch: { email_status: string; email_sent_at?: string | null; email_error?: string | null },
    ) {
      const { data: row } = await supabase
        .from("survey_invitations")
        .select("id")
        .eq("student_id", studentId)
        .eq("survey_type", body.surveyType)
        .is("completed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (row?.id) {
        await supabase.from("survey_invitations").update(patch).eq("id", row.id);
      }
    }

    for (const studentId of body.studentIds) {
      const prof = profileMap.get(studentId);
      if (!prof?.email) {
        skipped++;
        await updateInvitationStatus(studentId, {
          email_status: "skipped_no_email",
          email_error: "No email on file",
        });
        continue;
      }

      const { subject, html } = buildEmail({
        surveyType: body.surveyType,
        isReminder,
        fullName: prof.full_name,
        notes: body.notes,
      });

      try {
        await resend.emails.send({
          from: "Evolve Foundation <noreply@evolvefoundation.us>",
          to: [prof.email],
          subject,
          html,
        });
        sent++;
        await updateInvitationStatus(studentId, {
          email_status: "sent",
          email_sent_at: new Date().toISOString(),
          email_error: null,
        });
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message.slice(0, 200) : "Send failed";
        console.error(`Resend failure for ${studentId}:`, err);
        await updateInvitationStatus(studentId, {
          email_status: "failed",
          email_error: msg,
        });
      }
    }

    return new Response(JSON.stringify({ sent, failed, skipped }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const safeMessage = sanitizeError(error, "send-survey-invitation");
    return new Response(JSON.stringify({ error: safeMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
