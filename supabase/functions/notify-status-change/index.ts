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

interface StatusChangeNotification {
  requestId: string;
  studentId: string;
  requestTitle: string;
  previousStatus: string;
  newStatus: string;
  note?: string;
}

const statusConfig: Record<string, { 
  subject: string; 
  headline: string; 
  color: string; 
  icon: string;
  message: string;
}> = {
  in_progress: {
    subject: "Good news! Your request is being processed",
    headline: "Your Request Has Been Approved",
    color: "#059669",
    icon: "✅",
    message: "Great news! Your support request has been reviewed and approved. A case manager is now actively working on it.",
  },
  cancelled: {
    subject: "Update on your support request",
    headline: "Request Update",
    color: "#6b7280",
    icon: "ℹ️",
    message: "After careful review, we were unable to proceed with your request at this time.",
  },
  resolved: {
    subject: "Your request has been resolved! 🎉",
    headline: "Request Resolved",
    color: "#059669",
    icon: "🎉",
    message: "Your support request has been successfully resolved. We hope we were able to help!",
  },
  escalated: {
    subject: "Your request has been prioritized",
    headline: "Request Escalated",
    color: "#f59e0b",
    icon: "⚡",
    message: "Your request has been escalated for urgent attention. A senior team member will be reviewing your case shortly.",
  },
};

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

    // Verify user has admin or case_manager role (only staff can change status)
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (roleError || !roleData || !["admin", "case_manager"].includes(roleData.role)) {
      console.error("User lacks permission to send status notifications");
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

    const {
      requestId,
      studentId,
      requestTitle,
      previousStatus,
      newStatus,
      note,
    }: StatusChangeNotification = await req.json();

    console.log("Notifying student of status change (MFA verified):", { requestId, previousStatus, newStatus });

    const config = statusConfig[newStatus];
    if (!config) {
      console.log("No email template for status:", newStatus);
      return new Response(
        JSON.stringify({ success: true, message: "No email template for this status" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch student profile to get email
    const { data: studentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", studentId)
      .single();

    if (profileError || !studentProfile?.email) {
      console.error("Error fetching student profile:", profileError);
      throw new Error("Recipient not found");
    }

    const noteSection = note
      ? `
        <div style="background-color: #f3f4f6; border-left: 4px solid ${config.color}; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
          <p style="color: #374151; margin: 0; font-size: 14px;">
            <strong>Note from your case manager:</strong><br>
            ${note}
          </p>
        </div>
      `
      : "";

    const surveySection = newStatus === "resolved"
      ? `
        <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px; margin-top: 24px; text-align: center;">
          <p style="color: #065f46; margin: 0 0 12px 0; font-weight: 500;">
            How was your experience?
          </p>
          <p style="color: #6b7280; margin: 0; font-size: 14px;">
            Your feedback helps us improve our support services.
          </p>
        </div>
      `
      : "";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${config.subject}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
            <div style="background-color: ${config.color}; padding: 24px; text-align: center;">
              <span style="font-size: 48px;">${config.icon}</span>
              <h1 style="color: #ffffff; margin: 16px 0 0 0; font-size: 24px;">${config.headline}</h1>
            </div>
            
            <div style="padding: 32px;">
              <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
                Hi ${studentProfile.full_name || "there"},
              </p>
              
              <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
                ${config.message}
              </p>
              
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">Regarding your request:</p>
                <h2 style="color: #1f2937; font-size: 18px; margin: 0;">${requestTitle}</h2>
              </div>
              
              ${noteSection}
              ${surveySection}
              
              <div style="text-align: center; margin-top: 32px;">
                <a href="https://evolvecampuscare.lovable.app/requests/${requestId}" 
                   style="display: inline-block; background-color: #054D3B; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  View Request Details
                </a>
              </div>
            </div>
            
            <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                This is an automated notification from Evolve Foundation Support Portal
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    console.log("Sending status change notification");

    await resend.emails.send({
      from: "Evolve Foundation <noreply@evolvefoundation.us>",
      to: [studentProfile.email],
      subject: config.subject,
      html: emailHtml,
    });

    console.log("Email sent successfully");

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const safeMessage = sanitizeError(error, "notify-status-change");
    return new Response(
      JSON.stringify({ error: safeMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get("Origin")) } }
    );
  }
};

serve(handler);
