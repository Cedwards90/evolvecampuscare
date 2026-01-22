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

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }
  
  return result === 0;
}

// Validate CRON_SECRET with strength requirements
function validateCronSecret(providedSecret: string | null): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET');
  
  // Secret must be configured and at least 32 characters
  if (!cronSecret || cronSecret.length < 32) {
    console.error('CRON_SECRET not configured or too weak (must be 32+ characters)');
    return false;
  }
  
  if (!providedSecret) return false;
  
  return timingSafeEqual(providedSecret, cronSecret);
}

interface CaseManagerStats {
  email: string;
  fullName: string;
  activeCount: number;
  resolvedThisWeek: number;
  emergencyCount: number;
  escalatedCount: number;
  agingRequests: { id: string; title: string; daysSinceUpdate: number }[];
  categoryBreakdown: Record<string, number>;
}

async function generateAIInsights(stats: CaseManagerStats): Promise<string[]> {
  const insights: string[] = [];

  if (stats.agingRequests.length > 0) {
    insights.push(
      `⚠️ You have ${stats.agingRequests.length} request(s) that haven't been updated in over 7 days. Consider reviewing these to ensure students receive timely support.`
    );
  }

  if (stats.emergencyCount > 0) {
    insights.push(
      `🚨 You currently have ${stats.emergencyCount} emergency case(s). These should be prioritized for immediate attention.`
    );
  }

  if (stats.resolvedThisWeek > 5) {
    insights.push(
      `🎉 Great work! You resolved ${stats.resolvedThisWeek} requests this week. Keep up the excellent support!`
    );
  } else if (stats.resolvedThisWeek === 0 && stats.activeCount > 0) {
    insights.push(
      `📋 No requests were resolved this week. Consider focusing on closing out some pending cases.`
    );
  }

  if (stats.activeCount > 10) {
    insights.push(
      `📊 Your caseload is quite high at ${stats.activeCount} active requests. Consider prioritizing by urgency and deadline.`
    );
  }

  const topCategory = Object.entries(stats.categoryBreakdown).sort(
    (a, b) => b[1] - a[1]
  )[0];
  if (topCategory && topCategory[1] > 3) {
    const categoryName = topCategory[0].replace(/_/g, " ");
    insights.push(
      `📈 Most of your requests (${topCategory[1]}) are in the "${categoryName}" category. Consider preparing common solutions for this area.`
    );
  }

  if (insights.length === 0) {
    insights.push(
      "✨ Your caseload looks manageable this week. Great job staying on top of your requests!"
    );
  }

  return insights.slice(0, 3);
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

    // Check for cron secret (for scheduled invocations) or user auth
    const authHeader = req.headers.get("Authorization");
    const cronSecretHeader = req.headers.get("X-Cron-Secret");
    
    let isAuthorized = false;
    let userId: string | null = null;

    // Method 1: Cron secret for scheduled jobs (with strong validation)
    if (validateCronSecret(cronSecretHeader)) {
      console.log("Authorized via cron mechanism");
      isAuthorized = true;
    }
    // Method 2: User authentication (admin only)
    else if (authHeader?.startsWith("Bearer ")) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await authClient.auth.getUser();

      if (!authError && user) {
        userId = user.id;
        
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
        const { data: roleData } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .single();

        if (roleData?.role === "admin") {
          console.log("Authorized via admin user");
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      console.error("Unauthorized access attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log("Starting weekly case manager summary generation...");

    const { data: caseManagerRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "case_manager");

    if (rolesError) {
      console.error("Error fetching case manager roles:", rolesError);
      throw new Error("Failed to retrieve case manager data");
    }

    if (!caseManagerRoles || caseManagerRoles.length === 0) {
      console.log("No case managers found");
      return new Response(
        JSON.stringify({ success: true, message: "No case managers to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const emailsSent: string[] = [];

    for (const role of caseManagerRoles) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", role.user_id)
        .single();

      if (profileError || !profile?.email) {
        console.error("Error fetching profile for user");
        continue;
      }

      const { data: requests, error: requestsError } = await supabase
        .from("support_requests")
        .select("id, title, status, category, priority, is_emergency, updated_at, created_at, resolved_at")
        .eq("assigned_case_manager_id", role.user_id);

      if (requestsError) {
        console.error("Error fetching requests");
        continue;
      }

      const allRequests = requests || [];

      const activeRequests = allRequests.filter(
        (r) => !["resolved", "cancelled"].includes(r.status)
      );
      const resolvedThisWeek = allRequests.filter(
        (r) => r.status === "resolved" && r.resolved_at && new Date(r.resolved_at) >= oneWeekAgo
      );
      const emergencyRequests = activeRequests.filter((r) => r.is_emergency);
      const escalatedRequests = activeRequests.filter((r) => r.status === "escalated");

      const agingRequests = activeRequests
        .filter((r) => new Date(r.updated_at) < sevenDaysAgo)
        .map((r) => ({
          id: r.id,
          title: r.title,
          daysSinceUpdate: Math.floor(
            (Date.now() - new Date(r.updated_at).getTime()) / (1000 * 60 * 60 * 24)
          ),
        }))
        .slice(0, 5);

      const categoryBreakdown: Record<string, number> = {};
      activeRequests.forEach((r) => {
        categoryBreakdown[r.category] = (categoryBreakdown[r.category] || 0) + 1;
      });

      const stats: CaseManagerStats = {
        email: profile.email,
        fullName: profile.full_name || "Case Manager",
        activeCount: activeRequests.length,
        resolvedThisWeek: resolvedThisWeek.length,
        emergencyCount: emergencyRequests.length,
        escalatedCount: escalatedRequests.length,
        agingRequests,
        categoryBreakdown,
      };

      const insights = await generateAIInsights(stats);

      const agingSection =
        agingRequests.length > 0
          ? `
          <div style="margin-top: 24px;">
            <h3 style="color: #1f2937; font-size: 16px; margin: 0 0 12px 0;">⏰ Requests Needing Attention</h3>
            <table style="width: 100%; border-collapse: collapse;">
              ${agingRequests
                .map(
                  (r) => `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; color: #374151; font-size: 14px;">${r.title}</td>
                  <td style="padding: 8px 0; color: #ef4444; font-size: 14px; text-align: right;">${r.daysSinceUpdate} days</td>
                </tr>
              `
                )
                .join("")}
            </table>
          </div>
        `
          : "";

      const insightsSection = `
        <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px; margin-top: 24px;">
          <h3 style="color: #065f46; font-size: 16px; margin: 0 0 16px 0;">💡 AI-Powered Insights</h3>
          ${insights.map((insight) => `<p style="color: #047857; font-size: 14px; margin: 0 0 12px 0; line-height: 1.5;">${insight}</p>`).join("")}
        </div>
      `;

      const categorySection =
        Object.keys(categoryBreakdown).length > 0
          ? `
          <div style="margin-top: 24px;">
            <h3 style="color: #1f2937; font-size: 16px; margin: 0 0 12px 0;">📂 By Category</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${Object.entries(categoryBreakdown)
                .map(
                  ([cat, count]) => `
                <span style="background-color: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 9999px; font-size: 14px;">
                  ${cat.replace(/_/g, " ")}: ${count}
                </span>
              `
                )
                .join("")}
            </div>
          </div>
        `
          : "";

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekLabel = weekStart.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Weekly Caseload Summary</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
              <div style="background-color: #054D3B; padding: 24px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📊 Weekly Caseload Summary</h1>
                <p style="color: #d1fae5; margin: 8px 0 0 0; font-size: 14px;">Week of ${weekLabel}</p>
              </div>
              
              <div style="padding: 32px;">
                <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
                  Hi ${stats.fullName},
                </p>
                
                <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
                  Here's your weekly summary of support requests and performance insights.
                </p>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
                  <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0;">Active Requests</p>
                    <p style="color: #1f2937; font-size: 32px; font-weight: bold; margin: 8px 0 0 0;">${stats.activeCount}</p>
                  </div>
                  <div style="background-color: #ecfdf5; border-radius: 8px; padding: 16px; text-align: center;">
                    <p style="color: #065f46; font-size: 12px; margin: 0;">Resolved This Week</p>
                    <p style="color: #059669; font-size: 32px; font-weight: bold; margin: 8px 0 0 0;">${stats.resolvedThisWeek}</p>
                  </div>
                  <div style="background-color: #fef2f2; border-radius: 8px; padding: 16px; text-align: center;">
                    <p style="color: #991b1b; font-size: 12px; margin: 0;">Emergency Cases</p>
                    <p style="color: #dc2626; font-size: 32px; font-weight: bold; margin: 8px 0 0 0;">${stats.emergencyCount}</p>
                  </div>
                  <div style="background-color: #fffbeb; border-radius: 8px; padding: 16px; text-align: center;">
                    <p style="color: #92400e; font-size: 12px; margin: 0;">Escalated</p>
                    <p style="color: #d97706; font-size: 32px; font-weight: bold; margin: 8px 0 0 0;">${stats.escalatedCount}</p>
                  </div>
                </div>
                
                ${categorySection}
                ${agingSection}
                ${insightsSection}
                
                <div style="text-align: center; margin-top: 32px;">
                  <a href="https://evolvecampuscare.lovable.app/case-manager-managing-student-requests" 
                     style="display: inline-block; background-color: #054D3B; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                    View Dashboard
                  </a>
                </div>
              </div>
              
              <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                  This is your weekly summary from Evolve Foundation Support Portal
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

      console.log("Sending weekly summary to case manager");

      await resend.emails.send({
        from: "Evolve Foundation <noreply@evolvefoundation.us>",
        to: [profile.email],
        subject: `📊 Your Weekly Caseload Summary - Week of ${weekLabel}`,
        html: emailHtml,
      });

      emailsSent.push(profile.email);
    }

    console.log(`Weekly summaries sent: ${emailsSent.length}`);

    return new Response(
      JSON.stringify({ success: true, count: emailsSent.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const safeMessage = sanitizeError(error, "weekly-case-manager-summary");
    return new Response(
      JSON.stringify({ error: safeMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get("Origin")) } }
    );
  }
};

serve(handler);
