import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    color: "#22c55e",
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
    color: "#22c55e",
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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      requestId,
      studentId,
      requestTitle,
      previousStatus,
      newStatus,
      note,
    }: StatusChangeNotification = await req.json();

    console.log("Notifying student of status change:", {
      requestId,
      studentId,
      previousStatus,
      newStatus,
    });

    // Get status configuration
    const config = statusConfig[newStatus];
    if (!config) {
      console.log("No email template for status:", newStatus);
      return new Response(
        JSON.stringify({ success: true, message: "No email template for this status" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
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
      throw new Error("Could not find student email");
    }

    // Build note section if provided
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

    // Build resolution survey for resolved status
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
                   style="display: inline-block; background-color: #3B82F6; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  View Request Details
                </a>
              </div>
            </div>
            
            <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                This is an automated notification from Student Support Portal
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    console.log("Sending status change notification to:", studentProfile.email);

    const emailResponse = await resend.emails.send({
      from: "CampusCare <noreply@evolvefoundation.us>",
      to: [studentProfile.email],
      subject: config.subject,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-status-change function:", errorMessage);
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
