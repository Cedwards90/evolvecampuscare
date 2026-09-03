// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, createErrorResponse } from "../_shared/security.ts";

const PAGE = 1000;

/** Table registry: which tables can be exported, how they are dated and scoped. */
type Scope = "student" | "user" | "org" | "cm" | "none";
interface TableDef {
  group: string;
  label: string;
  dateColumn?: string;
  scope: Scope;
  scopeColumn?: string;
  sensitiveColumns?: string[];
}

const TABLES: Record<string, TableDef> = {
  // Students & people
  profiles: {
    group: "Students & People", label: "Profiles (all users)", dateColumn: "created_at", scope: "user", scopeColumn: "user_id",
    sensitiveColumns: ["date_of_birth", "phone", "address_line1", "address_line2", "city", "state_region", "postal_code", "country", "legal_first_name", "legal_last_name"],
  },
  user_roles: { group: "Students & People", label: "User roles", dateColumn: "created_at", scope: "user", scopeColumn: "user_id" },
  student_assignments: { group: "Students & People", label: "Case manager assignments", dateColumn: "created_at", scope: "student", scopeColumn: "student_id" },
  organization_memberships: { group: "Students & People", label: "Organization memberships", dateColumn: "joined_at", scope: "org", scopeColumn: "organization_id" },
  participant_demographics: { group: "Students & People", label: "Participant demographics", dateColumn: "created_at", scope: "none" },
  student_personality_profiles: { group: "Students & People", label: "Personality profiles", dateColumn: "created_at", scope: "student", scopeColumn: "student_id" },

  // Requests
  support_requests: { group: "Requests", label: "Support requests", dateColumn: "created_at", scope: "student", scopeColumn: "student_id", sensitiveColumns: ["description"] },
  request_line_items: { group: "Requests", label: "Request line items", dateColumn: "created_at", scope: "none" },
  request_updates: { group: "Requests", label: "Request updates / timeline", dateColumn: "created_at", scope: "none", sensitiveColumns: ["note"] },
  request_attachments: { group: "Requests", label: "Request attachments", dateColumn: "created_at", scope: "none" },
  request_share_links: { group: "Requests", label: "Request share links", dateColumn: "created_at", scope: "none" },
  request_share_audit: { group: "Requests", label: "Request share audit", dateColumn: "created_at", scope: "none" },
  offline_drafts: { group: "Requests", label: "Offline drafts", dateColumn: "created_at", scope: "user", scopeColumn: "user_id" },
  form_drafts: { group: "Requests", label: "Form drafts", dateColumn: "created_at", scope: "user", scopeColumn: "user_id" },

  // Surveys & intake
  intake_responses: { group: "Surveys & Intake", label: "Intake responses", dateColumn: "submitted_at", scope: "student", scopeColumn: "student_id", sensitiveColumns: ["responses", "responses_coded"] },
  career_intake_responses: { group: "Surveys & Intake", label: "Career intake responses", dateColumn: "created_at", scope: "student", scopeColumn: "student_id" },
  impact_survey_templates: { group: "Surveys & Intake", label: "Survey templates", dateColumn: "created_at", scope: "none" },
  impact_survey_assignments: { group: "Surveys & Intake", label: "Survey assignments", dateColumn: "created_at", scope: "student", scopeColumn: "student_id" },
  impact_survey_responses: { group: "Surveys & Intake", label: "Survey responses", dateColumn: "submitted_at", scope: "student", scopeColumn: "student_id", sensitiveColumns: ["responses"] },
  survey_invitations: { group: "Surveys & Intake", label: "Survey invitations", dateColumn: "created_at", scope: "student", scopeColumn: "student_id" },
  survey_answer_codes: { group: "Surveys & Intake", label: "Survey answer codes", dateColumn: "created_at", scope: "none" },
  scheduled_survey_distributions: { group: "Surveys & Intake", label: "Scheduled distributions", dateColumn: "created_at", scope: "none" },
  student_checkins: { group: "Surveys & Intake", label: "Student check-ins", dateColumn: "created_at", scope: "student", scopeColumn: "student_id", sensitiveColumns: ["wins", "blockers", "notes", "progress_notes"] },
  post_graduation_plans: { group: "Surveys & Intake", label: "Post-graduation plans", dateColumn: "created_at", scope: "student", scopeColumn: "student_id" },
  participant_outcomes: { group: "Surveys & Intake", label: "Participant outcomes", dateColumn: "created_at", scope: "none" },

  // Notes, files & certifications
  student_files: { group: "Notes & Files", label: "Student folders", dateColumn: "created_at", scope: "student", scopeColumn: "student_id" },
  file_notes: { group: "Notes & Files", label: "Case notes", dateColumn: "created_at", scope: "student", scopeColumn: "student_id", sensitiveColumns: ["content", "identified_needs", "next_steps", "referral_agency", "referral_contact"] },
  folder_summary_audit: { group: "Notes & Files", label: "Folder summary audit", dateColumn: "created_at", scope: "none" },
  student_certifications: { group: "Notes & Files", label: "Certifications", dateColumn: "created_at", scope: "student", scopeColumn: "student_id" },
  certification_catalog: { group: "Notes & Files", label: "Certification catalog", dateColumn: "created_at", scope: "none" },
  staff_messages: { group: "Notes & Files", label: "Messages", dateColumn: "created_at", scope: "none", sensitiveColumns: ["content", "subject"] },

  // Time tracking
  time_entries: { group: "Time Tracking", label: "Time entries", dateColumn: "entry_date", scope: "cm", scopeColumn: "case_manager_id" },
  time_entry_audit: { group: "Time Tracking", label: "Time entry audit", dateColumn: "created_at", scope: "none" },
  active_time_sessions: { group: "Time Tracking", label: "Active shifts", dateColumn: "created_at", scope: "none" },

  // Scheduling
  appointments: { group: "Scheduling", label: "Appointments", dateColumn: "scheduled_at", scope: "student", scopeColumn: "student_id" },
  appointment_blackouts: { group: "Scheduling", label: "Appointment blackouts", dateColumn: "created_at", scope: "none" },
  case_manager_availability: { group: "Scheduling", label: "Case manager availability", dateColumn: "created_at", scope: "none" },

  // Reference
  training_organizations: { group: "Reference", label: "Organizations", dateColumn: "created_at", scope: "org", scopeColumn: "id" },
  cohorts: { group: "Reference", label: "Cohorts", dateColumn: "created_at", scope: "org", scopeColumn: "organization_id" },
  cohort_case_managers: { group: "Reference", label: "Cohort case managers", dateColumn: "created_at", scope: "none" },
  org_admins: { group: "Reference", label: "Organization admins", dateColumn: "created_at", scope: "org", scopeColumn: "organization_id" },
  community_resources: { group: "Reference", label: "Community resources", dateColumn: "created_at", scope: "none" },
  resource_recommendations: { group: "Reference", label: "Resource recommendations", dateColumn: "created_at", scope: "student", scopeColumn: "student_id" },
  program_cost_settings: { group: "Reference", label: "Program cost settings", dateColumn: "created_at", scope: "none" },
  funding_goals: { group: "Reference", label: "Funding goals", dateColumn: "created_at", scope: "none" },
  site_settings: { group: "Reference", label: "Site settings", dateColumn: "created_at", scope: "none" },
  nda_documents: { group: "Reference", label: "NDA documents", dateColumn: "created_at", scope: "none" },
  donor_report_templates: { group: "Reference", label: "Donor report templates", dateColumn: "created_at", scope: "none" },

  // Audit & system (admin only)
  profile_edit_audit: { group: "Audit & System", label: "Profile edit audit", dateColumn: "created_at", scope: "none" },
  user_status_audit: { group: "Audit & System", label: "User status audit", dateColumn: "created_at", scope: "none" },
  org_suspension_audit: { group: "Audit & System", label: "Org suspension audit", dateColumn: "created_at", scope: "none" },
  mfa_exemption_audit: { group: "Audit & System", label: "MFA exemption audit", dateColumn: "created_at", scope: "none" },
  impact_report_audit: { group: "Audit & System", label: "Impact report audit", dateColumn: "created_at", scope: "none" },
  data_quality_flags: { group: "Audit & System", label: "Data quality flags", dateColumn: "created_at", scope: "none" },
  data_export_audit: { group: "Audit & System", label: "Data export audit", dateColumn: "created_at", scope: "none" },
  user_login_events: { group: "Audit & System", label: "Login activity", dateColumn: "created_at", scope: "user", scopeColumn: "user_id" },
  user_invitations: { group: "Audit & System", label: "Invitations", dateColumn: "created_at", scope: "none" },
  bulk_invite_jobs: { group: "Audit & System", label: "Bulk invite jobs", dateColumn: "created_at", scope: "none" },
  bulk_invite_job_items: { group: "Audit & System", label: "Bulk invite job items", dateColumn: "created_at", scope: "none" },
  nda_acceptances: { group: "Audit & System", label: "NDA acceptances", dateColumn: "accepted_at", scope: "user", scopeColumn: "user_id" },
  notifications: { group: "Audit & System", label: "Notifications", dateColumn: "created_at", scope: "user", scopeColumn: "user_id" },
  email_send_log: { group: "Audit & System", label: "Email send log", dateColumn: "created_at", scope: "none" },
  ai_insights: { group: "Audit & System", label: "AI insights", dateColumn: "created_at", scope: "none" },
  qr_codes: { group: "Audit & System", label: "QR codes", dateColumn: "created_at", scope: "org", scopeColumn: "organization_id" },
  qr_scan_events: { group: "Audit & System", label: "QR scan events", dateColumn: "created_at", scope: "none" },
  participant_funnel_events: { group: "Audit & System", label: "Funnel events", dateColumn: "created_at", scope: "none" },
};

/** Tables an org admin may never export (platform-wide/system data). */
const ADMIN_ONLY = new Set([
  "site_settings", "data_export_audit", "mfa_exemption_audit", "org_suspension_audit",
  "email_send_log", "ai_insights", "bulk_invite_jobs", "bulk_invite_job_items",
  "user_login_events", "data_quality_flags", "donor_report_templates",
]);

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  return "\ufeff" + lines.join("\n") + "\n";
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const userId = userData.user.id;
    const admin = createClient(url, service);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isAdmin = roleSet.has("admin");
    const isOrgAdmin = roleSet.has("org_admin");
    if (!isAdmin && !isOrgAdmin) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body.action === "export" ? "export" : "manifest";

    // Resolve org scope for org admins
    let scopedOrgIds: string[] | null = null;
    if (isOrgAdmin && !isAdmin) {
      const { data: oa } = await admin.from("org_admins").select("organization_id").eq("user_id", userId);
      scopedOrgIds = (oa ?? []).map((r: any) => r.organization_id);
      if (!scopedOrgIds.length) scopedOrgIds = ["00000000-0000-0000-0000-000000000000"];
    }
    // Requested org filter (intersected with scope)
    const requestedOrgs: string[] = Array.isArray(body.orgIds) ? body.orgIds.filter((s: any) => typeof s === "string") : [];
    let orgIds: string[] | null = scopedOrgIds;
    if (requestedOrgs.length) {
      orgIds = scopedOrgIds ? requestedOrgs.filter((o) => scopedOrgIds!.includes(o)) : requestedOrgs;
      if (!orgIds.length) orgIds = ["00000000-0000-0000-0000-000000000000"];
    }
    const cohortIds: string[] = Array.isArray(body.cohortIds) ? body.cohortIds.filter((s: any) => typeof s === "string") : [];

    // Resolve the set of user ids in scope when any scoping applies
    let scopedUserIds: string[] | null = null;
    if (orgIds || cohortIds.length) {
      const ids = new Set<string>();
      let q = admin.from("profiles").select("user_id");
      if (orgIds) q = q.in("organization_id", orgIds);
      if (cohortIds.length) q = q.in("cohort_id", cohortIds);
      const { data: byProfile } = await q;
      (byProfile ?? []).forEach((r: any) => ids.add(r.user_id));
      if (orgIds && !cohortIds.length) {
        const { data: byMembership } = await admin
          .from("organization_memberships").select("user_id").in("organization_id", orgIds).is("left_at", null);
        (byMembership ?? []).forEach((r: any) => ids.add(r.user_id));
      }
      scopedUserIds = [...ids];
      if (!scopedUserIds.length) scopedUserIds = ["00000000-0000-0000-0000-000000000000"];
    }

    const from: string | null = typeof body.from === "string" && body.from ? body.from : null;
    const to: string | null = typeof body.to === "string" && body.to ? body.to : null;
    const includeSensitive: boolean = body.includeSensitive !== false;

    const allowed = (name: string) => !!TABLES[name] && (isAdmin || !ADMIN_ONLY.has(name));

    const buildQuery = (name: string, select: string, head = false) => {
      const def = TABLES[name];
      let q = admin.from(name).select(select, head ? { count: "exact", head: true } : undefined);
      if (def.dateColumn && from) q = q.gte(def.dateColumn, from);
      if (def.dateColumn && to) q = q.lte(def.dateColumn, to);
      if (def.scope === "org" && def.scopeColumn && orgIds) q = q.in(def.scopeColumn, orgIds);
      if (["student", "user", "cm"].includes(def.scope) && def.scopeColumn && scopedUserIds) {
        q = q.in(def.scopeColumn, scopedUserIds);
      }
      return q;
    };

    if (action === "manifest") {
      const names = Object.keys(TABLES).filter(allowed);
      const results = await Promise.all(names.map(async (name) => {
        const { count, error } = await buildQuery(name, "*", true) as any;
        return {
          table: name,
          label: TABLES[name].label,
          group: TABLES[name].group,
          dateColumn: TABLES[name].dateColumn ?? null,
          rows: error ? null : (count ?? 0),
        };
      }));
      return new Response(JSON.stringify({ tables: results, scoped: !isAdmin }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ---- export ----
    const requested: string[] = Array.isArray(body.tables) ? body.tables.filter((t: any) => typeof t === "string") : [];
    const tables = requested.filter(allowed);
    if (!tables.length) {
      return new Response(JSON.stringify({ error: "No exportable tables selected" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const files: { name: string; csv: string; rows: number }[] = [];
    let totalRows = 0;

    for (const name of tables) {
      const def = TABLES[name];
      const rows: any[] = [];
      for (let page = 0; ; page++) {
        const { data, error } = await buildQuery(name, "*").range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) { console.error(`export ${name}:`, error.message); break; }
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE || rows.length >= 100000) break;
      }
      const cleaned = includeSensitive || !def.sensitiveColumns?.length
        ? rows
        : rows.map((r) => {
            const c: any = { ...r };
            def.sensitiveColumns!.forEach((k) => { if (k in c) c[k] = "[redacted]"; });
            return c;
          });
      totalRows += cleaned.length;
      files.push({ name: `${name}.csv`, csv: toCsv(cleaned), rows: cleaned.length });
    }

    await admin.from("data_export_audit").insert({
      actor_id: userId,
      tables,
      filters: { from, to, orgIds, cohortIds },
      include_sensitive: includeSensitive,
      row_count: totalRows,
      format: typeof body.format === "string" ? body.format.slice(0, 20) : "csv",
    });

    return new Response(JSON.stringify({ files, totalRows }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    return createErrorResponse(err, "export-data", 500, corsHeaders);
  }
});
