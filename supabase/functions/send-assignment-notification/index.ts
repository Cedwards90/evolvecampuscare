import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "resend";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    console.log("Processing assignment notification:", { requestId, caseManagerId, requestTitle });

    // Fetch case manager's email from profiles
    const { data: caseManager, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", caseManagerId)
      .single();

    if (profileError || !caseManager) {
      console.error("Profile error:", profileError);
      throw new Error("Case manager profile not found");
    }

    console.log("Sending email to:", caseManager.email);

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
          <h2 style="color: #1f2937; margin-bottom: 16px;">New Support Requests Assigned</h2>
          
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
          
          <div style="margin-top: 24px;">
            <a href="${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app')}/manage-requests" 
               style="background: #3B82F6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              View My Requests
            </a>
          </div>
          
          <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            This is an automated notification from the Student Support System.
          </p>
        </div>
      `
      : `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1f2937; margin-bottom: 16px;">New Support Request Assigned</h2>
          
          <p style="color: #4b5563;">Hello ${caseManager.full_name || "Case Manager"},</p>
          
          <p style="color: #4b5563;">A new support request has been assigned to you:</p>
          
          <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 16px 0; border: 1px solid #e5e7eb;">
            <h3 style="margin: 0 0 12px 0; color: #1f2937;">${requestTitle}</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; width: 100px;">Student:</td>
                <td style="padding: 8px 0; color: #1f2937;">${studentName || "Unknown Student"}</td>
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
          
          <div style="margin-top: 24px;">
            <a href="${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app')}/request/${requestId}" 
               style="background: #3B82F6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              View Request
            </a>
          </div>
          
          <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            This is an automated notification from the Student Support System.
          </p>
        </div>
      `;

    const emailResponse = await resend.emails.send({
      from: "CampusCare <noreply@evolvefoundation.us>",
      to: [caseManager.email],
      subject,
      html: emailContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending assignment notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
