// Edge function: report-ai-summary
// Generates a strictly-grounded AI narrative for a deterministic report payload
// (Organization, Caseload, or Per-student). No fabricated facts — every claim
// must come from the numbers supplied in the request body.
//
// Security:
//   - Caller JWT validated via auth.getUser()
//   - Any authenticated staff role (admin / org_admin / case_manager) may call.
//     Data scoping already happened client-side via RLS-scoped queries.
//   - Strict CORS + sanitized error messages
//
// Output: tool-call JSON with headline, trends, improvements, risk_areas,
// next_steps. Returns "Insufficient data for this period." per section when
// evidence is sparse.

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
    if (m.includes("rate limit") || m.includes("too many"))
      return "Too many requests. Please try again shortly.";
    if (m.includes("payment"))
      return "AI usage limit reached. Please add credits.";
  }
  return `An error occurred. Reference: ${requestId}`;
}

interface Payload {
  reportType: "organization" | "caseload" | "student";
  scopeLabel: string;
  range: { from: string; to: string };
  summary: Record<string, number | string | null>;
  lifeSkills?: Array<{
    module: string;
    preAvg: number | null;
    postAvg: number | null;
    delta: number | null;
    n: number;
  }>;
  impactHighlights?: Record<string, number | string | null>;
  risks?: Array<{ key: string; label: string; severity: string; detail: string }>;
  actionItems?: Array<{ key: string; severity: string; text: string }>;
}

function validate(raw: unknown): { ok: true; body: Payload } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object")
    return { ok: false, reason: "Body must be an object" };
  const b = raw as Record<string, unknown>;
  if (!["organization", "caseload", "student"].includes(b.reportType as string))
    return { ok: false, reason: "Invalid reportType" };
  const range = b.range as Record<string, unknown> | undefined;
  if (!range || typeof range.from !== "string" || typeof range.to !== "string")
    return { ok: false, reason: "Invalid range" };
  if (!b.summary || typeof b.summary !== "object")
    return { ok: false, reason: "Missing summary" };
  const cap = <T,>(arr: T[] | undefined, n: number): T[] =>
    Array.isArray(arr) ? arr.slice(0, n) : [];
  return {
    ok: true,
    body: {
      reportType: b.reportType as Payload["reportType"],
      scopeLabel: String(b.scopeLabel ?? ""),
      range: { from: range.from as string, to: range.to as string },
      summary: b.summary as Payload["summary"],
      lifeSkills: cap(b.lifeSkills as Payload["lifeSkills"], 20),
      impactHighlights: (b.impactHighlights as Payload["impactHighlights"]) ?? {},
      risks: cap(b.risks as Payload["risks"], 20),
      actionItems: cap(b.actionItems as Payload["actionItems"], 20),
    },
  };
}

function hasEvidence(p: Payload): boolean {
  const s = p.summary || {};
  const numericTotal = Object.values(s).reduce<number>((acc, v) => {
    return acc + (typeof v === "number" ? v : 0);
  }, 0);
  return (
    numericTotal > 0 ||
    (p.lifeSkills?.some((l) => (l.n ?? 0) > 0) ?? false) ||
    (p.risks?.length ?? 0) > 0
  );
}

const SYSTEM_PROMPT = `You write structured, executive-style narrative summaries of a campus support report.

STRICT RULES:
- Use ONLY the numbers, labels, and risk items in the user message. Do NOT invent students, names, diagnoses, causes, or facts not present in the payload.
- Every claim must be traceable to a specific field of the payload. Reference fields inline where helpful (e.g. "attendance rate 72%", "3 high-severity risks").
- If a section has no supporting evidence in the payload, set that section to exactly: "Insufficient data for this period."
- Be concise (2-5 short sentences per section). Neutral, professional tone. No emojis. No diagnoses. No advice requiring clinical judgement.
- Do not speculate about causes beyond what the payload states.
- Output MUST come from the provided tool call. No free-form text outside it.`;

const SUMMARY_TOOL = {
  type: "function",
  function: {
    name: "submit_report_summary",
    description: "Return a grounded narrative summary of the report payload.",
    parameters: {
      type: "object",
      properties: {
        headline: {
          type: "string",
          description: "One sentence executive headline for the whole report.",
        },
        trends: {
          type: "string",
          description: "Trend narrative grounded in the payload numbers.",
        },
        improvements: {
          type: "string",
          description: "Observable improvements supported by the payload.",
        },
        risk_areas: {
          type: "string",
          description: "Risk areas grounded in the risks and metrics supplied.",
        },
        next_steps: {
          type: "string",
          description: "Recommended next steps derived from action items and risks.",
        },
      },
      required: ["headline", "trends", "improvements", "risk_areas", "next_steps"],
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

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const { data: roleRows } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    const allowed = roles.some((r) =>
      ["admin", "org_admin", "case_manager"].includes(r),
    );
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = validate(await req.json().catch(() => null));
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.reason }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = parsed.body;

    if (!hasEvidence(body)) {
      const insufficient = "Insufficient data for this period.";
      return new Response(
        JSON.stringify({
          headline: insufficient,
          trends: insufficient,
          improvements: insufficient,
          risk_areas: insufficient,
          next_steps: insufficient,
          generated_at: new Date().toISOString(),
          model: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userPrompt = JSON.stringify(
      {
        report_type: body.reportType,
        scope: body.scopeLabel,
        range: body.range,
        summary: body.summary,
        life_skills: body.lifeSkills ?? [],
        impact_highlights: body.impactHighlights ?? {},
        risks: body.risks ?? [],
        recommended_action_items: body.actionItems ?? [],
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
            function: { name: "submit_report_summary" },
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
    const argsStr =
      aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
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
    let out: Record<string, string> = {};
    try {
      out = JSON.parse(argsStr);
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

    const fallback = "Insufficient data for this period.";
    return new Response(
      JSON.stringify({
        headline: out.headline || fallback,
        trends: out.trends || fallback,
        improvements: out.improvements || fallback,
        risk_areas: out.risk_areas || fallback,
        next_steps: out.next_steps || fallback,
        generated_at: new Date().toISOString(),
        model: "google/gemini-3-flash-preview",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: sanitize(e, "report-ai-summary") }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
