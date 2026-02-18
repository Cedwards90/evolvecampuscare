import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, createErrorResponse } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify the requesting user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`User ${user.email} is deleting their own account`);

    // Clean up related data
    await adminClient.from('student_assignments').delete().or(`student_id.eq.${userId},case_manager_id.eq.${userId}`);
    await adminClient.from('appointments').delete().or(`student_id.eq.${userId},case_manager_id.eq.${userId}`);
    await adminClient.from('support_requests').update({ assigned_case_manager_id: null }).eq('assigned_case_manager_id', userId);
    await adminClient.from('staff_messages').delete().or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
    await adminClient.from('notifications').delete().eq('user_id', userId);
    await adminClient.from('offline_drafts').delete().eq('user_id', userId);
    await adminClient.from('ai_insights').delete().eq('case_manager_id', userId);

    // Delete auth user (cascades to profiles and user_roles)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Failed to delete user:', deleteError);
      return createErrorResponse(deleteError, 'delete-own-account', 500, corsHeaders);
    }

    console.log(`Successfully deleted user ${user.email}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Unexpected error in delete-own-account:', error);
    return createErrorResponse(error, 'delete-own-account', 500, corsHeaders);
  }
});
