import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  getCorsHeaders,
  sanitizeError,
  verifyMFAForPrivilegedRole,
  createMFARequiredResponse,
} from "../_shared/security.ts";

interface RequestBody {
  surveyType: "checkin" | "post_graduation_plan";
  recipientIds: string[];
  notes?: string;
  scheduledFor?: string; // ISO timestamp
}

async function sendNow(opts: {
  supabase: any;
  authHeader: string;
  userId: string;
  surveyType: string;
  recipientIds: string[];
  notes?: string;
}) {
  const { supabase, authHeader, userId, surveyType, recipientIds, notes } = opts;

  // Skip students with existing incomplete invitation of same type
  const { data: existing } = await supabase
    .from("survey_invitations")
    .select("student_id")
    .eq("survey_type", surveyType)
    .is("completed_at", null)
    .in("student_id", recipientIds);

  const skip = new Set((existing ?? []).map((r: any) => r.student_id));
  const toSend = recipientIds.filter((id) => !skip.has(id));

  if (toSend.length === 0) {
    return { sent: 0, failed: 0, skipped: skip.size, alreadyPending: skip.size };
  }

  const invitations = toSend.map((studentId) => ({
    student_id: studentId,
    survey_type: surveyType,
    sent_by: userId,
    notes: notes || null,
    email_status: "pending",
  }));

  await supabase.from("survey_invitations").insert(invitations);

  // Invoke existing send-survey-invitation
  const sendRes = await supabase.functions.invoke("send-survey-invitation", {
    body: { studentIds: toSend, surveyType, notes },
    headers: { Authorization: authHeader },
  });

  const result = sendRes.data ?? { sent: 0, failed: toSend.length, skipped: 0 };
  return {
    sent: result.sent ?? 0,
    failed: result.failed ?? 0,
    skipped: (result.skipped ?? 0) + skip.size,
    alreadyPending: skip.size,
  };
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || !["admin", "case_manager"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mfaResult = await verifyMFAForPrivilegedRole(authClient, roleData.role);
    if (!mfaResult.verified) {
      return createMFARequiredResponse(mfaResult, corsHeaders);
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.surveyType || !["checkin", "post_graduation_plan"].includes(body.surveyType)) {
      return new Response(JSON.stringify({ error: "Invalid survey type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(body.recipientIds) || body.recipientIds.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Scheduled path
    if (body.scheduledFor) {
      const scheduledAt = new Date(body.scheduledFor);
      if (isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
        return new Response(JSON.stringify({ error: "Scheduled time must be in the future" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: row, error: insErr } = await supabase
        .from("scheduled_survey_distributions")
        .insert({
          created_by: user.id,
          survey_type: body.surveyType,
          recipient_ids: body.recipientIds,
          notes: body.notes ?? null,
          scheduled_for: scheduledAt.toISOString(),
          total_recipients: body.recipientIds.length,
          status: "scheduled",
        })
        .select("id")
        .single();

      if (insErr) throw insErr;

      return new Response(
        JSON.stringify({ scheduled: true, scheduledId: row.id, scheduledFor: scheduledAt.toISOString() }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Send-now path
    const result = await sendNow({
      supabase,
      authHeader,
      userId: user.id,
      surveyType: body.surveyType,
      recipientIds: body.recipientIds,
      notes: body.notes,
    });

    return new Response(
      JSON.stringify({ scheduled: false, ...result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const safeMessage = sanitizeError(error, "distribute-survey");
    return new Response(JSON.stringify({ error: safeMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
