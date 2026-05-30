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
    const active: boolean | undefined = body?.active;
    const reason: string | undefined = typeof body?.reason === 'string' ? body.reason.slice(0, 500) : undefined;
    if (!userId || typeof active !== 'boolean') {
      return json({ error: 'userId and active are required' }, 400);
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

    if (userId === user.id) {
      return json({ error: 'You cannot change your own account status.' }, 400);
    }

    const now = new Date().toISOString();
    const update = active
      ? {
          deactivated_at: null,
          deactivated_by: null,
          deactivation_reason: null,
          reactivated_at: now,
          reactivated_by: user.id,
        }
      : {
          deactivated_at: now,
          deactivated_by: user.id,
          deactivation_reason: reason ?? null,
        };

    const { error: updErr } = await admin
      .from('profiles')
      .update(update)
      .eq('user_id', userId);
    if (updErr) throw updErr;

    const { error: audErr } = await admin.from('user_status_audit').insert({
      user_id: userId,
      actor_id: user.id,
      action: active ? 'reactivated' : 'deactivated',
      reason: reason ?? null,
    });
    if (audErr) throw audErr;

    // On deactivation revoke all sessions immediately
    if (!active) {
      try {
        await admin.auth.admin.signOut(userId, 'global');
      } catch (e) {
        console.warn('signOut failed', e);
      }
    }

    return json({ success: true });
  } catch (err) {
    console.error('set-user-active error', err);
    return json({ error: sanitizeError(err) }, 500);
  }
});
