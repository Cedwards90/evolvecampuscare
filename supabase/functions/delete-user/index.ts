import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, sanitizeError, createErrorResponse } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Parse request body
    const { userId } = await req.json();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // User client for auth verification
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the requesting user
    const { data: { user: requestingUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !requestingUser) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check if requesting user is an admin
    const { data: roleData, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      console.error('Role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin role required.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Prevent self-deletion
    if (userId === requestingUser.id) {
      return new Response(
        JSON.stringify({ error: 'You cannot delete your own account' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Verify target user exists
    const { data: targetUser, error: targetError } = await adminClient.auth.admin.getUserById(userId);
    if (targetError || !targetUser?.user) {
      console.error('Target user not found:', targetError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`Admin ${requestingUser.email} is deleting user ${targetUser.user.email}`);

    // Clean up related data before deleting the user
    // Note: Using service role to bypass RLS

    // 1. Delete student assignments (as student or case manager)
    await adminClient
      .from('student_assignments')
      .delete()
      .or(`student_id.eq.${userId},case_manager_id.eq.${userId}`);

    // 2. Delete appointments
    await adminClient
      .from('appointments')
      .delete()
      .or(`student_id.eq.${userId},case_manager_id.eq.${userId}`);

    // 3. Update support requests - clear case manager assignment if they're being deleted
    await adminClient
      .from('support_requests')
      .update({ assigned_case_manager_id: null })
      .eq('assigned_case_manager_id', userId);

    // 4. Delete staff messages
    await adminClient
      .from('staff_messages')
      .delete()
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);

    // 5. Delete notifications
    await adminClient
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    // 6. Delete offline drafts
    await adminClient
      .from('offline_drafts')
      .delete()
      .eq('user_id', userId);

    // 7. Delete AI insights for this case manager
    await adminClient
      .from('ai_insights')
      .delete()
      .eq('case_manager_id', userId);

    // 8. Update user_invitations - clear invited_by reference
    await adminClient
      .from('user_invitations')
      .update({ invited_by: requestingUser.id }) // Transfer to current admin
      .eq('invited_by', userId);

    // 9. Delete the user from auth (this cascades to profiles and user_roles)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('Failed to delete user:', deleteError);
      return createErrorResponse(deleteError, 'delete-user', 500, corsHeaders);
    }

    console.log(`Successfully deleted user ${targetUser.user.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User deleted successfully',
        deletedEmail: targetUser.user.email,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Unexpected error in delete-user:', error);
    return createErrorResponse(error, 'delete-user', 500, corsHeaders);
  }
});
