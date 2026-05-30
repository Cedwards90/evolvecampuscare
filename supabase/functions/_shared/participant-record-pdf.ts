// deno-lint-ignore-file no-explicit-any
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import type { ValidationFinding } from "./participant-record-validation.ts";

const FOREST = rgb(0.020, 0.302, 0.231);
const SAGE = rgb(0.533, 0.663, 0.549);
const GREY = rgb(0.4, 0.4, 0.4);
const DARK = rgb(0.1, 0.1, 0.1);

export interface ParticipantRecordBundle {
  student: any;
  organization: any;
  assignment: any;
  caseManager: any;
  requests: any[];
  requestUpdates: any[];
  appointments: any[];
  fileNotes: any[];
  certifications: any[];
  intakeResponses: any[];
  postGradPlans: any[];
  checkIns: any[];
  outcomes: any;
  demographics: any;
  attachments: any[];
  messages: any[];
  transferEvents: any[];
  validation: ValidationFinding[];
  purpose: string;
  generatedBy: { name: string; email: string };
  transferContext?: {
    from_org_name: string | null;
    to_org_name: string | null;
    transfer_id: string;
    reason: string | null;
  } | null;
}

function sanitize(s: any): string {
  if (s == null) return "";
  return String(s)
    .replace(/[\u2192\u27A1]/g, "->")
    .replace(/[\u2190]/g, "<-")
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2022\u25CF\u25E6]/g, "*")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}

function fmt(d: string | null | undefined): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return String(d); }
}

export async function buildParticipantRecordPdf(b: ParticipantRecordBundle): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Participant Record — ${b.student?.full_name || b.student?.email || "Unknown"}`);
  pdf.setProducer("Evolve Foundation Campus Care");
  pdf.setCreator("Evolve Foundation");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const PW = 612, PH = 792, M = 50, MAX = PW - M * 2;
  let page = pdf.addPage([PW, PH]);
  let y = PH - M;

  const drawHeader = () => {
    page.drawRectangle({ x: 0, y: PH - 36, width: PW, height: 36, color: FOREST });
    page.drawText(sanitize("Evolve Foundation — Participant Record"), { x: M, y: PH - 23, size: 12, font: bold, color: rgb(1,1,1) });
    page.drawText(sanitize("CONFIDENTIAL"), { x: PW - M - 70, y: PH - 23, size: 9, font: bold, color: rgb(1,1,1) });
    y = PH - 50;
  };
  const newPage = () => { page = pdf.addPage([PW, PH]); y = PH - M; drawHeader(); };
  const ensure = (n: number) => { if (y - n < M + 30) newPage(); };

  const wrap = (s: string, f = font, sz = 10): string[] => {
    if (!s) return [""];
    const lines: string[] = [];
    for (const para of sanitize(s).split(/\n/)) {
      const words = para.split(/\s+/);
      let cur = "";
      for (const w of words) {
        const t = cur ? cur + " " + w : w;
        if (f.widthOfTextAtSize(t, sz) > MAX) { if (cur) lines.push(cur); cur = w; } else cur = t;
      }
      lines.push(cur);
    }
    return lines;
  };
  const text = (s: string, opts: { font?: any; size?: number; color?: any; indent?: number } = {}) => {
    const f = opts.font || font; const sz = opts.size || 10; const c = opts.color || DARK;
    for (const line of wrap(s, f, sz)) { ensure(sz + 4); page.drawText(sanitize(line), { x: M + (opts.indent || 0), y, size: sz, font: f, color: c }); y -= sz + 4; }
  };
  const heading = (s: string) => {
    ensure(28); y -= 6;
    page.drawText(sanitize(s), { x: M, y, size: 13, font: bold, color: FOREST });
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1, color: SAGE });
    y -= 12;
  };
  const kv = (k: string, v: string) => {
    ensure(16);
    page.drawText(sanitize(k), { x: M, y, size: 9, font: bold, color: GREY });
    const lines = wrap(v || "—", font, 10);
    page.drawText(sanitize(lines[0]), { x: M + 150, y, size: 10, font, color: DARK });
    y -= 14;
    for (let i = 1; i < lines.length; i++) { ensure(14); page.drawText(sanitize(lines[i]), { x: M + 150, y, size: 10, font, color: DARK }); y -= 14; }
  };

  drawHeader();

  // Title block
  ensure(60);
  text(b.student?.full_name || b.student?.email || "Participant Record", { font: bold, size: 18, color: FOREST });
  text(`Purpose: ${b.purpose.toUpperCase()}`, { size: 9, color: GREY });
  text(`Generated ${new Date().toLocaleString("en-US")} by ${b.generatedBy.name || b.generatedBy.email}`, { size: 8, color: GREY });

  if (b.transferContext) {
    heading("Transfer Context");
    kv("Transfer ID", b.transferContext.transfer_id);
    kv("From org", b.transferContext.from_org_name || "—");
    kv("To org", b.transferContext.to_org_name || "—");
    kv("Reason", b.transferContext.reason || "—");
  }

  // Participant
  heading("Participant");
  kv("Name", b.student?.full_name || "—");
  kv("Email", b.student?.email || "—");
  if (b.student?.phone) kv("Phone", b.student.phone);
  if (b.student?.student_id) kv("Student ID", b.student.student_id);
  if (b.organization) kv("Organization", b.organization.name);
  if (b.student?.cohort_start_date) kv("Cohort start", b.student.cohort_start_date);
  if (b.student?.graduation_date) kv("Graduation", b.student.graduation_date);
  if (b.student?.placement_date) kv("Placement", b.student.placement_date);

  // Assigned CM
  heading("Assigned Case Manager");
  if (b.caseManager) {
    kv("Name", b.caseManager.full_name || "—");
    kv("Email", b.caseManager.email || "—");
    kv("Assigned", fmt(b.assignment?.created_at));
  } else {
    text("Unassigned", { color: GREY });
  }

  // Validation
  heading(`Pre-Transfer Validation (${b.validation.length})`);
  if (!b.validation.length) text("No findings — records appear complete.", { color: GREY });
  else for (const f of b.validation) {
    const tag = f.severity === "warn" ? "[WARN] " : "[INFO] ";
    text(`${tag}${f.label}${f.count ? ` (${f.count})` : ""}`, { size: 10 });
  }

  // Demographics
  if (b.demographics) {
    heading("Demographics");
    kv("Consent", fmt(b.demographics.consent_at));
    if (b.demographics.age_range) kv("Age range", b.demographics.age_range);
    if (b.demographics.gender) kv("Gender", b.demographics.gender);
    if (b.demographics.ethnicity?.length) kv("Ethnicity", b.demographics.ethnicity.join(", "));
    if (b.demographics.veteran_status != null) kv("Veteran", b.demographics.veteran_status ? "Yes" : "No");
    if (b.demographics.disability_status != null) kv("Disability", b.demographics.disability_status ? "Yes" : "No");
  }

  // Outcomes
  if (b.outcomes) {
    heading("Participant Outcomes");
    kv("Program completed", b.outcomes.program_completed ? "Yes" : "No");
    if (b.outcomes.program_completion_date) kv("Completion date", b.outcomes.program_completion_date);
    if (b.outcomes.employment_status) kv("Employment", b.outcomes.employment_status);
    if (b.outcomes.employer) kv("Employer", b.outcomes.employer);
    if (b.outcomes.job_title) kv("Job title", b.outcomes.job_title);
    if (b.outcomes.placement_date) kv("Placement date", b.outcomes.placement_date);
    if (b.outcomes.hourly_wage != null) kv("Hourly wage", `$${b.outcomes.hourly_wage}`);
    const retention = ["30","60","90","180","365"].filter((d) => b.outcomes[`retention_${d}_met`]).join(", ");
    if (retention) kv("Retention milestones", `${retention} day(s)`);
  }

  // Intake
  heading(`Intake Responses (${b.intakeResponses.length})`);
  if (!b.intakeResponses.length) text("No intake responses on file.", { color: GREY });
  else for (const ir of b.intakeResponses) {
    ensure(20);
    page.drawText(sanitize(ir.section || "Section"), { x: M, y, size: 10, font: bold, color: FOREST });
    y -= 12;
    const summary = ir.responses ? Object.entries(ir.responses).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join("; ") : "—";
    text(summary, { size: 9, indent: 8 });
  }

  // Support requests
  heading(`Support Requests (${b.requests.length})`);
  if (!b.requests.length) text("No requests on file.", { color: GREY });
  else for (const r of b.requests) {
    ensure(40);
    page.drawText(sanitize(r.title), { x: M, y, size: 11, font: bold, color: FOREST });
    y -= 13;
    text(`${String(r.status).toUpperCase()} • ${String(r.priority).toUpperCase()} • ${String(r.category).replace(/_/g," ")} • created ${fmt(r.created_at)}`, { size: 9, color: GREY, indent: 8 });
    if (r.description) text(r.description, { size: 9, indent: 8 });
    if (r.resolved_at) text(`Resolved ${fmt(r.resolved_at)}`, { size: 9, color: GREY, indent: 8 });
    y -= 4;
  }

  // Case notes
  heading(`Case Notes (${b.fileNotes.length})`);
  if (!b.fileNotes.length) text("No case notes on file.", { color: GREY });
  else for (const n of b.fileNotes) {
    ensure(30);
    page.drawText(sanitize(`${fmt(n.created_at)} • ${n.note_type || "general"}`), { x: M, y, size: 9, font: bold, color: FOREST });
    y -= 12;
    if (n.title) text(n.title, { size: 10, indent: 8, font: bold });
    if (n.content) text(n.content, { size: 9, indent: 8 });
    y -= 4;
  }

  // Appointments
  heading(`Appointments (${b.appointments.length})`);
  if (!b.appointments.length) text("No appointments on file.", { color: GREY });
  else for (const a of b.appointments) {
    text(`• ${fmt(a.scheduled_at)} — ${a.title} (${a.status})`, { size: 10 });
  }

  // Certifications
  heading(`Certifications (${b.certifications.length})`);
  if (!b.certifications.length) text("No certifications on file.", { color: GREY });
  else for (const c of b.certifications) {
    const name = c.custom_name || c.catalog_name || "Certification";
    const expiry = c.expiration_date ? ` • expires ${c.expiration_date}` : "";
    text(`• ${name} — ${String(c.status).toUpperCase()}${expiry}`, { size: 10 });
    if (c.credential_id) text(`  Credential: ${c.credential_id}`, { size: 9, color: GREY });
  }

  // Check-ins
  if (b.checkIns.length) {
    heading(`Check-Ins (${b.checkIns.length})`);
    for (const c of b.checkIns.slice(0, 20)) {
      text(`• ${fmt(c.created_at)} — mood: ${c.mood ?? "—"}, progress: ${c.progress ?? "—"}`, { size: 9 });
    }
    if (b.checkIns.length > 20) text(`... and ${b.checkIns.length - 20} more`, { size: 9, color: GREY });
  }

  // Post-grad plan
  heading(`Post-Graduation Plans (${b.postGradPlans.length})`);
  if (!b.postGradPlans.length) text("No plan on file.", { color: GREY });
  else for (const p of b.postGradPlans.slice(0, 3)) {
    ensure(30);
    page.drawText(sanitize(`Plan dated ${fmt(p.created_at)}`), { x: M, y, size: 10, font: bold, color: FOREST });
    y -= 12;
    if (p.career_goals) text(`Career goals: ${p.career_goals}`, { size: 9, indent: 8 });
    if (p.education_goals) text(`Education goals: ${p.education_goals}`, { size: 9, indent: 8 });
    if (p.housing_plan) text(`Housing: ${p.housing_plan}`, { size: 9, indent: 8 });
  }

  // Attachments inventory
  heading(`Uploaded Documents (${b.attachments.length})`);
  if (!b.attachments.length) text("No attachments on file.", { color: GREY });
  else for (const a of b.attachments) {
    const sz = a.file_size ? ` (${(a.file_size / 1024).toFixed(1)} KB)` : "";
    text(`• ${a.file_name}${sz}`, { size: 9 });
  }

  // Messages (count only)
  heading("Communication History");
  text(`Total staff↔student messages: ${b.messages.length}`, { size: 10 });

  // Transfer chain-of-custody
  if (b.transferEvents.length) {
    heading(`Chain of Custody (${b.transferEvents.length})`);
    for (const e of b.transferEvents) {
      text(`${fmt(e.created_at)} — ${e.event_type.toUpperCase()} by ${e.actor_name || e.actor_id}`, { size: 9 });
    }
  }

  // Footer
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(sanitize(`Confidential — Page ${i + 1} of ${pages.length}`), { x: M, y: 24, size: 8, font, color: GREY });
    p.drawText(sanitize(`Participant: ${b.student?.user_id || ""}`), { x: PW - M - 220, y: 24, size: 8, font, color: GREY });
  });

  return await pdf.save();
}

export async function loadParticipantBundle(
  service: any,
  studentId: string,
  includeTypes: string[],
): Promise<Omit<ParticipantRecordBundle, "validation" | "purpose" | "generatedBy" | "transferContext">> {
  const wants = (t: string) => includeTypes.length === 0 || includeTypes.includes(t);

  const [profileRes, assignRes, certCatalogRes] = await Promise.all([
    service.from("profiles").select("*").eq("user_id", studentId).maybeSingle(),
    service.from("student_assignments").select("id, case_manager_id, created_at, notes").eq("student_id", studentId).maybeSingle(),
    service.from("certification_catalog").select("id, name"),
  ]);

  let organization = null;
  if (profileRes.data?.organization_id) {
    const { data } = await service.from("training_organizations").select("name").eq("id", profileRes.data.organization_id).maybeSingle();
    organization = data;
  }

  let caseManager = null;
  if (assignRes.data?.case_manager_id) {
    const { data } = await service.from("profiles").select("user_id, full_name, email").eq("user_id", assignRes.data.case_manager_id).maybeSingle();
    caseManager = data;
  }

  const catalogMap = new Map<string, string>();
  (certCatalogRes.data || []).forEach((c: any) => catalogMap.set(c.id, c.name));

  const [requestsRes, fileNotesRes, appointmentsRes, certsRes, intakeRes, planRes, checkInsRes, outcomesRes, demoRes, attachmentsRes, messagesRes] = await Promise.all([
    wants("requests") ? service.from("support_requests").select("*").eq("student_id", studentId).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    wants("case_notes") ? service.from("file_notes").select("*").eq("student_id", studentId).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    wants("appointments") ? service.from("appointments").select("*").eq("student_id", studentId).order("scheduled_at", { ascending: false }) : Promise.resolve({ data: [] }),
    wants("certifications") ? service.from("student_certifications").select("*").eq("student_id", studentId).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    wants("intake") ? service.from("intake_responses").select("*").eq("student_id", studentId) : Promise.resolve({ data: [] }),
    wants("post_grad") ? service.from("post_graduation_plans").select("*").eq("student_id", studentId).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    wants("checkins") ? service.from("student_checkins").select("*").eq("student_id", studentId).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    wants("outcomes") ? service.from("participant_outcomes").select("*").eq("student_id", studentId).maybeSingle() : Promise.resolve({ data: null }),
    wants("demographics") ? service.from("participant_demographics").select("*").eq("student_id", studentId).maybeSingle() : Promise.resolve({ data: null }),
    Promise.resolve({ data: [] }), // attachments resolved after requests
    wants("messages") ? service.from("staff_messages").select("id, sender_id, recipient_id, body, created_at").eq("student_id", studentId).order("created_at", { ascending: true }).limit(2000) : Promise.resolve({ data: [] }),
  ]);

  // Attachments — need request_ids
  let attachments: any[] = [];
  const reqIds = ((requestsRes.data as any[]) || []).map((r) => r.id);
  if (wants("attachments") && reqIds.length) {
    const { data } = await service.from("request_attachments").select("*").in("request_id", reqIds);
    attachments = data || [];
  }

  // Map cert catalog name onto each cert
  const certifications = ((certsRes.data as any[]) || []).map((c) => ({ ...c, catalog_name: c.catalog_id ? catalogMap.get(c.catalog_id) || null : null }));

  // Request updates
  let requestUpdates: any[] = [];
  if (reqIds.length) {
    const { data } = await service.from("request_updates").select("*").in("request_id", reqIds).order("created_at", { ascending: true });
    requestUpdates = data || [];
  }

  return {
    student: profileRes.data,
    organization,
    assignment: assignRes.data,
    caseManager,
    requests: (requestsRes.data as any[]) || [],
    requestUpdates,
    appointments: (appointmentsRes.data as any[]) || [],
    fileNotes: (fileNotesRes.data as any[]) || [],
    certifications,
    intakeResponses: (intakeRes.data as any[]) || [],
    postGradPlans: (planRes.data as any[]) || [],
    checkIns: (checkInsRes.data as any[]) || [],
    outcomes: outcomesRes.data,
    demographics: demoRes.data,
    attachments,
    messages: (messagesRes.data as any[]) || [],
    transferEvents: [],
  };
}
