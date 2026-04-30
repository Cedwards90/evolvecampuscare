// Edge function: student-progress-summary
// Generates a strictly-grounded AI summary (Progress Made / Areas Needing Improvement)
// from evidence the caller is authorized to see.
//
// Security:
//   - Caller JWT validated via auth.getUser()
//   - Caller must be admin OR the assigned case manager for the student
//   - Strict CORS (whitelisted origins) and sanitized error messages
//
// Output:
//   - Tool-calling JSON schema (no free-form text outside fields)
//   - "Insufficient data for this period." returned when evidence is sparse

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const ALLOWED_ORIGINS = [
  "https://evolvecampuscare.lovable.app",
  "https://id-preview--566d8616-fbe5-4c84-8ac9-0bfd7fde3b97.lovable.app",
  "https://kxhykddsllizazoqxevu.supabase.co",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

function sanitize(error: unknown, context: string): string {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.error(`[${context}][${requestId}]`, error);
  if (error instanceof Error) {
    const m = error.message.toLowerCase();
    if (m.includes("denied") || m.includes("forbidden") || m.includes("permission"))
      return "Access denied";
    if (m.includes("not found")) return "Resource not found";
    if (m.includes("rate limit") || m.includes("too many"))
      return "Too many requests. Please try again shortly.";
    if (m.includes("payment")) return "AI usage limit reached. Please add credits.";
  }
  return `An error occurred. Reference: ${requestId}`;
}

interface NoteEvidence {
  id: string;
  date: string;
  note_type: string;
  excerpt: string;
}
interface CheckInEvidence {
  id: string;
  date: string;
  mood_rating: number;
  progress_rating: number;
  blockers?: string | null;
  wins?: string | null;
}
interface StatusChangeEvidence {
  id: string;
  date: string;
  request_title: string;
  from?: string | null;
  to?: string | null;
  note?: string | null;
}
interface AppointmentEvidence {
  id: string;
  date: string;
  title: string;
  status: string;
}
interface RequestEvidence {
  id: string;
  title: string;
  status: string;
  is_emergency: boolean;
  age_days: number;
}

interface RequestBody {
  studentId: string;
  range: { from: string; to: string };
  studentName?: string;
  evidence: {
    notes: NoteEvidence[];
    checkIns: CheckInEvidence[];
    statusChanges: StatusChangeEvidence[];
    appointments: AppointmentEvidence[];
    unresolved: RequestEvidence[];
  };
}

function validateBody(raw: unknown): { ok: true; body: RequestBody } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "Body must be an object" };
  const b = raw as Record<string, unknown>;
  if (typeof b.studentId !== "string" || b.studentId.length < 8)
    return { ok: false, reason: "Invalid studentId" };
  const range = b.range as Record<string, unknown> | undefined;
  if (!range || typeof range.from !== "string" || typeof range.to !== "string")
    return { ok: false, reason: "Invalid range" };
  const ev = b.evidence as Record<string, unknown> | undefined;
  if (
    !ev ||
    !Array.isArray(ev.notes) ||
    !Array.isArray(ev.checkIns) ||
    !Array.isArray(ev.statusChanges) ||
    !Array.isArray(ev.appointments) ||
    !Array.isArray(ev.unresolved)
  ) {
    return { ok: false, reason: "Invalid evidence shape" };
  }
  // Cap sizes to keep prompt bounded
  const cap = <T,>(arr: T[]) => arr.slice(0, 25);
  return {
    ok: true,
    body: {
      studentId: b.studentId,
      studentName: typeof b.studentName === "string" ? b.studentName : undefined,
      range: { from: range.from as string, to: range.to as string },
      evidence: {
        notes: cap(ev.notes as NoteEvidence[]).map((n) => ({
          ...n,
          excerpt: (n.excerpt || "").slice(0, 400),
        })),
        checkIns: cap(ev.checkIns as CheckInEvidence[]),
        statusChanges: cap(ev.statusChanges as StatusChangeEvidence[]),
        appointments: cap(ev.appointments as AppointmentEvidence[]),
        unresolved: cap(ev.unresolved as RequestEvidence[]),
      },
    },
  };
}

const SUFFICIENT = (b: RequestBody) =>
  b.evidence.notes.length >= 2 ||
  b.evidence.checkIns.length >= 1 ||
  b.evidence.statusChanges.length >= 1 ||
  b.evidence.appointments.length >= 1;

const SYSTEM_PROMPT = `You are an assistant generating a structured progress summary for a single student in a campus support system.

STRICT RULES:
- Use ONLY the evidence supplied in the user message. Do not invent facts, names, dates, diagnoses, or details not present in the evidence.
- Every claim you make must be traceable to a specific item in the evidence (notes, check-ins, status changes, or appointments). When useful, cite item ids in parentheses, e.g. "(note:abc123)".
- If the evidence does not support a section, set that section's text to exactly: "Insufficient data for this period."
- Be concise (2-5 short sentences per section). Plain professional language. No emojis. No diagnoses. No advice that requires clinical judgement.
- Never speculate about what the student is feeling beyond what they explicitly reported in check-ins or notes.
- Output MUST come from the provided tool call schema. No free-form text outside it.`;

const SUMMARY_TOOL = {
  type: "function",
  function: {
    name: "submit_student_summary",
    description:
      "Return the grounded narrative summary of a student's progress and areas needing improvement.",
    parameters: {
      type: "object",
      properties: {
        progress_made: {
          type: "string",
          description:
            'Concise narrative of progress observable from the evidence. Use "Insufficient data for this period." if not supported.',
        },
        areas_needing_improvement: {
          type: "string",
          description:
            'Concise narrative of areas needing improvement supported by the evidence. Use "Insufficient data for this period." if not supported.',
        },
        evidence_used: {
          type: "array",
          description:
            "List of evidence item ids actually referenced in the narrative (e.g. note:abc, checkin:xyz).",
          items: { type: "string" },
        },
      },
      required: ["progress_made", "areas_needing_improvement", "evidence_used"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
      return new Response(
        JSON.stringify({ error: "AI summary is not configured" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate the caller using their JWT (RLS-bound client)
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

    const parsed = validateBody(await req.json().catch(() => null));
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.reason }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = parsed.body;

    // Authorization: admin OR assigned case manager for this student
    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .order("role", { ascending: true });
    const roles = (roleRow || []).map((r: { role: string }) => r.role);
    const isAdmin = roles.includes("admin");

    if (!isAdmin) {
      const isCaseManager = roles.includes("case_manager");
      if (!isCaseManager) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: assignment, error: assignmentErr } = await userClient
        .from("student_assignments")
        .select("id")
        .eq("student_id", body.studentId)
        .eq("case_manager_id", callerId)
        .maybeSingle();
      if (assignmentErr) throw assignmentErr;
      if (!assignment) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Insufficient evidence -> deterministic fallback, no AI call
    if (!SUFFICIENT(body)) {
      return new Response(
        JSON.stringify({
          progress_made: "Insufficient data for this period.",
          areas_needing_improvement: "Insufficient data for this period.",
          evidence_used: [],
          generated_at: new Date().toISOString(),
          model: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build the user prompt strictly from evidence
    const ev = body.evidence;
    const userPrompt = JSON.stringify(
      {
        student_name: body.studentName || null,
        range: body.range,
        evidence: {
          notes: ev.notes.map((n) => ({
            id: `note:${n.id}`,
            date: n.date,
            type: n.note_type,
            excerpt: n.excerpt,
          })),
          check_ins: ev.checkIns.map((c) => ({
            id: `checkin:${c.id}`,
            date: c.date,
            mood_rating: c.mood_rating,
            progress_rating: c.progress_rating,
            blockers: c.blockers || null,
            wins: c.wins || null,
          })),
          status_changes: ev.statusChanges.map((s) => ({
            id: `status:${s.id}`,
            date: s.date,
            request_title: s.request_title,
            from: s.from || null,
            to: s.to || null,
            note: s.note || null,
          })),
          appointments: ev.appointments.map((a) => ({
            id: `appt:${a.id}`,
            date: a.date,
            title: a.title,
            status: a.status,
          })),
          unresolved_requests: ev.unresolved.map((r) => ({
            id: `req:${r.id}`,
            title: r.title,
            status: r.status,
            is_emergency: r.is_emergency,
            age_days: r.age_days,
          })),
        },
      },
      null,
      2,
    );

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          tools: [SUMMARY_TOOL],
          tool_choice: {
            type: "function",
            function: { name: "submit_student_summary" },
          },
        }),
      },
    );

    if (aiResp.status === 429) {
      return new Response(
        JSON.stringify({ error: "AI rate limit reached. Please try again shortly." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI usage limit reached. Please add credits." }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!aiResp.ok) {
      const detail = await aiResp.text();
      console.error("AI gateway error", aiResp.status, detail);
      return new Response(JSON.stringify({ error: "AI summary failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const choice = aiJson?.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      console.error("Missing tool call in AI response", aiJson);
      return new Response(
        JSON.stringify({ error: "AI returned an unexpected response" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    let parsedArgs: {
      progress_made?: string;
      areas_needing_improvement?: string;
      evidence_used?: string[];
    } = {};
    try {
      parsedArgs = JSON.parse(argsStr);
    } catch (e) {
      console.error("Failed to parse tool args", e, argsStr);
      return new Response(
        JSON.stringify({ error: "AI returned malformed output" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        progress_made:
          parsedArgs.progress_made || "Insufficient data for this period.",
        areas_needing_improvement:
          parsedArgs.areas_needing_improvement ||
          "Insufficient data for this period.",
        evidence_used: Array.isArray(parsedArgs.evidence_used)
          ? parsedArgs.evidence_used
          : [],
        generated_at: new Date().toISOString(),
        model: "google/gemini-3-flash-preview",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: sanitize(e, "student-progress-summary") }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
