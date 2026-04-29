import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, sanitizeError } from "../_shared/security.ts";

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const nowIso = new Date().toISOString();

    const { data: due } = await supabase
      .from("scheduled_survey_distributions")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_for", nowIso)
      .limit(20);

    const results: any[] = [];

    for (const row of due ?? []) {
      // Mark processing
      await supabase
        .from("scheduled_survey_distributions")
        .update({ status: "processing" })
        .eq("id", row.id);

      try {
        const recipientIds: string[] = row.recipient_ids ?? [];
        const surveyType: string = row.survey_type;
        const notes: string | null = row.notes;

        // Skip students with existing incomplete invitation
        const { data: existing } = await supabase
          .from("survey_invitations")
          .select("student_id")
          .eq("survey_type", surveyType)
          .is("completed_at", null)
          .in("student_id", recipientIds);

        const skip = new Set((existing ?? []).map((r: any) => r.student_id));
        const toSend = recipientIds.filter((id) => !skip.has(id));

        let sent = 0;
        let failed = 0;
        let skipped = skip.size;

        if (toSend.length > 0) {
          // Insert survey_invitation rows on behalf of the original creator
          const invitations = toSend.map((studentId) => ({
            student_id: studentId,
            survey_type: surveyType,
            sent_by: row.created_by,
            notes,
            email_status: "pending",
          }));
          await supabase.from("survey_invitations").insert(invitations);

          // Invoke send-survey-invitation with service role auth
          const sendRes = await supabase.functions.invoke("send-survey-invitation", {
            body: { studentIds: toSend, surveyType, notes: notes ?? undefined },
          });
          const r = sendRes.data ?? { sent: 0, failed: toSend.length, skipped: 0 };
          sent = r.sent ?? 0;
          failed = r.failed ?? 0;
          skipped += r.skipped ?? 0;
        }

        await supabase
          .from("scheduled_survey_distributions")
          .update({
            status: "complete",
            sent_count: sent,
            failed_count: failed,
            skipped_count: skipped,
            completed_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        results.push({ id: row.id, sent, failed, skipped });
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 250) : "Unknown";
        await supabase
          .from("scheduled_survey_distributions")
          .update({
            status: "failed",
            error: msg,
            completed_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        results.push({ id: row.id, error: msg });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const safeMessage = sanitizeError(error, "process-scheduled-surveys");
    return new Response(JSON.stringify({ error: safeMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
