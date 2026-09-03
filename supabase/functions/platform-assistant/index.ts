import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const PLATFORM_KNOWLEDGE = `
EVOLVE CAMPUS CARE — PLATFORM & POLICY KNOWLEDGE

ROLES
- Student: submits and tracks support requests, completes check-ins, surveys, and profile updates. Students never see fund allocation, caps, balances, or reviewer recommendations.
- Case Manager: manages assigned students, reviews requests, writes case notes, logs time.
- Org Admin: admin powers scoped to their own organization(s).
- Admin: full platform access, user management, analytics, catalogs, settings.
All staff must use multi-factor authentication; students do not.

SUPPORT REQUESTS
Categories: academic, financial, mental health, housing, other.
Priorities: low, medium, high, emergency.
Statuses: submitted, in progress, escalated, resolved, cancelled.
Financial requests capture a requested amount, funding purpose, approval status, and approved amount. Attachments provide third-party documentation.

FINANCIAL CONTROL PROTOCOL (Program Operations Manual)
Two separate, non-transferable funds, each with a $1,000 lifetime allocation per participant:
1. Barrier Mitigation Fund — during active enrollment (request dated before graduation).
   Eligible: state ID / birth certificates, work tools and boots, transportation passes, background check or expungement filing fees, initial work uniforms, emergency food and utilities.
2. Alumni Support Fund — post-placement, up to 12 months after graduation.
   Eligible: professional licensing fees, advanced training tuition, auto repairs for commuting, specialized equipment, emergency rental assistance.
Never eligible under either fund: personal cash loans or cash advances, traffic tickets and fines, bail or bond, legal defense fees, entertainment, tobacco or alcohol, gift cards without itemized receipts, non-essential travel, transfers to secondary parties. Alumni funds also exclude recurring monthly personal bills.
Direct cash payments to participants are prohibited — pay vendors directly or purchase on the participant's behalf.
Approval tiers: $0.01–$500 requires Program Director written approval; $501–$1,000 requires Program Director review plus Executive Leadership approval. Any single transaction over $500 needs Executive Leadership approval regardless of remaining balance.
Requests may be partially approved: staff can itemize a request so eligible line items are funded and ineligible ones excluded.
The platform's recommendation panel is advisory only — a human reviewer always decides. It shows the fund, approved-to-date, remaining balance, balance after approval, eligibility verdict, approval tier, and a recommended decision.

REPORTS & ANALYTICS
Caseload, organization, and request analytics reports cover request volume and trends, resolution time, unresolved and repeat requests, financial assistance totals and funds dispersed, life-skills progress with before/after survey scores, certifications, case-note summaries, and drill-downs. Reports never fabricate data; when data is insufficient they show "Not enough data".

OTHER FEATURES
Surveys (including paired before/after Life Skills), student check-ins, certifications, case notes, student folders with AI summaries, meeting scheduling with calendar sync, QR code access, PDF sharing with expiring links, NDA acceptance, time tracking with approval, invitations, offline request drafts.
`;

const SYSTEM_PROMPT = `You are the Evolve Campus Care platform assistant.

Answer questions about how the platform works and about program policy, using ONLY the knowledge below. You have NO access to any student, request, or database record — if asked about specific people, amounts on file, or case details, say you cannot see records and point the user to the relevant page or their case manager.

If the knowledge does not cover the question, say so plainly instead of guessing.

Audience rules:
- When the user is a student, never discuss fund allocation names, lifetime caps, balances, approval tiers, or reviewer recommendations. Explain how to submit and track a request and that staff review it.
- When the user is staff (case manager, org admin, admin), you may explain funds, caps, tiers, partial approvals, and the advisory recommendation panel.

Be concise and practical. Use short markdown when it helps.

KNOWLEDGE:
${PLATFORM_KNOWLEDGE}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    const role = roleRow?.role ?? 'student';

    const body = await req.json().catch(() => null);
    const rawMessages = Array.isArray(body?.messages) ? body.messages : null;
    if (!rawMessages || rawMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messages = rawMessages
      .filter(
        (m: unknown): m is { role: string; content: string } =>
          !!m &&
          typeof (m as { content?: unknown }).content === 'string' &&
          ((m as { role?: unknown }).role === 'user' ||
            (m as { role?: unknown }).role === 'assistant')
      )
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': apiKey,
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.7-flash',
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: `The signed-in user's role is: ${role}.` },
          ...messages,
        ],
      }),
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      const message =
        aiResponse.status === 402
          ? 'AI credits are exhausted for this workspace. An admin can add credits to continue.'
          : aiResponse.status === 429
          ? 'The assistant is rate limited right now. Please try again in a moment.'
          : 'The assistant is unavailable right now.';
      console.error('AI gateway error', aiResponse.status, detail.slice(0, 500));
      return new Response(JSON.stringify({ error: message }), {
        status: aiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(aiResponse.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('platform-assistant error', error);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
