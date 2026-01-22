import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  role: string;
  token: string;
  inviterName: string;
  notes?: string;
  appUrl?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, role, token, inviterName, notes, appUrl }: InvitationRequest = await req.json();

    console.log("Sending invitation to:", email, "as", role);

    // Use the provided appUrl or fallback to the preview URL
    const baseUrl = appUrl || "https://id-preview--566d8616-fbe5-4c84-8ac9-0bfd7fde3b97.lovable.app";
    const signupUrl = `${baseUrl}/auth?tab=signup&invite=${token}`;
    
    console.log("Generated signup URL:", signupUrl);

    // Format role for display
    const roleDisplay = role.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    // Role-specific messaging
    const roleMessages: Record<string, { color: string; description: string }> = {
      student: {
        color: "#3B82F6",
        description: "As a student, you can submit support requests, track their status, and schedule meetings with your case manager.",
      },
      case_manager: {
        color: "#22C55E",
        description: "As a case manager, you'll help students navigate their support needs, manage requests, and provide guidance.",
      },
      admin: {
        color: "#8B5CF6",
        description: "As an administrator, you'll have full access to manage users, monitor workloads, and oversee the entire support system.",
      },
    };

    const roleInfo = roleMessages[role] || roleMessages.student;

    // Build personalized note section
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
          <title>You're Invited to CampusCare</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
            <div style="background: linear-gradient(135deg, ${roleInfo.color} 0%, ${roleInfo.color}dd 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">You're Invited! 🎉</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">
                Join CampusCare as a ${roleDisplay}
              </p>
            </div>
            
            <div style="padding: 32px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                Hello,
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                <strong>${inviterName}</strong> has invited you to join CampusCare, our student support platform.
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
                CampusCare - Student Support Portal
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "CampusCare <noreply@evolvefoundation.us>",
      to: [email],
      subject: `${inviterName} invited you to join CampusCare as a ${roleDisplay}`,
      html: emailHtml,
    });

    console.log("Invitation email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-user-invitation function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
