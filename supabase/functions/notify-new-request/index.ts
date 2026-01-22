import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitizeError(error: unknown, context: string): string {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.error(`[${context}][${requestId}]`, error);
  
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('not found')) return 'Resource not found';
    if (msg.includes('permission') || msg.includes('forbidden')) return 'Access denied';
  }
  return `An error occurred. Reference: ${requestId}`;
}

interface NewRequestNotification {
  requestId: string;
  requestTitle: string;
  category: string;
  priority: string;
  isEmergency: boolean;
  studentId: string;
  studentName: string;
}

interface NotificationSettings {
  email_enabled: boolean;
  in_app_enabled: boolean;
  types: {
    new_request: boolean;
    status_change: boolean;
    assignment: boolean;
    invitation: boolean;
    weekly_summary: boolean;
  };
}

// deno-lint-ignore no-explicit-any
async function getNotificationSettings(supabase: any): Promise<NotificationSettings> {
  const defaultSettings: NotificationSettings = {
    email_enabled: true,
    in_app_enabled: true,
    types: {
      new_request: true,
      status_change: true,
      assignment: true,
      invitation: true,
      weekly_summary: true,
    },
  };

  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'notifications')
      .single();

    if (error || !data?.value) {
      console.log('Using default notification settings');
      return defaultSettings;
    }

    return data.value as NotificationSettings;
  } catch (err) {
    console.error('Error fetching notification settings:', err);
    return defaultSettings;
  }
}

// deno-lint-ignore no-explicit-any
async function createInAppNotification(
  supabase: any,
  userId: string,
  title: string,
  message: string,
  type: string,
  link: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        link,
        is_read: false,
      });

    if (error) {
      console.error('Failed to create in-app notification:', error);
    } else {
      console.log('In-app notification created for user:', userId);
    }
  } catch (err) {
    console.error('Error creating in-app notification:', err);
  }
}

const handler = async (req: Request): Promise<Response> => {
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

    // ========== CHECK NOTIFICATION SETTINGS ==========
    const settings = await getNotificationSettings(supabase);
    
    if (!settings.types.new_request) {
      console.log('New request notifications disabled via site settings');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'disabled_by_settings' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    // ================================================

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

    console.log("Processing new request notification:", { requestId, category, priority, isEmergency });

    // Check if student has a persistent assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from("student_assignments")
      .select("case_manager_id")
      .eq("student_id", studentId)
      .single();

    let recipientEmails: string[] = [];
    let recipientUserIds: string[] = [];
    let recipientType: "case_manager" | "admins" = "admins";
    let caseManagerName: string | null = null;

    if (assignment?.case_manager_id && !assignmentError) {
      console.log("Student has assigned case manager");
      
      const { data: cmProfile, error: cmError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", assignment.case_manager_id)
        .single();

      if (!cmError && cmProfile) {
        recipientEmails = [cmProfile.email];
        recipientUserIds = [assignment.case_manager_id];
        caseManagerName = cmProfile.full_name;
        recipientType = "case_manager";
      }

      // For emergencies, also notify admins
      if (isEmergency) {
        console.log("Emergency request - also notifying admins");
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        if (adminRoles && adminRoles.length > 0) {
          const adminUserIds = adminRoles.map((r: { user_id: string }) => r.user_id);
          const { data: adminProfiles } = await supabase
            .from("profiles")
            .select("email, user_id")
            .in("user_id", adminUserIds);

          if (adminProfiles) {
            const adminEmails = adminProfiles.map((p: { email: string }) => p.email);
            recipientEmails = [...new Set([...recipientEmails, ...adminEmails])];
            recipientUserIds = [...new Set([...recipientUserIds, ...adminUserIds])];
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
        throw new Error("Failed to retrieve notification recipients");
      }

      if (!adminRoles || adminRoles.length === 0) {
        console.log("No admins found to notify");
        return new Response(
          JSON.stringify({ success: true, message: "No recipients to notify" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const adminUserIds = adminRoles.map((r: { user_id: string }) => r.user_id);
      const { data: adminProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("email, full_name, user_id")
        .in("user_id", adminUserIds);

      if (profilesError) {
        console.error("Error fetching admin profiles:", profilesError);
        throw new Error("Failed to retrieve notification recipients");
      }

      if (!adminProfiles || adminProfiles.length === 0) {
        console.log("No admin profiles found");
        return new Response(
          JSON.stringify({ success: true, message: "No recipients found" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      recipientEmails = adminProfiles.map((p: { email: string }) => p.email);
      recipientUserIds = adminProfiles.map((p: { user_id: string }) => p.user_id);
    }

    // Create in-app notifications for all recipients (if enabled)
    if (settings.in_app_enabled && settings.types.new_request) {
      const notificationTitle = isEmergency
        ? `🚨 Emergency Request: ${requestTitle}`
        : `New Request: ${requestTitle}`;
      
      const notificationMessage = `${studentName || 'A student'} submitted a ${priority} priority ${category.replace(/_/g, ' ')} request.`;
      const notificationLink = `/requests/${requestId}`;

      console.log(`Creating in-app notifications for ${recipientUserIds.length} user(s)`);
      
      for (const recipientUserId of recipientUserIds) {
        await createInAppNotification(
          supabase,
          recipientUserId,
          notificationTitle,
          notificationMessage,
          isEmergency ? 'emergency' : 'new_request',
          notificationLink
        );
      }
    }

    // Send email notifications (if enabled)
    if (settings.email_enabled && settings.types.new_request) {
      const categoryDisplay = category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      const priorityDisplay = priority.charAt(0).toUpperCase() + priority.slice(1);

      const priorityColors: Record<string, string> = {
        low: "#22c55e",
        medium: "#f59e0b",
        high: "#f97316",
        emergency: "#ef4444",
      };
      const priorityColor = priorityColors[priority] || "#6b7280";

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
              <div style="background-color: #054D3B; padding: 24px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">New Support Request</h1>
              </div>
              
              <div style="padding: 32px;">
                ${emergencyBanner}
                ${greeting}
                ${contextMessage}
                
                <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                  <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px 0;">${requestTitle}</h2>
                  
                  <div style="display: flex; gap: 12px; margin-bottom: 12px;">
                    <span style="background-color: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 500;">
                      ${categoryDisplay}
                    </span>
                    <span style="background-color: ${priorityColor}20; color: ${priorityColor}; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 500;">
                      ${priorityDisplay} Priority
                    </span>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 14px; margin: 0;">
                    <strong>Submitted by:</strong> ${studentName || "Student"}
                  </p>
                </div>
                
                <div style="text-align: center;">
                  <a href="https://evolvecampuscare.lovable.app/requests/${requestId}" 
                     style="display: inline-block; background-color: #054D3B; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                    View Request
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

      const subject = isEmergency
        ? `🚨 [EMERGENCY] New Support Request: ${requestTitle}`
        : `[${priorityDisplay}] New Support Request: ${requestTitle}`;

      console.log(`Sending email notification to ${recipientEmails.length} recipient(s)`);

      await resend.emails.send({
        from: "Evolve Foundation <noreply@evolvefoundation.us>",
        to: recipientEmails,
        subject,
        html: emailHtml,
      });

      console.log("Email sent successfully");
    } else {
      console.log("Email notifications disabled via site settings");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipientType,
        recipientCount: recipientEmails.length,
        inAppNotificationsCreated: settings.in_app_enabled ? recipientUserIds.length : 0,
        emailSent: settings.email_enabled,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const safeMessage = sanitizeError(error, "notify-new-request");
    return new Response(
      JSON.stringify({ error: safeMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
