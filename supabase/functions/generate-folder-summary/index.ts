// Edge function: generate-folder-summary
// Produces a strictly-grounded, sectioned AI summary of a student's full folder.
// All data is read with the caller's JWT so RLS enforces visibility.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const ALLOWED_ORIGINS = [
  "https://evolvecampuscare.lovable.app",
  "https://id-preview--566d8616-fbe5-4c84-8ac9-0bfd7fde3b97.lovable.app",
  "https://kxhykddsllizazoqxevu.supabase.co",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

function sanitize(error: unknown, context: string): string {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.error(`[${context}][${requestId}]`, error);
  if (error instanceof Error) {
    const m = error.message.toLowerCase();
    if (m.includes("denied") || m.includes("forbidden") || m.includes("permission")) return "Access denied";
    if (m.includes("not found")) return "Resource not found";
    if (m.includes("rate limit")) return "Too many requests. Please try again shortly.";
  }
  return `An error occurred. Reference: ${requestId}`;
}

const SECTIONS = [
  "key_updates",
  "completed_items",
  "missing_documents",
  "risks_red_flags",
  "areas_of_improvement",
  "achievements",
  "recommended_next_steps",
] as const;

const SYSTEM_PROMPT = `You generate a structured summary of a single student's case folder for campus support staff.

STRICT RULES:
- Use ONLY facts present in the supplied evidence JSON. Do not infer, extrapolate, or invent names, dates, diagnoses, outcomes, or interpretations.
- Every bullet must be supported by one or more evidence items. Each bullet MUST include the relevant evidence_ids (e.g. ["note:abc","cert:xyz"]).
- If a section has no supporting evidence, return exactly: { "bullets": [{ "text": "No data available.", "evidence_ids": [] }] }.
- Each bullet text: one short professional sentence. No emojis. No clinical advice. No speculation about feelings beyond what the student explicitly reported.
- Cap each section at 6 bullets. Output MUST come from the tool call schema.`;

const SUMMARY_TOOL = {
  type: "function",
  function: {
    name: "submit_folder_summary",
    description: "Return the grounded folder summary organized into fixed sections.",
    parameters: {
      type: "object",
      properties: Object.fromEntries(
        SECTIONS.map((s) => [
          s,
          {
            type: "object",
            properties: {
              bullets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    evidence_ids: { type: "array", items: { type: "string" } },
                  },
                  required: ["text", "evidence_ids"],
                  additionalProperties: false,
                },
              },
            },
            required: ["bullets"],
            additionalProperties: false,
          },
        ]),
      ),
      required: [...SECTIONS],
      additionalProperties: false,
    },
  },
};

function cap<T>(arr: T[] | null | undefined, n = 50): T[] {
  return Array.isArray(arr) ? arr.slice(0, n) : [];
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI summary is not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const body = await req.json().catch(() => null);
    const studentId = typeof body?.studentId === "string" ? body.studentId : null;
    if (!studentId || studentId.length < 8) {
      return new Response(JSON.stringify({ error: "Invalid studentId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: leverage the SQL helper used everywhere else
    const { data: canManage, error: rpcErr } = await userClient.rpc("can_staff_manage_student", {
      _actor: callerId,
      _student: studentId,
    });
    if (rpcErr || !canManage) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull evidence (RLS already filters; we just cap sizes)
    const [profileRes, intakeRes, requestsRes, updatesRes, attachmentsRes, notesRes,
           certsRes, apptsRes, checkInsRes, planRes] = await Promise.all([
      userClient.from("profiles").select("user_id, full_name, email, cohort_start_date, graduation_date, organization_id").eq("user_id", studentId).maybeSingle(),
      userClient.from("intake_responses").select("id, section, responses, created_at").eq("student_id", studentId).order("created_at", { ascending: false }),
      userClient.from("support_requests").select("id, title, category, priority, status, is_emergency, requested_amount, approved_amount, created_at, updated_at").eq("student_id", studentId).order("created_at", { ascending: false }),
      userClient.from("request_updates").select("id, request_id, previous_status, new_status, note, is_internal, created_at").order("created_at", { ascending: false }).limit(100),
      userClient.from("request_attachments").select("id, request_id, file_name, mime_type, created_at").order("created_at", { ascending: false }).limit(50),
      userClient.from("file_notes").select("id, note_type, title, content, created_at").eq("student_id", studentId).order("created_at", { ascending: false }),
      userClient.from("student_certifications").select("id, custom_name, status, completion_date, expiration_date, issuing_organization, file_name, credential_id, notes, catalog_id, created_at").eq("student_id", studentId).order("created_at", { ascending: false }),
      userClient.from("appointments").select("id, title, scheduled_at, status, duration_minutes").eq("student_id", studentId).order("scheduled_at", { ascending: false }),
      // student_check_ins table may not exist in all envs — guard
      userClient.from("student_check_ins").select("id, mood_rating, progress_rating, wins, blockers, created_at").eq("student_id", studentId).order("created_at", { ascending: false }).limit(50).then((r) => r, () => ({ data: [], error: null })),
      userClient.from("post_graduation_plans").select("id, graduation_date, career_goals, education_goals, housing_plan, financial_plan, health_wellness, support_needed, additional_notes, updated_at").eq("student_id", studentId).maybeSingle(),
    ]);

    const requestIds = new Set((requestsRes.data || []).map((r: any) => r.id));
    const updates = cap(((updatesRes.data as any[]) || []).filter((u) => requestIds.has(u.request_id)));
    const attachments = cap(((attachmentsRes.data as any[]) || []).filter((a) => requestIds.has(a.request_id)));

    const evidence = {
      profile: profileRes.data || null,
      intake_responses: cap(intakeRes.data as any[]).map((i) => ({
        id: `intake:${i.id}`, section: i.section, date: i.created_at,
        responses: i.responses,
      })),
      support_requests: cap(requestsRes.data as any[]).map((r) => ({
        id: `req:${r.id}`, title: r.title, category: r.category, priority: r.priority,
        status: r.status, is_emergency: r.is_emergency, requested_amount: r.requested_amount,
        approved_amount: r.approved_amount, created_at: r.created_at, updated_at: r.updated_at,
      })),
      request_updates: updates.map((u: any) => ({
        id: `upd:${u.id}`, request_id: `req:${u.request_id}`, from: u.previous_status,
        to: u.new_status, note: (u.note || "").slice(0, 300), date: u.created_at,
      })),
      request_attachments: attachments.map((a: any) => ({
        id: `att:${a.id}`, request_id: `req:${a.request_id}`, file_name: a.file_name,
        mime_type: a.mime_type, date: a.created_at,
      })),
      case_notes: cap(notesRes.data as any[]).map((n) => ({
        id: `note:${n.id}`, type: n.note_type, title: n.title,
        excerpt: (n.content || "").slice(0, 400), date: n.created_at,
      })),
      certifications: cap(certsRes.data as any[]).map((c) => ({
        id: `cert:${c.id}`, name: c.custom_name, status: c.status,
        completion_date: c.completion_date, expiration_date: c.expiration_date,
        issuing_organization: c.issuing_organization, credential_id: c.credential_id,
        file_name: c.file_name, notes: (c.notes || "").slice(0, 200),
      })),
      appointments: cap(apptsRes.data as any[]).map((a) => ({
        id: `appt:${a.id}`, title: a.title, date: a.scheduled_at, status: a.status,
        duration_minutes: a.duration_minutes,
      })),
      check_ins: cap((checkInsRes as any).data as any[]).map((c) => ({
        id: `checkin:${c.id}`, date: c.created_at, mood_rating: c.mood_rating,
        progress_rating: c.progress_rating, wins: c.wins, blockers: c.blockers,
      })),
      post_graduation_plan: planRes.data ? {
        id: `plan:${(planRes.data as any).id}`,
        graduation_date: (planRes.data as any).graduation_date,
        career_goals: (planRes.data as any).career_goals,
        education_goals: (planRes.data as any).education_goals,
        housing_plan: (planRes.data as any).housing_plan,
        financial_plan: (planRes.data as any).financial_plan,
        health_wellness: (planRes.data as any).health_wellness,
        support_needed: (planRes.data as any).support_needed,
        additional_notes: (planRes.data as any).additional_notes,
        updated_at: (planRes.data as any).updated_at,
      } : null,
    };

    const evidence_counts = {
      intake: evidence.intake_responses.length,
      requests: evidence.support_requests.length,
      request_updates: evidence.request_updates.length,
      attachments: evidence.request_attachments.length,
      notes: evidence.case_notes.length,
      certifications: evidence.certifications.length,
      appointments: evidence.appointments.length,
      check_ins: evidence.check_ins.length,
      post_graduation_plan: evidence.post_graduation_plan ? 1 : 0,
    };

    const totalEvidence = Object.values(evidence_counts).reduce((a, b) => a + b, 0);

    // Empty folder -> deterministic empty sections, skip AI
    if (totalEvidence === 0) {
      const empty = Object.fromEntries(
        SECTIONS.map((s) => [s, { bullets: [{ text: "No data available.", evidence_ids: [] }] }]),
      );
      return new Response(JSON.stringify({
        sections: empty, evidence_counts, generated_at: new Date().toISOString(), model: null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userPrompt = JSON.stringify({
      student: { id: studentId, name: profileRes.data?.full_name || null },
      generated_at: new Date().toISOString(),
      evidence,
    });

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [SUMMARY_TOOL],
        tool_choice: { type: "function", function: { name: "submit_folder_summary" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "AI rate limit reached. Please try again shortly." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiResp.ok) {
      const detail = await aiResp.text();
      console.error("AI gateway error", aiResp.status, detail);
      return new Response(JSON.stringify({ error: "AI summary failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiResp.json();
    const argsStr = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) {
      return new Response(JSON.stringify({ error: "AI returned an unexpected response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let parsed: Record<string, { bullets: { text: string; evidence_ids: string[] }[] }> = {};
    try { parsed = JSON.parse(argsStr); } catch {
      return new Response(JSON.stringify({ error: "AI returned malformed output" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sanitize: filter bullets without evidence (except the "No data available." sentinel)
    const sections: Record<string, { bullets: { text: string; evidence_ids: string[] }[] }> = {};
    const section_counts: Record<string, number> = {};
    for (const s of SECTIONS) {
      const raw = parsed[s]?.bullets ?? [];
      let cleaned = raw
        .filter((b) => b && typeof b.text === "string")
        .map((b) => ({ text: b.text.trim().slice(0, 280), evidence_ids: Array.isArray(b.evidence_ids) ? b.evidence_ids.slice(0, 12) : [] }))
        .filter((b) => b.text.length > 0)
        .filter((b) => b.text === "No data available." || b.evidence_ids.length > 0)
        .slice(0, 6);
      if (cleaned.length === 0) cleaned = [{ text: "No data available.", evidence_ids: [] }];
      sections[s] = { bullets: cleaned };
      section_counts[s] = cleaned.filter((b) => b.text !== "No data available.").length;
    }

    // Audit (best-effort)
    try {
      await userClient.from("folder_summary_audit").insert({
        student_id: studentId, actor_id: callerId, action: "generated",
        section_counts, evidence_counts,
      });
    } catch (e) { console.error("audit insert failed", e); }

    return new Response(JSON.stringify({
      sections, evidence_counts, section_counts,
      generated_at: new Date().toISOString(), model: "google/gemini-2.5-flash",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: sanitize(e, "generate-folder-summary") }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
