import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NewRequestNotification {
  requestId: string;
  requestTitle: string;
  category: string;
  priority: string;
  isEmergency: boolean;
  studentId: string;
  studentName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase environment variables");
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

    // Create client with user's auth token to verify
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

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      requestId,
      requestTitle,
      category,
      priority,
      isEmergency,
      studentId,
      studentName,
    }: NewRequestNotification = await req.json();

    // Validate that the authenticated user is the student making the request
    if (userId !== studentId) {
      console.error("User attempted to send notification for another student");
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Processing new request notification:", {
      requestId,
      requestTitle,
      category,
      priority,
      isEmergency,
      studentId,
    });

    // Check if student has a persistent assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from("student_assignments")
      .select("case_manager_id")
      .eq("student_id", studentId)
      .single();

    let recipientEmails: string[] = [];
    let recipientType: "case_manager" | "admins" = "admins";
    let caseManagerName: string | null = null;

    if (assignment?.case_manager_id && !assignmentError) {
      // Student has an assigned case manager - notify them
      console.log("Student has assigned case manager:", assignment.case_manager_id);
      
      const { data: cmProfile, error: cmError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", assignment.case_manager_id)
        .single();

      if (!cmError && cmProfile) {
        recipientEmails = [cmProfile.email];
        caseManagerName = cmProfile.full_name;
        recipientType = "case_manager";
        console.log("Will notify case manager:", cmProfile.email);
      }

      // For emergencies, also notify admins
      if (isEmergency) {
        console.log("Emergency request - also notifying admins");
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        if (adminRoles && adminRoles.length > 0) {
          const adminUserIds = adminRoles.map((r) => r.user_id);
          const { data: adminProfiles } = await supabase
            .from("profiles")
            .select("email")
            .in("user_id", adminUserIds);

          if (adminProfiles) {
            const adminEmails = adminProfiles.map((p) => p.email);
            recipientEmails = [...new Set([...recipientEmails, ...adminEmails])];
          }
        }
      }
    }

    // Fallback: No assignment found - notify all admins
    if (recipientEmails.length === 0) {
      console.log("No case manager assignment - notifying all admins");
      
      const { data: adminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (rolesError) {
        console.error("Error fetching admin roles:", rolesError);
        throw rolesError;
      }

      if (!adminRoles || adminRoles.length === 0) {
        console.log("No admins found to notify");
        return new Response(
          JSON.stringify({ success: true, message: "No admins to notify" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      const adminUserIds = adminRoles.map((r) => r.user_id);
      const { data: adminProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .in("user_id", adminUserIds);

      if (profilesError) {
        console.error("Error fetching admin profiles:", profilesError);
        throw profilesError;
      }

      if (!adminProfiles || adminProfiles.length === 0) {
        console.log("No admin profiles found");
        return new Response(
          JSON.stringify({ success: true, message: "No admin profiles found" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      recipientEmails = adminProfiles.map((p) => p.email);
    }

    // Format category and priority for display
    const categoryDisplay = category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const priorityDisplay = priority.charAt(0).toUpperCase() + priority.slice(1);

    // Determine priority color
    const priorityColors: Record<string, string> = {
      low: "#22c55e",
      medium: "#f59e0b",
      high: "#f97316",
      emergency: "#ef4444",
    };
    const priorityColor = priorityColors[priority] || "#6b7280";

    // Build email HTML - personalized based on recipient type
    const greeting = recipientType === "case_manager" && caseManagerName
      ? `<p style="color: #374151; font-size: 16px; margin-bottom: 16px;">Hello ${caseManagerName},</p>`
      : "";
    
    const contextMessage = recipientType === "case_manager"
      ? `<p style="color: #374151; font-size: 16px; margin-bottom: 24px;">One of your assigned students has submitted a new support request that requires your attention.</p>`
      : `<p style="color: #374151; font-size: 16px; margin-bottom: 24px;">A new support request has been submitted and requires assignment.</p>`;

    const emergencyBanner = isEmergency
      ? `
        <div style="background-color: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="color: #dc2626; font-weight: bold; margin: 0; font-size: 16px;">
            🚨 EMERGENCY REQUEST - Immediate Attention Required
          </p>
        </div>
      `
      : "";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>New Support Request</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
            <div style="background-color: #3B82F6; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">New Support Request</h1>
            </div>
            
            <div style="padding: 32px;">
              ${emergencyBanner}
              ${greeting}
              ${contextMessage}
              
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px 0;">${requestTitle}</h2>
                
                <div style="display: flex; gap: 12px; margin-bottom: 12px;">
                  <span style="background-color: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 500;">
                    ${categoryDisplay}
                  </span>
                  <span style="background-color: ${priorityColor}20; color: ${priorityColor}; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 500;">
                    ${priorityDisplay} Priority
                  </span>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; margin: 0;">
                  <strong>Submitted by:</strong> ${studentName || "Unknown Student"}
                </p>
              </div>
              
              <div style="text-align: center;">
                <a href="https://evolvecampuscare.lovable.app/requests/${requestId}" 
                   style="display: inline-block; background-color: #3B82F6; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  View Request
                </a>
              </div>
            </div>
            
            <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                This is an automated notification from CampusCare Student Support Portal
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email
    const subject = isEmergency
      ? `🚨 [EMERGENCY] New Support Request: ${requestTitle}`
      : `[${priorityDisplay}] New Support Request: ${requestTitle}`;

    console.log("Sending notification to:", recipientEmails);

    const emailResponse = await resend.emails.send({
      from: "CampusCare <noreply@evolvefoundation.us>",
      to: recipientEmails,
      subject,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailResponse,
        recipientType,
        recipientCount: recipientEmails.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-new-request function:", errorMessage);
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
