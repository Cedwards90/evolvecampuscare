import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TokenRequest {
  email: string;
  role: string;
  notes?: string;
  autoAssignCaseManager?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create authenticated client to verify the user
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service client for privileged operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user has permission to invite
    const { data: roleData, error: roleError } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || !roleData) {
      console.error("Role check error:", roleError);
      return new Response(
        JSON.stringify({ error: "Could not verify user role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userRole = roleData.role;

    // Parse request body
    const body: TokenRequest = await req.json();
    const { email, role, notes, autoAssignCaseManager } = body;

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "Email and role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorization checks
    if (userRole === "case_manager" && role !== "student") {
      return new Response(
        JSON.stringify({ error: "Case managers can only invite students" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (userRole === "student") {
      return new Response(
        JSON.stringify({ error: "Students cannot send invitations" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate cryptographically secure token (32 bytes = 64 hex characters)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Calculate expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Insert invitation into database
    const { data: invitation, error: insertError } = await serviceClient
      .from("user_invitations")
      .insert({
        email,
        invited_role: role,
        invited_by: user.id,
        token,
        expires_at: expiresAt.toISOString(),
        auto_assign_case_manager: autoAssignCaseManager || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the invitation URL
    const baseUrl = "https://evolvecampuscare.lovable.app";
    const inviteUrl = `${baseUrl}/auth?tab=signup&invite=${token}`;

    console.log(`Invitation created for ${email} with role ${role}`);

    return new Response(
      JSON.stringify({
        invitation,
        inviteUrl,
        token,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating invitation token:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
