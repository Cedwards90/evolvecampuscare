import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://evolvecampuscare.lovable.app',
  'https://id-preview--566d8616-fbe5-4c84-8ac9-0bfd7fde3b97.lovable.app',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o.replace('https://', '')))
    ? origin
    : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

function sanitizeError(error: unknown, context: string): string {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.error(`[${context}][${requestId}]`, error);
  
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('not found')) return 'Resource not found';
    if (msg.includes('permission') || msg.includes('forbidden')) return 'Access denied';
    if (msg.includes('mfa') || msg.includes('aal2')) return 'Multi-factor authentication required';
  }
  return `An error occurred. Reference: ${requestId}`;
}

interface TokenRequest {
  email: string;
  role: string;
  notes?: string;
  autoAssignCaseManager?: string;
  organizationId?: string;
  cohortId?: string;
}

// Privileged roles that require MFA verification
const PRIVILEGED_ROLES = ['admin', 'case_manager'];

/**
 * Verify MFA (AAL2) for privileged roles
 */
// deno-lint-ignore no-explicit-any
async function verifyMFAForPrivilegedRole(authClient: any, userRole: string): Promise<{ verified: boolean; error?: string }> {
  if (!PRIVILEGED_ROLES.includes(userRole)) {
    return { verified: true };
  }

  try {
    const { data: aalData, error: aalError } = await authClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) {
      console.error('Error checking MFA status:', aalError);
      return { verified: false, error: 'Failed to verify MFA status' };
    }

    const { data: factorsData } = await authClient.auth.mfa.listFactors();
    // deno-lint-ignore no-explicit-any
    const verifiedFactors = factorsData?.totp?.filter((f: any) => f.status === 'verified') || [];
    
    if (verifiedFactors.length === 0) {
      console.warn(`Privileged user (${userRole}) has no MFA factors enrolled`);
      return { verified: false, error: 'MFA enrollment required for privileged roles' };
    }

    if (aalData?.currentLevel === 'aal1' && aalData?.nextLevel === 'aal2') {
      console.warn(`Privileged user (${userRole}) requires MFA verification`);
      return { verified: false, error: 'MFA verification required' };
    }

    return { verified: true };
  } catch (err) {
    console.error('MFA verification error:', err);
    return { verified: false, error: 'MFA verification failed' };
  }
}

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

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
    if (!authHeader?.startsWith("Bearer ")) {
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

    // ========== MFA ENFORCEMENT FOR PRIVILEGED ROLES ==========
    // Admin and case_manager roles must have completed MFA verification (AAL2)
    const mfaResult = await verifyMFAForPrivilegedRole(authClient, userRole);
    if (!mfaResult.verified) {
      console.warn(`MFA verification failed for ${userRole}: ${mfaResult.error}`);
      return new Response(
        JSON.stringify({ 
          error: mfaResult.error || 'MFA verification required',
          code: 'MFA_REQUIRED'
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // ==========================================================

    // Parse request body
    const body: TokenRequest = await req.json();
    const { role, notes, autoAssignCaseManager, organizationId, cohortId } = body;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

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
        organization_id: organizationId || null,
        cohort_id: cohortId || null,
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

    console.log(`Invitation created for ${email} with role ${role} (MFA verified)`);

    return new Response(
      JSON.stringify({
        invitation,
        inviteUrl,
        token,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const safeMessage = sanitizeError(error, "generate-invitation-token");
    return new Response(
      JSON.stringify({ error: safeMessage }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get("Origin")), "Content-Type": "application/json" } }
    );
  }
});
