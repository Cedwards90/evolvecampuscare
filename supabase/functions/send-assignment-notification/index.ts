import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

interface AssignmentNotificationRequest {
  requestId: string;
  caseManagerId: string;
  requestTitle: string;
  requestCategory: string;
  requestPriority: string;
  studentName: string;
  isBulk?: boolean;
  totalAssigned?: number;
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

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error("Configuration error");
    }

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userId = user.id;
    console.log("Authenticated user:", userId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user has admin role (only admins can assign requests)
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (roleError || !roleData || roleData.role !== "admin") {
      console.error("User lacks admin permission for assignment notifications");
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ========== MFA ENFORCEMENT FOR PRIVILEGED ROLES ==========
    // Admin role must have completed MFA verification (AAL2)
    const mfaResult = await verifyMFAForPrivilegedRole(authClient, roleData.role);
    if (!mfaResult.verified) {
      console.warn(`MFA verification failed for ${roleData.role}: ${mfaResult.error}`);
      return new Response(
        JSON.stringify({ 
          error: mfaResult.error || 'MFA verification required',
          code: 'MFA_REQUIRED'
        }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    // ==========================================================

    const { 
      requestId, 
      caseManagerId, 
      requestTitle, 
      requestCategory, 
      requestPriority, 
      studentName,
      isBulk,
      totalAssigned 
    }: AssignmentNotificationRequest = await req.json();

    console.log("Processing assignment notification (MFA verified)");

    // Fetch case manager's email from profiles
    const { data: caseManager, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", caseManagerId)
      .single();

    if (profileError || !caseManager) {
      console.error("Profile error:", profileError);
      throw new Error("Recipient not found");
    }

    const priorityColor: Record<string, string> = {
      low: "#22c55e",
      medium: "#eab308",
      high: "#f97316",
      emergency: "#ef4444",
    };

    const categoryLabels: Record<string, string> = {
      academic: "Academic",
      financial: "Financial Aid",
      mental_health: "Mental Health",
      housing: "Housing",
      other: "Other",
    };

    const subject = isBulk 
      ? `${totalAssigned} New Requests Assigned to You`
      : `New Request Assigned: ${requestTitle}`;

    const emailContent = isBulk
      ? `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #054D3B; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="color: #ffffff; margin: 0;">New Support Requests Assigned</h2>
          </div>
          
          <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="color: #4b5563;">Hello ${caseManager.full_name || "Case Manager"},</p>
            
            <p style="color: #4b5563;">${totalAssigned} new support request(s) have been assigned to you via bulk assignment.</p>
            
            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #1f2937;"><strong>Most Recent:</strong> ${requestTitle}</p>
              <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">
                Category: ${categoryLabels[requestCategory] || requestCategory} • 
                Priority: <span style="color: ${priorityColor[requestPriority] || '#6b7280'}">${requestPriority.toUpperCase()}</span>
              </p>
            </div>
            
            <p style="color: #4b5563;">Please log in to the support portal to review and respond to these requests.</p>
            
            <div style="margin-top: 24px; text-align: center;">
              <a href="https://evolvecampuscare.lovable.app/case-manager-managing-student-requests" 
                 style="background: #054D3B; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
                View My Requests
              </a>
            </div>
          </div>
          
          <p style="color: #9ca3af; font-size: 12px; margin-top: 16px; text-align: center;">
            This is an automated notification from Evolve Foundation Support Portal.
          </p>
        </div>
      `
      : `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #054D3B; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="color: #ffffff; margin: 0;">New Support Request Assigned</h2>
          </div>
          
          <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="color: #4b5563;">Hello ${caseManager.full_name || "Case Manager"},</p>
            
            <p style="color: #4b5563;">A new support request has been assigned to you:</p>
            
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 16px 0; border: 1px solid #e5e7eb;">
              <h3 style="margin: 0 0 12px 0; color: #1f2937;">${requestTitle}</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; width: 100px;">Student:</td>
                  <td style="padding: 8px 0; color: #1f2937;">${studentName || "Student"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Category:</td>
                  <td style="padding: 8px 0; color: #1f2937;">${categoryLabels[requestCategory] || requestCategory}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Priority:</td>
                  <td style="padding: 8px 0;">
                    <span style="background: ${priorityColor[requestPriority] || '#6b7280'}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                      ${requestPriority.toUpperCase()}
                    </span>
                  </td>
                </tr>
              </table>
            </div>
            
            <p style="color: #4b5563;">Please log in to the support portal to review and respond to this request.</p>
            
            <div style="margin-top: 24px; text-align: center;">
              <a href="https://evolvecampuscare.lovable.app/requests/${requestId}" 
                 style="background: #054D3B; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
                View Request
              </a>
            </div>
          </div>
          
          <p style="color: #9ca3af; font-size: 12px; margin-top: 16px; text-align: center;">
            This is an automated notification from Evolve Foundation Support Portal.
          </p>
        </div>
      `;

    await resend.emails.send({
      from: "Evolve Foundation <noreply@evolvefoundation.us>",
      to: [caseManager.email],
      subject,
      html: emailContent,
    });

    console.log("Email sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const safeMessage = sanitizeError(error, "send-assignment-notification");
    return new Response(
      JSON.stringify({ error: safeMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get("Origin")) } }
    );
  }
};

serve(handler);
