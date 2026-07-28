import { supabase } from '@/integrations/supabase/client';
import type { OrgReport } from '@/hooks/useOrganizationReport';
import type { InteractionReport } from '@/hooks/useInteractionReport';
import type { CaseNotesSummary } from '@/hooks/useCaseNotesSummary';

export interface AISummaryResult {
  headline: string;
  trends: string;
  improvements: string;
  risk_areas: string;
  next_steps: string;
  generated_at: string;
  model: string | null;
}

export interface AICaseNotesBlock {
  total: number;
  totalMinutes: number;
  byCategory: Array<{ label: string; count: number; totalMinutes: number }>;
  byContactType: Array<{ label: string; count: number }>;
  topStudents: Array<{ label: string; count: number }>;
  byAuthor: Array<{ label: string; count: number }>;
  recentSamples: Array<{
    date: string | null;
    student: string | null;
    author: string | null;
    category: string | null;
    contact_type: string | null;
    duration_minutes: number | null;
    title: string | null;
    snippet: string | null;
  }>;
}

export interface ReportAISummaryPayload {
  reportType: 'organization' | 'caseload' | 'student';
  scopeLabel: string;
  range: { from: string; to: string };
  summary: Record<string, number | string | null>;
  lifeSkills?: Array<{
    module: string;
    preAvg: number | null;
    postAvg: number | null;
    delta: number | null;
    n: number;
  }>;
  impactHighlights?: Record<string, number | string | null>;
  financials?: {
    count: number;
    requested: number;
    approved: number;
    pending: number;
    approvedCount: number;
    partiallyApprovedCount: number;
    deniedCount: number;
    pendingCount: number;
  };
  risks?: Array<{ key: string; label: string; severity: string; detail: string }>;
  actionItems?: Array<{ key: string; severity: string; text: string }>;
  caseNotes?: AICaseNotesBlock;
}

export async function fetchReportAiSummary(
  payload: ReportAISummaryPayload,
): Promise<AISummaryResult> {
  const { data, error } = await supabase.functions.invoke('report-ai-summary', {
    body: payload,
  });
  if (error) throw error;
  return data as AISummaryResult;
}

/** Convert a client CaseNotesSummary into a bounded AI-friendly block. */
export function buildCaseNotesForAi(
  s: CaseNotesSummary | null | undefined,
): AICaseNotesBlock | undefined {
  if (!s || s.total === 0) return undefined;
  const trim = (v: string | null | undefined, n = 240) =>
    v ? (v.length > n ? v.slice(0, n) + '…' : v) : null;
  return {
    total: s.total,
    totalMinutes: s.totalMinutes,
    byCategory: s.byCategory.slice(0, 10).map((g) => ({
      label: g.label,
      count: g.count,
      totalMinutes: g.totalMinutes,
    })),
    byContactType: s.byContactType.slice(0, 10).map((g) => ({
      label: g.label,
      count: g.count,
    })),
    topStudents: s.byStudent.slice(0, 10).map((g) => ({
      label: g.label,
      count: g.count,
    })),
    byAuthor: s.byAuthor.slice(0, 10).map((g) => ({
      label: g.label,
      count: g.count,
    })),
    recentSamples: s.rows.slice(0, 15).map((r) => ({
      date: r.contact_date || (r.created_at ? r.created_at.slice(0, 10) : null),
      student: r.student_name ?? null,
      author: r.author_name ?? null,
      category: r.note_type ?? null,
      contact_type: r.contact_type ?? null,
      duration_minutes: r.duration_minutes ?? null,
      title: r.title ?? null,
      snippet: trim(r.content),
    })),
  };
}


export function buildOrgAiPayload(
  data: OrgReport,
  caseNotes?: CaseNotesSummary | null,
): ReportAISummaryPayload {
  return {
    reportType: 'organization',
    scopeLabel: data.scopeLabel,
    range: data.range,
    summary: {
      students_in_scope: data.summary.studentCount,
      requests_opened: data.summary.requestsOpened,
      requests_resolved: data.summary.requestsResolved,
      unresolved: data.summary.unresolvedCount,
      open_emergencies: data.summary.emergencyOpen,
      avg_resolution_hours: data.summary.avgResolutionHours,
      notes_in_range: data.summary.notesInRange,
      appointments_in_range: data.summary.appointmentsInRange,
      appointments_kept: data.summary.appointmentsKept,
      attendance_rate:
        data.summary.attendanceRate == null
          ? null
          : Math.round(data.summary.attendanceRate * 100) / 100,
      check_ins_in_range: data.summary.checkInsInRange,
      surveys_sent: data.summary.surveysSent,
      surveys_completed: data.summary.surveysCompleted,
    },
    lifeSkills: data.lifeSkills.modules.map((m) => ({
      module: m.module.title,
      preAvg: m.preAvg,
      postAvg: m.postAvg,
      delta: m.delta,
      n: Math.max(m.preN, m.postN),
    })),
    impactHighlights: {
      certifications_earned: data.impactMetrics.certifications.earnedInRange,
      certifications_active: data.impactMetrics.certifications.active,
      certifications_expiring_soon: data.impactMetrics.certifications.expiringSoon,
      referrals_created: data.impactMetrics.referrals.createdInRange,
      referrals_clicked: data.impactMetrics.referrals.clickedInRange,
      plans_on_file: data.impactMetrics.milestones.plansOnFile,
      plans_stalled: data.impactMetrics.milestones.stalled,
      graduations: data.impactMetrics.milestones.graduationsInRange,
      employed: data.impactMetrics.employmentReadiness.employed,
      seeking: data.impactMetrics.employmentReadiness.seeking,
      m05_post_avg: data.impactMetrics.employmentReadiness.m05PostAvg,
      survey_response_rate: data.impactMetrics.surveys.responseRate,
      active_days: data.impactMetrics.engagement.activeDays,
      open_support_needs: data.impactMetrics.supportNeeds.openTotal,
    },
    financials: data.financials,
    risks: data.risks.map((r) => ({
      key: r.key,
      label: r.label,
      severity: r.severity,
      detail: r.detail,
    })),
    actionItems: data.actionItems.map((a) => ({
      key: a.key,
      severity: a.severity,
      text: a.text,
    })),
    caseNotes: buildCaseNotesForAi(caseNotes),
  };
}

export function buildCaseloadAiPayload(
  r: InteractionReport,
  caseNotes?: CaseNotesSummary | null,
): ReportAISummaryPayload {
  const scopeLabel = `${r.caseManager?.full_name || r.caseManager?.email || 'Case manager'} — ${r.summary.activeStudents} active students`;
  return {
    reportType: 'caseload',
    scopeLabel,
    range: r.range,
    summary: {
      active_students: r.summary.activeStudents,
      requests_opened: r.summary.requestsOpened,
      requests_resolved: r.summary.requestsResolved,
      avg_resolution_hours: r.summary.avgResolutionHours,
      unresolved: r.summary.unresolvedCount,
      emergency: r.summary.emergencyCount,
      messages_sent: r.contacts.messagesSent,
      messages_received: r.contacts.messagesReceived,
      distinct_students_contacted: r.contacts.distinctStudents,
      notes_added: r.notes.total,
      surveys_sent: r.surveys.sent,
      surveys_completed: r.surveys.completed,
      followups_scheduled: r.followUps.total,
      followups_completed: r.followUps.completed,
    },
    lifeSkills: r.lifeSkills.modules.map((m) => ({
      module: m.module.title,
      preAvg: m.preAvg,
      postAvg: m.postAvg,
      delta: m.delta,
      n: Math.max(m.preN, m.postN),
    })),
    impactHighlights: {
      certifications_earned: r.impactMetrics.certifications.earnedInRange,
      certifications_active: r.impactMetrics.certifications.active,
      certifications_expiring_soon: r.impactMetrics.certifications.expiringSoon,
      referrals_created: r.impactMetrics.referrals.createdInRange,
      referrals_clicked: r.impactMetrics.referrals.clickedInRange,
      plans_on_file: r.impactMetrics.milestones.plansOnFile,
      plans_stalled: r.impactMetrics.milestones.stalled,
      graduations: r.impactMetrics.milestones.graduationsInRange,
      employed: r.impactMetrics.employmentReadiness.employed,
      seeking: r.impactMetrics.employmentReadiness.seeking,
      m05_post_avg: r.impactMetrics.employmentReadiness.m05PostAvg,
    },
    financials: r.financials,
  };
}

/** Best-effort AI summary. Returns null on failure so exports still succeed. */
export async function tryFetchAiSummary(
  payload: ReportAISummaryPayload,
): Promise<AISummaryResult | null> {
  try {
    return await fetchReportAiSummary(payload);
  } catch (e) {
    console.warn('[reportAiSummary] fetch failed', e);
    return null;
  }
}
