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
  }
  return `An error occurred. Reference: ${requestId}`;
}

interface CalendarEventRequest {
  appointmentId: string;
  studentId: string;
  caseManagerId: string;
  title: string;
  description?: string;
  startTime: string;
  durationMinutes: number;
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
      appointmentId,
      studentId,
      caseManagerId,
      title,
      description,
      startTime,
      durationMinutes,
    }: CalendarEventRequest = await req.json();

    // Verify user is either the case manager creating the meeting or an admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const isAdmin = roleData?.role === "admin";
    const isCaseManager = userId === caseManagerId;

    if (!isAdmin && !isCaseManager) {
      console.error("User lacks permission to create calendar events");
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Creating calendar event for appointment:", appointmentId);

    // Fetch participant profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", [studentId, caseManagerId]);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw new Error("Failed to fetch participant information");
    }

    const student = profiles?.find((p) => p.user_id === studentId);
    const caseManager = profiles?.find((p) => p.user_id === caseManagerId);

    if (!student || !caseManager) {
      throw new Error("Participant information not found");
    }

    // Note: Google Calendar integration requires OAuth setup
    const meetingNote = "Please coordinate the meeting link separately (e.g., Zoom, Google Meet, or in-person).";

    // Format date/time for email
    const startDate = new Date(startTime);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    };
    const formattedDate = startDate.toLocaleDateString("en-US", dateOptions);
    const formattedStartTime = startDate.toLocaleTimeString("en-US", timeOptions);
    const formattedEndTime = endDate.toLocaleTimeString("en-US", timeOptions);

    // Build email HTML
    const buildEmailHtml = (recipientName: string, isStudent: boolean) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Meeting Scheduled</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
            <div style="background-color: #054D3B; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📅 Meeting Scheduled</h1>
            </div>
            
            <div style="padding: 32px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                Hello ${recipientName},
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                A meeting has been scheduled ${isStudent ? "with your case manager" : "with your student"}.
              </p>
              
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px 0;">${title}</h2>
                
                <div style="margin-bottom: 12px;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0 0 4px 0;">📅 Date</p>
                  <p style="color: #1f2937; font-size: 16px; margin: 0; font-weight: 500;">${formattedDate}</p>
                </div>
                
                <div style="margin-bottom: 12px;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0 0 4px 0;">🕐 Time</p>
                  <p style="color: #1f2937; font-size: 16px; margin: 0; font-weight: 500;">${formattedStartTime} - ${formattedEndTime}</p>
                </div>
                
                <div style="margin-bottom: 12px;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0 0 4px 0;">👤 ${isStudent ? "Case Manager" : "Student"}</p>
                  <p style="color: #1f2937; font-size: 16px; margin: 0; font-weight: 500;">${isStudent ? caseManager.full_name : student.full_name}</p>
                </div>
                
                ${description ? `
                <div>
                  <p style="color: #6b7280; font-size: 14px; margin: 0 0 4px 0;">📝 Description</p>
                  <p style="color: #1f2937; font-size: 14px; margin: 0;">${description}</p>
                </div>
                ` : ""}
              </div>
              
              <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <p style="color: #92400e; font-size: 14px; margin: 0;">
                  <strong>Note:</strong> ${meetingNote}
                </p>
              </div>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="https://evolvecampuscare.lovable.app/dashboard" 
                   style="display: inline-block; background-color: #054D3B; color: #ffffff; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  View in Portal
                </a>
              </div>
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center;">
                Add this meeting to your calendar to receive reminders.
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

    // Send emails to both participants
    const emailPromises = [
      resend.emails.send({
        from: "Evolve Foundation <noreply@evolvefoundation.us>",
        to: [student.email],
        subject: `Meeting Scheduled: ${title}`,
        html: buildEmailHtml(student.full_name || "Student", true),
      }),
      resend.emails.send({
        from: "Evolve Foundation <noreply@evolvefoundation.us>",
        to: [caseManager.email],
        subject: `Meeting Scheduled: ${title}`,
        html: buildEmailHtml(caseManager.full_name || "Case Manager", false),
      }),
    ];

    const emailResults = await Promise.allSettled(emailPromises);
    console.log("Email results:", emailResults.map(r => r.status));

    return new Response(
      JSON.stringify({ 
        success: true, 
        meetingLink: null,
        message: "Meeting scheduled and notifications sent."
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const safeMessage = sanitizeError(error, "create-calendar-event");
    return new Response(
      JSON.stringify({ error: safeMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get("Origin")) },
      }
    );
  }
};

serve(handler);
