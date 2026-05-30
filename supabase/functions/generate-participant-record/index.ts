// supabase/functions/generate-participant-record/index.ts
// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { runParticipantValidation } from "../_shared/participant-record-validation.ts";
import { buildParticipantRecordPdf, loadParticipantBundle } from "../_shared/participant-record-pdf.ts";

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
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const actor = u.user;

    const body = await req.json();
    const studentId: string = body.student_id;
    const format: "pdf" | "zip" = body.format || "pdf";
    const purpose: string = body.purpose || "handoff";
    const notes: string = body.notes || "";
    const includeTypes: string[] = Array.isArray(body.include) ? body.include : [];
    const transferId: string | null = body.transfer_id || null;
    if (!studentId) return json({ error: "student_id required" }, 400);

    const service = createClient(SUPABASE_URL, SERVICE_KEY);

    // Permission gate via user-scoped client
    const { data: canManage, error: permErr } = await userClient.rpc("can_staff_manage_student", { _actor: actor.id, _student_id: studentId });
    if (permErr || !canManage) return json({ error: "Forbidden" }, 403);

    // Actor profile
    const { data: actorProfile } = await service.from("profiles").select("full_name, email").eq("user_id", actor.id).maybeSingle();

    // Validation + bundle
    const [validation, bundleBase] = await Promise.all([
      runParticipantValidation(service, studentId),
      loadParticipantBundle(service, studentId, includeTypes),
    ]);

    // Transfer context
    let transferContext = null;
    let transferEvents: any[] = [];
    if (transferId) {
      const { data: t } = await service.from("participant_transfers").select("*").eq("id", transferId).maybeSingle();
      if (t) {
        const [{ data: fromOrg }, { data: toOrg }, { data: events }] = await Promise.all([
          t.from_organization_id ? service.from("training_organizations").select("name").eq("id", t.from_organization_id).maybeSingle() : Promise.resolve({ data: null }),
          service.from("training_organizations").select("name").eq("id", t.to_organization_id).maybeSingle(),
          service.from("participant_transfer_events").select("*").eq("transfer_id", transferId).order("created_at", { ascending: true }),
        ]);
        transferContext = { transfer_id: transferId, from_org_name: fromOrg?.name ?? null, to_org_name: toOrg?.name ?? null, reason: t.reason };
        transferEvents = events || [];
      }
    }

    // Build PDF
    const pdfBytes = await buildParticipantRecordPdf({
      ...bundleBase,
      transferEvents,
      validation,
      purpose,
      generatedBy: { name: actorProfile?.full_name || "Unknown", email: actorProfile?.email || actor.email || "" },
      transferContext,
    });

    const filename = `participant-record-${studentId}-${Date.now()}.${format === "zip" ? "zip" : "pdf"}`;
    const objectPath = `${studentId}/${filename}`;

    let bodyBytes: Uint8Array = pdfBytes;
    let mime = "application/pdf";

    if (format === "zip") {
      const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
      const zip = new JSZip();
      zip.file(`participant-record.pdf`, pdfBytes);
      zip.file(`manifest.json`, JSON.stringify({
        student_id: studentId,
        generated_at: new Date().toISOString(),
        purpose,
        notes,
        section_counts: sectionCounts(bundleBase),
        validation,
      }, null, 2));
      // Embed original attachments from request_attachments bucket
      for (const a of bundleBase.attachments) {
        if (!a.file_path) continue;
        const { data: dl } = await service.storage.from("request-attachments").download(a.file_path);
        if (dl) {
          const buf = new Uint8Array(await dl.arrayBuffer());
          zip.file(`attachments/${a.file_name || a.id}`, buf);
        }
      }
      // Embed certification files
      for (const c of bundleBase.certifications as any[]) {
        if (!c.file_path) continue;
        const { data: dl } = await service.storage.from("student-certifications").download(c.file_path);
        if (dl) {
          const buf = new Uint8Array(await dl.arrayBuffer());
          zip.file(`certifications/${c.file_name || c.id}`, buf);
        }
      }
      bodyBytes = await zip.generateAsync({ type: "uint8array" });
      mime = "application/zip";
    }

    // Upload
    const { error: upErr } = await service.storage.from("participant-exports").upload(objectPath, bodyBytes, {
      contentType: mime,
      upsert: false,
    });
    if (upErr) throw upErr;

    // Record export
    const { data: exp, error: insErr } = await service.from("participant_record_exports").insert({
      student_id: studentId,
      actor_id: actor.id,
      format,
      purpose,
      notes,
      file_path: objectPath,
      file_size: bodyBytes.byteLength,
      mime_type: mime,
      section_counts: sectionCounts(bundleBase),
      validation_report: validation,
      transfer_id: transferId,
    }).select("*").single();
    if (insErr) throw insErr;

    // Log transfer event if applicable
    if (transferId) {
      await service.from("participant_transfer_events").insert({
        transfer_id: transferId,
        actor_id: actor.id,
        event_type: "exported",
        metadata: { export_id: exp.id, format },
      });
      await service.from("participant_transfers").update({ export_id: exp.id }).eq("id", transferId);
    }

    // Signed URL
    const { data: signed } = await service.storage.from("participant-exports").createSignedUrl(objectPath, 60 * 10);

    return json({ export: exp, signed_url: signed?.signedUrl, validation });
  } catch (e) {
    console.error("generate-participant-record error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function sectionCounts(b: any) {
  return {
    requests: b.requests.length,
    case_notes: b.fileNotes.length,
    appointments: b.appointments.length,
    certifications: b.certifications.length,
    intake_responses: b.intakeResponses.length,
    post_grad_plans: b.postGradPlans.length,
    checkins: b.checkIns.length,
    attachments: b.attachments.length,
    messages: b.messages.length,
    has_outcomes: !!b.outcomes,
    has_demographics: !!b.demographics,
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
