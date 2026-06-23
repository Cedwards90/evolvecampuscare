// Edge function: recommend-resources
// Given a student + source (intake or request), select 3-5 community resources
// from the seeded database that best match their needs. Uses Lovable AI Gateway
// with strict tool-calling output for grounded results.
//
// Security: caller JWT validated; only the student themselves, an admin, or
// staff authorized via can_staff_manage_student() may invoke.

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

// --- Rules mirror src/lib/resourceMatching.ts (kept in sync manually) ---
const ALL_CATEGORIES = [
  "Basic Needs & Stability",
  "Housing & Stability",
  "Health & Wellness",
  "Workforce & Economic Empowerment",
  "Legal & Reentry Support",
  "Transportation Services",
  "Youth & Family Services",
  "Senior Services",
  "Community & Civic Engagement",
];

function categoriesForIntake(s: Record<string, any>): string[] {
  const out = new Set<string>();
  const challenges = (s.daily_challenges || []).map((c: string) => String(c).toLowerCase());
  const interests = (s.interested_resources || []).map((c: string) => String(c).toLowerCase());

  if (challenges.some((c: string) => c.includes("food"))) out.add("Basic Needs & Stability");
  if (challenges.some((c: string) => c.includes("transport"))) out.add("Transportation Services");
  if (challenges.some((c: string) => c.includes("childcare"))) out.add("Youth & Family Services");
  if ((s.basic_needs_comfort ?? 0) >= 4) out.add("Basic Needs & Stability");

  if (s.main_reason === "Housing concerns") out.add("Housing & Stability");
  if (s.living_situation === "Transitional/temporary") out.add("Housing & Stability");

  if (
    s.main_reason === "Personal/emotional wellbeing" ||
    (s.stress_level ?? 0) >= 4 ||
    interests.some((i: string) => /counsel|crisis|wellness/.test(i))
  ) {
    out.add("Health & Wellness");
  }

  if (
    s.main_reason === "Financial hardship" ||
    s.work_status === "Not working" ||
    s.currently_employed === "No"
  ) {
    out.add("Workforce & Economic Empowerment");
    out.add("Basic Needs & Stability");
  }

  if (interests.some((i: string) => i.includes("peer mentor"))) out.add("Community & Civic Engagement");
  if (out.size === 0) out.add("Community & Civic Engagement");
  return Array.from(out);
}

function categoriesForRequest(r: Record<string, any>): string[] {
  const out = new Set<string>();
  const cat = String(r.category || "").toLowerCase();
  const text = `${r.title || ""} ${r.description || ""}`.toLowerCase();

  if (cat.includes("legal") || /legal|lawyer|court|reentry|immigration/.test(text)) out.add("Legal & Reentry Support");
  if (cat.includes("financial") || /financial|money|rent|bill|food|utility/.test(text)) {
    out.add("Basic Needs & Stability");
    out.add("Workforce & Economic Empowerment");
  }
  if (cat.includes("housing") || /housing|homeless|evict|shelter|rent/.test(text)) out.add("Housing & Stability");
  if (cat.includes("health") || /health|mental|therapy|counsel|wellness|clinic/.test(text)) out.add("Health & Wellness");
  if (cat.includes("academic") || cat.includes("career") || /job|career|resume|employment|work/.test(text)) {
    out.add("Workforce & Economic Empowerment");
  }
  if (/transport|bus|ride|commute/.test(text)) out.add("Transportation Services");
  if (/child|family|youth|kid/.test(text)) out.add("Youth & Family Services");

  if (out.size === 0) {
    out.add("Community & Civic Engagement");
    out.add("Basic Needs & Stability");
  }
  return Array.from(out);
}

const SYSTEM_PROMPT = `You are matching a student to up to 5 Chicago community resources from a curated list. Be helpful, brief, and grounded.

RULES:
- Only recommend resources whose id appears in the candidate list provided.
- Pick 3-5 resources that best match the student's stated needs.
- For each pick, write a short (1-2 sentence) reason explaining how it helps THIS student.
- Do not invent resources or claim services not implied by the resource name/category.
- Use the submit_recommendations tool to return your output.`;

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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

    const body = await req.json().catch(() => null) as
      | { student_id?: string; source?: string; request_id?: string | null }
      | null;
    const studentId = body?.student_id;
    const source = body?.source as 'intake' | 'request' | undefined;
    const requestId = body?.request_id ?? null;
    if (!studentId || !source || !['intake', 'request'].includes(source)) {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: caller is the student, or staff authorized to manage them
    if (callerId !== studentId) {
      const { data: canManage } = await userClient.rpc('can_staff_manage_student', {
        _actor: callerId,
        _student: studentId,
      });
      const { data: roleRows } = await userClient.from('user_roles').select('role').eq('user_id', callerId);
      const isAdmin = (roleRows || []).some((r: any) => r.role === 'admin');
      if (!canManage && !isAdmin) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Service client for cross-table reads (intake/request)
    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Collect signals
    let categories: string[] = [];
    let contextLabel = '';
    if (source === 'intake') {
      const { data: intake } = await svc
        .from('intake_responses')
        .select('responses')
        .eq('student_id', studentId);
      const merged: Record<string, any> = {};
      for (const r of intake || []) Object.assign(merged, (r as any).responses || {});
      categories = categoriesForIntake(merged);
      contextLabel = `Student intake responses: ${JSON.stringify(merged).slice(0, 1500)}`;
    } else {
      if (!requestId) {
        return new Response(JSON.stringify({ error: "request_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: reqRow } = await svc
        .from('support_requests')
        .select('category,title,description,is_emergency,student_id')
        .eq('id', requestId)
        .maybeSingle();
      if (!reqRow || (reqRow as any).student_id !== studentId) {
        return new Response(JSON.stringify({ error: "Request not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      categories = categoriesForRequest(reqRow as any);
      contextLabel = `Student support request — category: ${(reqRow as any).category}; title: ${(reqRow as any).title}; description: ${String((reqRow as any).description || '').slice(0, 800)}; emergency: ${(reqRow as any).is_emergency}`;
    }

    // Candidate resources
    const { data: resources, error: resErr } = await svc
      .from('community_resources')
      .select('id,name,category,address,website,phone')
      .in('category', categories)
      .eq('is_active', true)
      .limit(60);
    if (resErr) throw resErr;
    const candidates = resources || [];
    if (candidates.length === 0) {
      return new Response(JSON.stringify({ recommendations: [], degraded: true, message: 'No matching resources found.' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip resources already recommended in last 30 days to this student
    const { data: existing } = await svc
      .from('resource_recommendations')
      .select('resource_id, created_at')
      .eq('student_id', studentId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    const blocked = new Set((existing || []).map((r: any) => r.resource_id));
    const filteredCandidates = candidates.filter((c: any) => !blocked.has(c.id));
    const pool = filteredCandidates.length > 0 ? filteredCandidates : candidates;

    // Fallback when AI not configured: pick first 3 by category diversity
    function deterministicPick() {
      const byCat = new Map<string, any[]>();
      for (const r of pool) {
        const arr = byCat.get((r as any).category) || [];
        arr.push(r);
        byCat.set((r as any).category, arr);
      }
      const picks: any[] = [];
      const cats = Array.from(byCat.keys());
      let i = 0;
      while (picks.length < 5 && cats.length > 0) {
        const cat = cats[i % cats.length];
        const arr = byCat.get(cat)!;
        if (arr.length === 0) {
          cats.splice(i % cats.length, 1);
          continue;
        }
        picks.push(arr.shift());
        i++;
      }
      return picks.slice(0, 4).map((p) => ({
        resource_id: p.id,
        reason: `Matches ${p.category.toLowerCase()} support that fits the student's situation.`,
      }));
    }

    let chosen: { resource_id: string; reason: string }[] = [];
    let aiMessage: string | undefined;

    if (!LOVABLE_API_KEY) {
      chosen = deterministicPick();
      aiMessage = 'AI agent unavailable — showing rule-based matches.';
    } else {
      const candIdSet = new Set(pool.map((c: any) => c.id));
      const userPrompt = JSON.stringify({
        context: contextLabel,
        candidates: pool.map((c: any) => ({
          id: c.id,
          name: c.name,
          category: c.category,
          address: c.address,
        })),
      });

      const tool = {
        type: "function",
        function: {
          name: "submit_recommendations",
          description: "Return up to 5 resource recommendations",
          parameters: {
            type: "object",
            properties: {
              picks: {
                type: "array",
                minItems: 1,
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    resource_id: { type: "string", description: "Must match an id from the candidate list." },
                    reason: { type: "string", description: "1-2 sentences on why this fits the student." },
                  },
                  required: ["resource_id", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["picks"],
            additionalProperties: false,
          },
        },
      };

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            tools: [tool],
            tool_choice: { type: "function", function: { name: "submit_recommendations" } },
          }),
        });
        if (aiResp.status === 429 || aiResp.status === 402) {
          chosen = deterministicPick();
          aiMessage = aiResp.status === 402
            ? "AI usage limit reached — showing rule-based matches."
            : "AI rate-limited — showing rule-based matches.";
        } else if (!aiResp.ok) {
          console.error('AI gateway error', aiResp.status, await aiResp.text());
          chosen = deterministicPick();
          aiMessage = 'AI agent error — showing rule-based matches.';
        } else {
          const aiJson = await aiResp.json();
          const argsStr = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
          const parsedArgs = argsStr ? JSON.parse(argsStr) : {};
          const picks: any[] = Array.isArray(parsedArgs.picks) ? parsedArgs.picks : [];
          chosen = picks
            .filter((p) => p && typeof p.resource_id === 'string' && candIdSet.has(p.resource_id))
            .slice(0, 5)
            .map((p) => ({ resource_id: p.resource_id, reason: String(p.reason || '').slice(0, 400) }));
          if (chosen.length === 0) {
            chosen = deterministicPick();
            aiMessage = 'AI returned no valid picks — showing rule-based matches.';
          }
        }
      } catch (e) {
        console.error('AI call failed', e);
        chosen = deterministicPick();
        aiMessage = 'AI agent error — showing rule-based matches.';
      }
    }

    // Insert recommendations (best-effort)
    const rows = chosen.map((c) => ({
      student_id: studentId,
      resource_id: c.resource_id,
      source,
      request_id: requestId,
      reason: c.reason,
      created_by: callerId,
    }));
    const { data: inserted, error: insErr } = await svc
      .from('resource_recommendations')
      .insert(rows)
      .select('*, resource:community_resources(*)');
    if (insErr) {
      console.error('Insert recommendations failed', insErr);
      return new Response(JSON.stringify({ error: 'Failed to save recommendations' }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ recommendations: inserted || [], degraded: !!aiMessage, message: aiMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error('[recommend-resources] error', e);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
