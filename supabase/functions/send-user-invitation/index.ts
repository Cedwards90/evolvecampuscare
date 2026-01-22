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

interface InvitationRequest {
  email: string;
  role: string;
  token: string;
  inviterName: string;
  notes?: string;
  appUrl?: string;
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
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
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

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Verify user has permission to send invitations (admin or case_manager)
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (roleError || !roleData) {
      console.error("User role not found");
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ========== MFA ENFORCEMENT FOR PRIVILEGED ROLES ==========
    // Admin and case_manager roles must have completed MFA verification (AAL2)
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

    const { email, role, token: inviteToken, inviterName, notes }: InvitationRequest = await req.json();

    // Authorization rules:
    // - Admins can invite any role
    // - Case managers can only invite students
    if (roleData.role === "case_manager" && role !== "student") {
      console.error("Case manager attempted to invite non-student role");
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!["admin", "case_manager"].includes(roleData.role)) {
      console.error("User lacks permission to send invitations");
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending invitation (MFA verified)");

    const baseUrl = "https://evolvecampuscare.lovable.app";
    const signupUrl = `${baseUrl}/auth?tab=signup&invite=${inviteToken}`;

    const roleDisplay = role.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    const roleMessages: Record<string, { color: string; description: string }> = {
      student: {
        color: "#054D3B",
        description: "As a student, you can submit support requests, track their status, and schedule meetings with your case manager.",
      },
      case_manager: {
        color: "#059669",
        description: "As a case manager, you'll help students navigate their support needs, manage requests, and provide guidance.",
      },
      admin: {
        color: "#7c3aed",
        description: "As an administrator, you'll have full access to manage users, monitor workloads, and oversee the entire support system.",
      },
    };

    const roleInfo = roleMessages[role] || roleMessages.student;

    const noteSection = notes
      ? `
        <div style="background-color: #f9fafb; border-left: 4px solid ${roleInfo.color}; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0; font-style: italic;">Personal note from ${inviterName}:</p>
          <p style="color: #374151; font-size: 14px; margin: 0;">"${notes}"</p>
        </div>
      `
      : "";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>You're Invited to Evolve Foundation</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
            <div style="background: linear-gradient(135deg, ${roleInfo.color} 0%, ${roleInfo.color}dd 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">You're Invited! 🎉</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">
                Join Evolve Foundation as a ${roleDisplay}
              </p>
            </div>
            
            <div style="padding: 32px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                Hello,
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                <strong>${inviterName}</strong> has invited you to join the Evolve Foundation student support platform.
              </p>
              
              ${noteSection}
              
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <h3 style="color: #1f2937; font-size: 16px; margin: 0 0 8px 0;">Your Role: ${roleDisplay}</h3>
                <p style="color: #6b7280; font-size: 14px; margin: 0; line-height: 1.5;">
                  ${roleInfo.description}
                </p>
              </div>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${signupUrl}" 
                   style="display: inline-block; background-color: ${roleInfo.color}; color: #ffffff; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  Accept Invitation
                </a>
              </div>
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center;">
                This invitation expires in 7 days.
              </p>
            </div>
            
            <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Evolve Foundation - Student Support Portal
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    await resend.emails.send({
      from: "Evolve Foundation <noreply@evolvefoundation.us>",
      to: [email],
      subject: `${inviterName} invited you to join Evolve Foundation as a ${roleDisplay}`,
      html: emailHtml,
    });

    console.log("Invitation email sent successfully");

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const safeMessage = sanitizeError(error, "send-user-invitation");
    return new Response(
      JSON.stringify({ error: safeMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get("Origin")) } }
    );
  }
};

serve(handler);
