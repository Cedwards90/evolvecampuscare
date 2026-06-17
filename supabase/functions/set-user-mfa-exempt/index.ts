import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, sanitizeError } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const body = await req.json().catch(() => null);
    const userId: string | undefined = body?.userId;
    const exempt: boolean | undefined = body?.exempt;
    const reason: string | undefined =
      typeof body?.reason === 'string' ? body.reason.slice(0, 500) : undefined;

    if (!userId || typeof exempt !== 'boolean') {
      return json({ error: 'userId and exempt are required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    // Must be admin
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleRow) return json({ error: 'Admin role required' }, 403);

    const now = new Date().toISOString();
    const update = exempt
      ? {
          mfa_exempt: true,
          mfa_exempt_reason: reason ?? null,
          mfa_exempt_at: now,
          mfa_exempt_by: user.id,
        }
      : {
          mfa_exempt: false,
          mfa_exempt_reason: null,
          mfa_exempt_at: null,
          mfa_exempt_by: null,
        };

    const { error: updErr } = await admin
      .from('profiles')
      .update(update)
      .eq('user_id', userId);
    if (updErr) throw updErr;

    const { error: audErr } = await admin.from('mfa_exemption_audit').insert({
      user_id: userId,
      actor_id: user.id,
      action: exempt ? 'granted' : 'revoked',
      reason: reason ?? null,
    });
    if (audErr) console.warn('mfa_exemption_audit insert failed', audErr);

    return json({ success: true });
  } catch (err) {
    console.error('set-user-mfa-exempt error', err);
    return json({ error: sanitizeError(err, 'set-user-mfa-exempt') }, 500);
  }
});
