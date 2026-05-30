// deno-lint-ignore-file no-explicit-any
// Validation: identifies missing or incomplete records for a participant.
// Returns an array of findings — severity is informational; never blocks.

export interface ValidationFinding {
  key: string;
  severity: "warn" | "info";
  label: string;
  count?: number;
  link?: string;
}

export async function runParticipantValidation(
  service: any,
  studentId: string,
): Promise<ValidationFinding[]> {
  const findings: ValidationFinding[] = [];

  const [
    profileRes,
    ndaRes,
    intakeRes,
    requestsRes,
    assignmentRes,
    certsRes,
    outcomesRes,
    demoRes,
    planRes,
    fileNotesRes,
  ] = await Promise.all([
    service.from("profiles").select("user_id, full_name, phone, organization_id").eq("user_id", studentId).maybeSingle(),
    service.from("nda_acceptances").select("id").eq("user_id", studentId).limit(1),
    service.from("student_files").select("intake_completed_at").eq("student_id", studentId).maybeSingle(),
    service.from("support_requests").select("id, status, is_emergency").eq("student_id", studentId),
    service.from("student_assignments").select("id").eq("student_id", studentId).limit(1),
    service.from("student_certifications").select("id, status, expiration_date").eq("student_id", studentId),
    service.from("participant_outcomes").select("id, program_completed").eq("student_id", studentId).maybeSingle(),
    service.from("participant_demographics").select("consent_at").eq("student_id", studentId).maybeSingle(),
    service.from("post_graduation_plans").select("id").eq("student_id", studentId).limit(1),
    service.from("file_notes").select("id").eq("student_id", studentId).limit(1),
  ]);

  if (!profileRes.data?.full_name) findings.push({ key: "profile_name", severity: "warn", label: "Profile name not set" });
  if (!profileRes.data?.phone) findings.push({ key: "profile_phone", severity: "info", label: "No phone on file" });

  if (!ndaRes.data || (ndaRes.data as any[]).length === 0) {
    findings.push({ key: "nda_unsigned", severity: "warn", label: "NDA never accepted" });
  }

  if (!intakeRes.data?.intake_completed_at) {
    findings.push({ key: "intake_incomplete", severity: "warn", label: "Intake survey incomplete" });
  }

  if (!assignmentRes.data || (assignmentRes.data as any[]).length === 0) {
    findings.push({ key: "no_case_manager", severity: "warn", label: "No assigned case manager" });
  }

  const reqs = (requestsRes.data || []) as any[];
  const openEmergencies = reqs.filter((r) => r.is_emergency && ["submitted", "in_progress", "escalated"].includes(r.status));
  const openReqs = reqs.filter((r) => ["submitted", "in_progress", "escalated"].includes(r.status));
  if (openEmergencies.length) {
    findings.push({ key: "open_emergencies", severity: "warn", label: "Open emergency requests", count: openEmergencies.length });
  }
  if (openReqs.length) {
    findings.push({ key: "open_requests", severity: "warn", label: "Unresolved support requests", count: openReqs.length });
  }

  const today = new Date().toISOString().slice(0, 10);
  const certs = (certsRes.data || []) as any[];
  const expired = certs.filter((c) => c.expiration_date && c.expiration_date < today && c.status !== "revoked");
  if (expired.length) findings.push({ key: "expired_certifications", severity: "warn", label: "Expired certifications", count: expired.length });

  const soonCutoff = new Date(); soonCutoff.setDate(soonCutoff.getDate() + 30);
  const soon = certs.filter((c) => c.expiration_date && c.expiration_date >= today && c.expiration_date <= soonCutoff.toISOString().slice(0, 10));
  if (soon.length) findings.push({ key: "expiring_soon", severity: "info", label: "Certifications expiring within 30 days", count: soon.length });

  if (!outcomesRes.data) findings.push({ key: "missing_outcomes", severity: "info", label: "No participant outcomes recorded" });
  if (!demoRes.data?.consent_at) findings.push({ key: "missing_demographics", severity: "info", label: "Demographics consent not on file" });
  if (!planRes.data || (planRes.data as any[]).length === 0) findings.push({ key: "no_post_grad_plan", severity: "info", label: "No post-graduation plan" });
  if (!fileNotesRes.data || (fileNotesRes.data as any[]).length === 0) findings.push({ key: "no_case_notes", severity: "info", label: "No case notes on file" });

  return findings;
}
