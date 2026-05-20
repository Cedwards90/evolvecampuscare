import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sanitizeError = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.length > 200 ? msg.slice(0, 200) : msg;
};

const MIN_DEMO_BUCKET = 5;

interface ScopeInput {
  organization_id?: string | null;
  cohort_start_date?: string | null;
  case_manager_id?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  demographic_filters?: Record<string, string> | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Role lookup
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roleSet = new Set((roles || []).map((r: any) => r.role));
    const isAdmin = roleSet.has("admin");
    const isOrgAdmin = roleSet.has("org_admin");
    const isCaseManager = roleSet.has("case_manager");
    if (!isAdmin && !isOrgAdmin && !isCaseManager) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as ScopeInput;

    // Determine in-scope student IDs server-side
    let allowedStudentIds: string[] = [];

    if (isCaseManager && !isAdmin && !isOrgAdmin) {
      const { data: assigns } = await admin
        .from("student_assignments")
        .select("student_id")
        .eq("case_manager_id", user.id);
      allowedStudentIds = (assigns || []).map((r: any) => r.student_id);
    } else if (isOrgAdmin && !isAdmin) {
      const { data: oas } = await admin
        .from("org_admins")
        .select("organization_id")
        .eq("user_id", user.id);
      const orgIds = (oas || []).map((r: any) => r.organization_id);
      if (body.organization_id && !orgIds.includes(body.organization_id)) {
        return new Response(JSON.stringify({ error: "Forbidden org" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const targetOrgs = body.organization_id ? [body.organization_id] : orgIds;
      const { data: profs } = await admin
        .from("profiles")
        .select("user_id")
        .in("organization_id", targetOrgs);
      const idsA = (profs || []).map((p: any) => p.user_id);
      const { data: mems } = await admin
        .from("organization_memberships")
        .select("user_id")
        .in("organization_id", targetOrgs)
        .is("left_at", null);
      const idsB = (mems || []).map((m: any) => m.user_id);
      allowedStudentIds = Array.from(new Set([...idsA, ...idsB]));
    } else {
      // Admin: optionally filter by org
      if (body.organization_id) {
        const { data: profs } = await admin
          .from("profiles")
          .select("user_id")
          .eq("organization_id", body.organization_id);
        allowedStudentIds = (profs || []).map((p: any) => p.user_id);
      } else {
        // all students
        const { data: studentRoles } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("role", "student");
        allowedStudentIds = (studentRoles || []).map((r: any) => r.user_id);
      }
    }

    // Apply case_manager filter
    if (body.case_manager_id) {
      const { data: assigns } = await admin
        .from("student_assignments")
        .select("student_id")
        .eq("case_manager_id", body.case_manager_id);
      const cmStudents = new Set((assigns || []).map((a: any) => a.student_id));
      allowedStudentIds = allowedStudentIds.filter((id) => cmStudents.has(id));
    }

    // Apply cohort filter
    if (body.cohort_start_date) {
      const { data: profs } = await admin
        .from("profiles")
        .select("user_id")
        .eq("cohort_start_date", body.cohort_start_date)
        .in("user_id", allowedStudentIds.length > 0 ? allowedStudentIds : ["00000000-0000-0000-0000-000000000000"]);
      allowedStudentIds = (profs || []).map((p: any) => p.user_id);
    }

    // Apply demographic filters (admin / org_admin only)
    if (body.demographic_filters && (isAdmin || isOrgAdmin)) {
      const { data: demos } = await admin
        .from("participant_demographics")
        .select("student_id, gender, age_range, ethnicity, veteran_status, justice_involved, disability_status");
      const filtered = (demos || []).filter((d: any) => {
        for (const [k, v] of Object.entries(body.demographic_filters || {})) {
          if (!v) continue;
          if (k === "ethnicity") {
            if (!Array.isArray(d.ethnicity) || !d.ethnicity.includes(v)) return false;
          } else if (k === "veteran_status" || k === "justice_involved" || k === "disability_status") {
            if (String(d[k]) !== v) return false;
          } else {
            if (d[k] !== v) return false;
          }
        }
        return true;
      });
      const demoIds = new Set(filtered.map((d: any) => d.student_id));
      allowedStudentIds = allowedStudentIds.filter((id) => demoIds.has(id));
    }

    const studentIds = allowedStudentIds;
    const totalParticipants = studentIds.length;

    // Date range
    const dateFrom = body.date_from ? new Date(body.date_from) : null;
    const dateTo = body.date_to ? new Date(body.date_to) : null;

    // ----- Aggregations -----
    const safeIn = studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"];

    // Certifications earned (completed status)
    const { data: certs } = await admin
      .from("student_certifications")
      .select("student_id, status, completion_date")
      .in("student_id", safeIn);
    const completedCerts = (certs || []).filter((c: any) => c.status === "completed");
    const certsInRange = completedCerts.filter((c: any) => {
      if (!c.completion_date) return false;
      const d = new Date(c.completion_date);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });

    // Outcomes
    const { data: outcomes } = await admin
      .from("participant_outcomes")
      .select("*")
      .in("student_id", safeIn);
    const outcomesArr = outcomes || [];
    const placements = outcomesArr.filter((o: any) => o.placement_date);
    const placementsInRange = placements.filter((o: any) => {
      const d = new Date(o.placement_date);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });

    // Wage growth
    const wagePairs = outcomesArr.filter((o: any) => o.baseline_wage && o.hourly_wage);
    const avgBaseline =
      wagePairs.length > 0
        ? wagePairs.reduce((s: number, o: any) => s + Number(o.baseline_wage), 0) / wagePairs.length
        : 0;
    const avgCurrent =
      wagePairs.length > 0
        ? wagePairs.reduce((s: number, o: any) => s + Number(o.hourly_wage), 0) / wagePairs.length
        : 0;
    const wageGrowthPct = avgBaseline > 0 ? ((avgCurrent - avgBaseline) / avgBaseline) * 100 : 0;

    // Retention milestones
    const retention = {
      d30: outcomesArr.filter((o: any) => o.retention_30_met).length,
      d60: outcomesArr.filter((o: any) => o.retention_60_met).length,
      d90: outcomesArr.filter((o: any) => o.retention_90_met).length,
      d180: outcomesArr.filter((o: any) => o.retention_180_met).length,
      d365: outcomesArr.filter((o: any) => o.retention_365_met).length,
    };

    const completions = outcomesArr.filter((o: any) => o.program_completed);
    const completionRate = totalParticipants > 0 ? (completions.length / totalParticipants) * 100 : 0;

    // Support requests
    const { data: reqs } = await admin
      .from("support_requests")
      .select("id, student_id, status, created_at, resolved_at")
      .in("student_id", safeIn);
    const reqsArr = (reqs || []).filter((r: any) => {
      const d = new Date(r.created_at);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
    const resolved = reqsArr.filter((r: any) => r.resolved_at);
    const avgResolutionHours =
      resolved.length > 0
        ? resolved.reduce(
            (s: number, r: any) =>
              s + (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) / 36e5,
            0,
          ) / resolved.length
        : 0;

    // Check-ins (engagement)
    const { data: checkins } = await admin
      .from("student_checkins")
      .select("student_id, created_at")
      .in("student_id", safeIn);
    const checkinsArr = (checkins || []).filter((c: any) => {
      const d = new Date(c.created_at);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });

    // Appointments (attendance)
    const { data: appts } = await admin
      .from("appointments")
      .select("student_id, status, scheduled_at")
      .in("student_id", safeIn);
    const apptsArr = (appts || []).filter((a: any) => {
      const d = new Date(a.scheduled_at);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
    const attended = apptsArr.filter((a: any) => a.status === "completed").length;
    const attendanceRate = apptsArr.length > 0 ? (attended / apptsArr.length) * 100 : 0;

    // Impact survey responses
    const { data: srRows } = await admin
      .from("impact_survey_responses")
      .select("student_id, template_id, responses, score_summary, submitted_at")
      .in("student_id", safeIn);
    const { data: templates } = await admin
      .from("impact_survey_templates")
      .select("id, slug, title");
    const tplBySlug: Record<string, any> = {};
    const tplById: Record<string, any> = {};
    (templates || []).forEach((t: any) => {
      tplBySlug[t.slug] = t;
      tplById[t.id] = t;
    });

    const surveyBySlug: Record<string, any> = {};
    for (const t of templates || []) {
      surveyBySlug[t.slug] = {
        title: t.title,
        response_count: 0,
        avg_score: null as number | null,
        positive_pct: null as number | null,
        sample_size: 0,
      };
    }
    for (const r of srRows || []) {
      const tpl = tplById[r.template_id];
      if (!tpl) continue;
      const slug = tpl.slug;
      const bucket = surveyBySlug[slug];
      bucket.response_count += 1;
      const score = (r.score_summary as any)?.score;
      if (typeof score === "number") {
        bucket.avg_score = (bucket.avg_score || 0) + score;
        bucket.sample_size += 1;
      }
    }
    for (const slug of Object.keys(surveyBySlug)) {
      const b = surveyBySlug[slug];
      if (b.sample_size > 0) b.avg_score = b.avg_score / b.sample_size;
      // Privacy: suppress if sample too small
      if (b.sample_size > 0 && b.sample_size < MIN_DEMO_BUCKET) {
        b.avg_score = null;
        b.suppressed = true;
      }
    }

    // Mentorship participation
    const mentorshipResponses = (srRows || []).filter(
      (r: any) => tplById[r.template_id]?.slug === "mentorship_participation",
    );
    const hasMentor = mentorshipResponses.filter(
      (r: any) => (r.responses as any)?.has_mentor === true,
    ).length;

    // Funding goals progress
    const { data: goals } = await admin
      .from("funding_goals")
      .select("*")
      .or(`organization_id.is.null${body.organization_id ? `,organization_id.eq.${body.organization_id}` : ""}`);
    const goalProgress = (goals || []).map((g: any) => {
      let current = 0;
      switch (g.metric_key) {
        case "job_placements":
          current = placements.filter((p: any) => {
            const d = new Date(p.placement_date);
            return d >= new Date(g.period_start) && d <= new Date(g.period_end);
          }).length;
          break;
        case "certifications":
          current = completedCerts.filter((c: any) => {
            if (!c.completion_date) return false;
            const d = new Date(c.completion_date);
            return d >= new Date(g.period_start) && d <= new Date(g.period_end);
          }).length;
          break;
        case "completions":
          current = completions.filter((c: any) => {
            if (!c.program_completion_date) return false;
            const d = new Date(c.program_completion_date);
            return d >= new Date(g.period_start) && d <= new Date(g.period_end);
          }).length;
          break;
        case "requests_resolved":
          current = (reqs || []).filter((r: any) => {
            if (!r.resolved_at) return false;
            const d = new Date(r.resolved_at);
            return d >= new Date(g.period_start) && d <= new Date(g.period_end);
          }).length;
          break;
        default:
          current = 0;
      }
      return {
        ...g,
        current_value: current,
        progress_pct: g.target_value > 0 ? (current / Number(g.target_value)) * 100 : 0,
      };
    });

    // Demographic breakdown (admin/org_admin only)
    let demographicBreakdown: Record<string, Record<string, number>> | null = null;
    if (isAdmin || isOrgAdmin) {
      const { data: demos } = await admin
        .from("participant_demographics")
        .select("*")
        .in("student_id", safeIn);
      const buckets: Record<string, Record<string, number>> = {
        gender: {},
        age_range: {},
        ethnicity: {},
      };
      for (const d of demos || []) {
        if (d.gender) buckets.gender[d.gender] = (buckets.gender[d.gender] || 0) + 1;
        if (d.age_range) buckets.age_range[d.age_range] = (buckets.age_range[d.age_range] || 0) + 1;
        if (Array.isArray(d.ethnicity)) {
          for (const e of d.ethnicity) buckets.ethnicity[e] = (buckets.ethnicity[e] || 0) + 1;
        }
      }
      // Suppress small buckets
      for (const cat of Object.keys(buckets)) {
        for (const k of Object.keys(buckets[cat])) {
          if (buckets[cat][k] < MIN_DEMO_BUCKET) buckets[cat][k] = 0;
        }
      }
      demographicBreakdown = buckets;
    }

    // Trends: month-by-month for placements, certs, requests
    const trends: any[] = [];
    if (dateFrom && dateTo) {
      const cursor = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), 1);
      const end = new Date(dateTo.getFullYear(), dateTo.getMonth(), 1);
      while (cursor <= end) {
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
        const monthStart = new Date(cursor);
        trends.push({
          month: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
          placements: placements.filter((p: any) => {
            const d = new Date(p.placement_date);
            return d >= monthStart && d <= monthEnd;
          }).length,
          certifications: completedCerts.filter((c: any) => {
            if (!c.completion_date) return false;
            const d = new Date(c.completion_date);
            return d >= monthStart && d <= monthEnd;
          }).length,
          requests_resolved: (reqs || []).filter((r: any) => {
            if (!r.resolved_at) return false;
            const d = new Date(r.resolved_at);
            return d >= monthStart && d <= monthEnd;
          }).length,
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    const result = {
      generated_at: new Date().toISOString(),
      scope: {
        organization_id: body.organization_id || null,
        case_manager_id: body.case_manager_id || null,
        cohort_start_date: body.cohort_start_date || null,
        date_from: body.date_from || null,
        date_to: body.date_to || null,
      },
      participant_growth: {
        total_participants: totalParticipants,
        certifications_earned: completedCerts.length,
        certifications_in_range: certsInRange.length,
        job_placements: placements.length,
        placements_in_range: placementsInRange.length,
        avg_baseline_wage: Math.round(avgBaseline * 100) / 100,
        avg_current_wage: Math.round(avgCurrent * 100) / 100,
        wage_growth_pct: Math.round(wageGrowthPct * 10) / 10,
        retention,
        program_completed: completions.length,
        completion_rate_pct: Math.round(completionRate * 10) / 10,
        attendance_rate_pct: Math.round(attendanceRate * 10) / 10,
        appointments_total: apptsArr.length,
        appointments_attended: attended,
        check_in_count: checkinsArr.length,
        avg_check_ins_per_participant:
          totalParticipants > 0 ? Math.round((checkinsArr.length / totalParticipants) * 10) / 10 : 0,
        support_requests_total: reqsArr.length,
        support_requests_resolved: resolved.length,
        avg_resolution_hours: Math.round(avgResolutionHours * 10) / 10,
      },
      social_impact: {
        surveys: surveyBySlug,
        has_mentor_count: hasMentor,
      },
      funding_goals: goalProgress,
      demographic_breakdown: demographicBreakdown,
      trends,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: sanitizeError(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
