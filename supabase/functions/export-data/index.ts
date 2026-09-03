// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, createErrorResponse } from "../_shared/security.ts";

const PAGE = 1000;
const EXPORT_CHUNK_ROWS = 250;
const MAX_CHUNK_BYTES = 3_000_000;

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
    const ALLOWED_ACTIONS = new Set(["manifest", "export", "flat"]);
    const action: string = ALLOWED_ACTIONS.has(body.action) ? body.action : "manifest";

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

    const fetchAll = async (table: string, select: string) => {
      const out: any[] = [];
      for (let page = 0; ; page++) {
        const { data, error } = await admin.from(table).select(select).range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) { console.error(`fetchAll ${table}:`, error.message); break; }
        out.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return out;
    };

    if (action === "flat") {
      const [profiles, orgs, cohorts, roleRows, assignments] = await Promise.all([
        fetchAll("profiles", "*"),
        fetchAll("training_organizations", "id,name"),
        fetchAll("cohorts", "id,name,graduated_at,organization_id"),
        fetchAll("user_roles", "user_id,role"),
        fetchAll("student_assignments", "student_id,case_manager_id"),
      ]);
      const pMap = new Map(profiles.map((p: any) => [p.user_id, p]));
      const oMap = new Map(orgs.map((o: any) => [o.id, o.name]));
      const cMap = new Map(cohorts.map((c: any) => [c.id, c]));
      const studentIds = new Set(roleRows.filter((r: any) => r.role === "student").map((r: any) => r.user_id));

      const inScope = (uid: string | null) => !uid || !scopedUserIds || scopedUserIds.includes(uid);

      let requests = await fetchAll("support_requests", "*");
      if (from) requests = requests.filter((r: any) => r.created_at >= from);
      if (to) requests = requests.filter((r: any) => r.created_at <= to);
      requests = requests.filter((r: any) => inScope(r.student_id));

      const requestRows = requests
        .sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1))
        .map((r: any) => {
          const sp: any = pMap.get(r.student_id) ?? {};
          const cm: any = r.assigned_case_manager_id ? pMap.get(r.assigned_case_manager_id) ?? {} : {};
          const coh: any = sp.cohort_id ? cMap.get(sp.cohort_id) ?? {} : {};
          const hours = r.resolved_at
            ? Math.round(((new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) / 3600000) * 100) / 100
            : "";
          return {
            request_id: r.id, created_at: r.created_at, updated_at: r.updated_at,
            resolved_at: r.resolved_at ?? "", escalated_at: r.escalated_at ?? "",
            status: r.status, priority: r.priority, category: r.category, is_emergency: r.is_emergency,
            title: r.title, description: includeSensitive ? r.description : "[redacted]",
            requested_amount: r.requested_amount ?? "", approved_amount: r.approved_amount ?? "",
            approval_status: r.approval_status ?? "", approval_decided_at: r.approval_decided_at ?? "",
            funding_purpose: r.funding_purpose ?? "", resolution_hours: hours,
            student_name: sp.full_name ?? "", student_email: sp.email ?? "",
            student_phone: includeSensitive ? sp.phone ?? "" : "[redacted]",
            student_dob: includeSensitive ? sp.date_of_birth ?? "" : "[redacted]",
            organization: sp.organization_id ? oMap.get(sp.organization_id) ?? "" : "",
            cohort: coh.name ?? "",
            case_manager: cm.full_name ?? "", case_manager_email: cm.email ?? "",
            student_id: r.student_id, assigned_case_manager_id: r.assigned_case_manager_id ?? "",
          };
        });

      const [checkins, notes, certs, surveyResponses, intake, plans] = await Promise.all([
        fetchAll("student_checkins", "student_id"),
        fetchAll("file_notes", "student_id"),
        fetchAll("student_certifications", "student_id"),
        fetchAll("impact_survey_responses", "student_id"),
        fetchAll("intake_responses", "student_id"),
        fetchAll("post_graduation_plans", "student_id"),
      ]);
      const tally = (rows: any[]) => {
        const m = new Map<string, number>();
        rows.forEach((r) => m.set(r.student_id, (m.get(r.student_id) ?? 0) + 1));
        return m;
      };
      const tCheck = tally(checkins), tNotes = tally(notes), tCerts = tally(certs),
        tSurvey = tally(surveyResponses), tIntake = tally(intake), tPlans = tally(plans);
      const cmByStudent = new Map<string, string[]>();
      assignments.forEach((a: any) => {
        const cmName = (pMap.get(a.case_manager_id) as any)?.full_name;
        if (!cmName) return;
        cmByStudent.set(a.student_id, [...(cmByStudent.get(a.student_id) ?? []), cmName]);
      });
      const reqByStudent = new Map<string, any[]>();
      requests.forEach((r: any) => reqByStudent.set(r.student_id, [...(reqByStudent.get(r.student_id) ?? []), r]));

      const studentRows = profiles
        .filter((p: any) => studentIds.has(p.user_id) && inScope(p.user_id))
        .sort((a: any, b: any) => String(a.full_name ?? "").localeCompare(String(b.full_name ?? "")))
        .map((p: any) => {
          const coh: any = p.cohort_id ? cMap.get(p.cohort_id) ?? {} : {};
          const mine = reqByStudent.get(p.user_id) ?? [];
          const age = p.date_of_birth
            ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / 31557600000)
            : "";
          const s = (v: unknown) => (includeSensitive ? v ?? "" : "[redacted]");
          return {
            student_user_id: p.user_id, student_number: p.student_id ?? "", full_name: p.full_name ?? "",
            preferred_name: p.preferred_name ?? "", legal_first_name: s(p.legal_first_name), legal_last_name: s(p.legal_last_name),
            email: p.email ?? "", phone: s(p.phone), date_of_birth: s(p.date_of_birth), age: includeSensitive ? age : "[redacted]",
            address_line1: s(p.address_line1), address_line2: s(p.address_line2), city: s(p.city),
            state_region: s(p.state_region), postal_code: s(p.postal_code), country: s(p.country),
            preferred_language: p.preferred_language ?? "", department: p.department ?? "",
            organization: p.organization_id ? oMap.get(p.organization_id) ?? "" : "",
            cohort: coh.name ?? "", cohort_graduated_at: coh.graduated_at ?? "",
            cohort_start_date: p.cohort_start_date ?? "", graduation_date: p.graduation_date ?? "",
            placement_date: p.placement_date ?? "", year_of_study: p.year_of_study ?? "",
            account_created_at: p.created_at, onboarding_completed_at: p.onboarding_completed_at ?? "",
            deactivated_at: p.deactivated_at ?? "",
            case_managers: (cmByStudent.get(p.user_id) ?? []).join("; "),
            requests_total: mine.length,
            requests_resolved: mine.filter((r: any) => r.status === "resolved").length,
            total_approved_amount: mine.reduce((sum: number, r: any) => sum + Number(r.approved_amount ?? 0), 0),
            checkins: tCheck.get(p.user_id) ?? 0,
            case_notes: tNotes.get(p.user_id) ?? 0,
            certifications: tCerts.get(p.user_id) ?? 0,
            survey_responses: tSurvey.get(p.user_id) ?? 0,
            intake_responses: tIntake.get(p.user_id) ?? 0,
            post_grad_plans: tPlans.get(p.user_id) ?? 0,
          };
        });

      await admin.from("data_export_audit").insert({
        actor_id: userId,
        tables: ["requests_full", "students_full"],
        filters: { from, to, orgIds, cohortIds },
        include_sensitive: includeSensitive,
        row_count: requestRows.length + studentRows.length,
        format: "flat",
      });

      return new Response(JSON.stringify({
        files: [
          { name: "requests_full.csv", csv: toCsv(requestRows), rows: requestRows.length },
          { name: "students_full.csv", csv: toCsv(studentRows), rows: studentRows.length },
        ],
        totalRows: requestRows.length + studentRows.length,
      }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }


    // ---- export ----
    const requested: string[] = Array.isArray(body.tables) ? body.tables.filter((t: any) => typeof t === "string") : [];
    const tables = requested.filter(allowed);
    if (!tables.length) {
      return new Response(JSON.stringify({ error: "No exportable tables selected" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const offset = Number.isInteger(body.offset) && body.offset >= 0 ? Math.min(body.offset, 100000) : 0;
    const files: { name: string; csv: string; rows: number }[] = [];
    let totalRows = 0;
    const truncated: string[] = [];
    let nextOffset: number | null = null;
    let complete = true;

    for (const name of tables) {
      const def = TABLES[name];
      const { data, error } = await buildQuery(name, "*").range(offset, offset + EXPORT_CHUNK_ROWS - 1);
      if (error) {
        console.error(`export ${name}:`, error.message);
        return new Response(
          JSON.stringify({ error: `Could not read "${name}": ${error.message}` }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
      const rows: any[] = data ?? [];
      const cleaned = includeSensitive || !def.sensitiveColumns?.length
        ? rows
        : rows.map((r) => {
            const c: any = { ...r };
            def.sensitiveColumns!.forEach((k) => { if (k in c) c[k] = "[redacted]"; });
            return c;
          });
      let included = cleaned.length;
      let csv = toCsv(cleaned);
      while (included > 1 && new TextEncoder().encode(csv).length > MAX_CHUNK_BYTES) {
        included = Math.max(1, Math.floor(included / 2));
        csv = toCsv(cleaned.slice(0, included));
      }
      if (included === 1 && new TextEncoder().encode(csv).length > MAX_CHUNK_BYTES) {
        return new Response(
          JSON.stringify({ error: `A row in "${name}" is too large to export safely.` }),
          { status: 413, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
      totalRows += included;
      files.push({ name: `${name}.csv`, csv, rows: included });
      complete = rows.length < EXPORT_CHUNK_ROWS && included === rows.length;
      nextOffset = complete ? null : offset + included;
    }


    await admin.from("data_export_audit").insert({
      actor_id: userId,
      tables,
      filters: { from, to, orgIds, cohortIds },
      include_sensitive: includeSensitive,
      row_count: totalRows,
      format: typeof body.format === "string" ? body.format.slice(0, 20) : "csv",
    });

    return new Response(JSON.stringify({ files, totalRows, truncated, nextOffset, complete }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    return createErrorResponse(err, "export-data", 500, corsHeaders);
  }
});
