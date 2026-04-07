import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get students who need a check-in reminder (last check-in > 21 days ago OR never checked in with account > 21 days)
    const twentyOneDaysAgo = new Date();
    twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);

    // Get all students
    const { data: students, error: studentsError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "student");

    if (studentsError) throw studentsError;

    if (!students || students.length === 0) {
      return new Response(JSON.stringify({ message: "No students found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentIds = students.map((s) => s.user_id);

    // Get latest check-in per student
    const { data: latestCheckins, error: checkinsError } = await supabase
      .from("student_checkins")
      .select("student_id, created_at")
      .in("student_id", studentIds)
      .order("created_at", { ascending: false });

    if (checkinsError) throw checkinsError;

    // Build map of latest check-in per student
    const latestMap = new Map<string, string>();
    for (const c of latestCheckins || []) {
      if (!latestMap.has(c.student_id)) {
        latestMap.set(c.student_id, c.created_at);
      }
    }

    // Get profiles for students who need reminders
    const eligibleStudentIds = studentIds.filter((id) => {
      const lastCheckin = latestMap.get(id);
      if (!lastCheckin) return true; // never checked in
      return new Date(lastCheckin) < twentyOneDaysAgo;
    });

    if (eligibleStudentIds.length === 0) {
      return new Response(JSON.stringify({ message: "No reminders needed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profiles with account age > 21 days for those who never checked in
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, created_at")
      .in("user_id", eligibleStudentIds);

    if (profilesError) throw profilesError;

    // Filter: only send to accounts older than 21 days if they've never checked in
    const toSend = (profiles || []).filter((p) => {
      const lastCheckin = latestMap.get(p.user_id);
      if (lastCheckin) return true; // had a check-in but it's old
      return new Date(p.created_at) < twentyOneDaysAgo; // account old enough
    });

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured", eligible: toSend.length }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sent = 0;
    for (const profile of toSend) {
      try {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

        await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: "Evolve Campus Care <noreply@evolvecampuscare.com>",
            to: [profile.email],
            subject: "Time for your 3-week check-in! 📋",
            html: `
              <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #054D3B;">Hi ${profile.full_name?.split(" ")[0] || "there"} 👋</h2>
                <p style="color: #333; line-height: 1.6;">
                  It's been 3 weeks since your last check-in. We'd love to hear how you're doing!
                </p>
                <p style="color: #333; line-height: 1.6;">
                  Your check-in helps your case manager understand your progress and provide better support.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="https://evolvecampuscare.lovable.app/check-in" 
                     style="background-color: #054D3B; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                    Complete Check-In
                  </a>
                </div>
                <p style="color: #666; font-size: 14px;">
                  This takes less than a minute. Thank you for staying connected!
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #999; font-size: 12px;">
                  Evolve Campus Care — Supporting your journey
                </p>
              </div>
            `,
          }),
        });
        sent++;
      } catch (e) {
        console.error(`Failed to send to ${profile.email}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ message: `Sent ${sent} reminder(s)`, eligible: toSend.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
