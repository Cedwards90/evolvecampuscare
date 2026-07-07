/**
 * Deterministic rule engine for the Student Progress Report.
 *
 * No AI here. Each rule maps real DB rows -> a fired RiskIndicator
 * and (where applicable) a paired ActionItem.
 *
 * Used by useStudentProgressReport and the export library.
 */
import type { SupportRequest, RequestUpdate, Appointment } from '@/types/database';

export type RiskSeverity = 'high' | 'medium' | 'low';

export interface RiskIndicator {
  key: string;
  label: string;
  severity: RiskSeverity;
  detail: string;
}

export interface ActionItem {
  key: string;
  text: string;
  severity: RiskSeverity;
}

export interface CheckInLite {
  id: string;
  created_at: string;
  mood_rating: number;
  progress_rating: number;
  blockers: string | null;
  wins: string | null;
}

export interface SurveyInvitationLite {
  id: string;
  survey_type: string;
  created_at: string;
  completed_at: string | null;
}

export interface ExpiringCertLite {
  id: string;
  name: string;
  daysUntilExpiration: number;
}

export interface StalledPlanLite {
  id: string;
  updatedAt: string;
}

export interface RuleInputs {
  rangeFrom: Date;
  rangeTo: Date;
  unresolvedRequests: SupportRequest[]; // currently unresolved (independent of range)
  statusChangesAll: RequestUpdate[]; // recent status changes (any time)
  notesInRangeCount: number;
  messagesInRangeCount: number;
  appointmentsInRange: Appointment[];
  checkInsLatest: CheckInLite[]; // latest first, up to 3
  surveys: SurveyInvitationLite[]; // surveys sent to this student (any time)
  /** Optional: per-module post - pre confidence delta. If any module posts < pre by >= 0.5, flag. */
  lifeSkillsDeltas?: Array<{ moduleTitle: string; delta: number | null }>;
  /** Optional: attendance = kept / scheduled non-cancelled appointments in range (0-1). */
  attendanceRate?: number | null;
  /** Optional: date of the student's most recent check-in (any time). */
  lastCheckInAt?: string | null;
  /** Optional: certifications expiring within 30 days. */
  expiringCerts?: ExpiringCertLite[];
  /** Optional: post-grad plans whose updated_at is older than 30 days. */
  stalledPlans?: StalledPlanLite[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function ageInDays(iso: string, now = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / DAY_MS);
}

export function evaluateRisks(inputs: RuleInputs): RiskIndicator[] {
  const risks: RiskIndicator[] = [];
  const now = Date.now();

  // 1. Open emergency request
  const openEmergencies = inputs.unresolvedRequests.filter((r) => r.is_emergency);
  if (openEmergencies.length > 0) {
    risks.push({
      key: 'open_emergency',
      label: 'Open emergency request',
      severity: 'high',
      detail: `${openEmergencies.length} unresolved emergency request${openEmergencies.length > 1 ? 's' : ''}.`,
    });
  }

  // 2. Stale unresolved request (> 14 days old, no update in last 7 days)
  const stale = inputs.unresolvedRequests.filter((r) => {
    if (ageInDays(r.created_at, now) <= 14) return false;
    const updates = inputs.statusChangesAll.filter((u) => u.request_id === r.id);
    if (updates.length === 0) return true;
    const lastUpdateAge = Math.min(
      ...updates.map((u) => ageInDays(u.created_at, now)),
    );
    return lastUpdateAge > 7;
  });
  if (stale.length > 0) {
    risks.push({
      key: 'stale_unresolved',
      label: 'Stale unresolved request',
      severity: 'medium',
      detail: `${stale.length} unresolved request${stale.length > 1 ? 's' : ''} older than 14 days with no update in the last 7 days.`,
    });
  }

  // 3. No contact in window (when there are unresolved items)
  const contactsInRange =
    inputs.notesInRangeCount + inputs.messagesInRangeCount + inputs.appointmentsInRange.length;
  if (inputs.unresolvedRequests.length > 0 && contactsInRange === 0) {
    risks.push({
      key: 'no_contact',
      label: 'No contact in this period',
      severity: 'medium',
      detail:
        'No notes, messages, or appointments logged for this student in the selected range, despite open requests.',
    });
  }

  // 4 & 5. Declining mood / progress
  if (inputs.checkInsLatest.length >= 2) {
    const [latest, prev] = inputs.checkInsLatest;
    if (latest.mood_rating < prev.mood_rating && latest.mood_rating <= 2) {
      risks.push({
        key: 'declining_mood',
        label: 'Declining mood',
        severity: 'high',
        detail: `Mood dropped from ${prev.mood_rating} to ${latest.mood_rating} in the most recent check-in.`,
      });
    }
    if (latest.progress_rating < prev.progress_rating && latest.progress_rating <= 2) {
      risks.push({
        key: 'declining_progress',
        label: 'Declining progress',
        severity: 'medium',
        detail: `Progress rating dropped from ${prev.progress_rating} to ${latest.progress_rating} in the most recent check-in.`,
      });
    }
  }

  // 6. Reported blockers in latest check-in
  const latestCheckIn = inputs.checkInsLatest[0];
  if (latestCheckIn?.blockers && latestCheckIn.blockers.trim().length > 0) {
    risks.push({
      key: 'reported_blockers',
      label: 'Reported blockers',
      severity: 'medium',
      detail: `Student reported blockers in their most recent check-in (${new Date(latestCheckIn.created_at).toLocaleDateString()}).`,
    });
  }

  // 7. Missed survey
  const missedSurveys = inputs.surveys.filter(
    (s) => !s.completed_at && ageInDays(s.created_at, now) > 7,
  );
  if (missedSurveys.length > 0) {
    risks.push({
      key: 'missed_survey',
      label: 'Missed survey',
      severity: 'low',
      detail: `${missedSurveys.length} survey invitation${missedSurveys.length > 1 ? 's' : ''} sent more than 7 days ago without a response.`,
    });
  }



  // 8. Life-skills regression: any module where post < pre by >= 0.5
  const regressions = (inputs.lifeSkillsDeltas || []).filter(
    (m) => m.delta != null && m.delta <= -0.5,
  );
  if (regressions.length > 0) {
    risks.push({
      key: 'lifeskills_regression',
      label: 'Life Skills confidence regression',
      severity: 'medium',
      detail: `Post confidence dropped below pre by ≥0.5 in: ${regressions
        .map((r) => `${r.moduleTitle} (${r.delta!.toFixed(2)})`)
        .join(', ')}.`,
    });
  }

  // 9. Low attendance rate in range
  if (
    inputs.attendanceRate != null &&
    inputs.appointmentsInRange.length >= 2 &&
    inputs.attendanceRate < 0.6
  ) {
    risks.push({
      key: 'low_attendance',
      label: 'Low attendance',
      severity: 'medium',
      detail: `${Math.round(inputs.attendanceRate * 100)}% of scheduled meetings were kept in the selected range.`,
    });
  }

  // 10. No check-in in the last 21 days
  if (inputs.lastCheckInAt) {
    const days = ageInDays(inputs.lastCheckInAt, now);
    if (days > 21) {
      risks.push({
        key: 'no_recent_checkin',
        label: 'No recent check-in',
        severity: 'low',
        detail: `Last check-in was ${days} days ago (expected cadence is 3 weeks).`,
      });
    }
  }

  // 11. Certification expiring within 30 days
  if (inputs.expiringCerts && inputs.expiringCerts.length > 0) {
    risks.push({
      key: 'cert_expiring',
      label: 'Certification expiring soon',
      severity: 'low',
      detail: inputs.expiringCerts
        .slice(0, 3)
        .map((c) => `${c.name} (${c.daysUntilExpiration}d)`)
        .join(', '),
    });
  }

  // 12. Post-grad milestone stalled
  if (inputs.stalledPlans && inputs.stalledPlans.length > 0) {
    risks.push({
      key: 'plan_stalled',
      label: 'Post-graduation plan stalled',
      severity: 'medium',
      detail: `${inputs.stalledPlans.length} plan${inputs.stalledPlans.length > 1 ? 's' : ''} not updated in 30+ days.`,
    });
  }

  return risks;
}


/**
 * Map fired risks to concrete recommended action items.
 * Returns a sensible default when no risks are present (no AI, no fabrication).
 */
export function deriveActionItems(risks: RiskIndicator[]): ActionItem[] {
  if (risks.length === 0) {
    return [
      {
        key: 'all_clear',
        text: 'No immediate action items based on current data.',
        severity: 'low',
      },
    ];
  }

  const map: Record<string, string> = {
    open_emergency: 'Contact this student today and document the outcome in case notes.',
    stale_unresolved:
      'Post a status update on the affected request, or reassign if it can no longer be progressed.',
    no_contact: 'Schedule a check-in meeting or send a message this week.',
    declining_mood:
      'Review with the student during the next 1:1; consider a wellness or counselling referral.',
    declining_progress:
      'Identify the blocker with the student and adjust their action plan accordingly.',
    reported_blockers:
      'Address the blockers raised in the latest check-in directly with the student.',
    missed_survey: 'Resend the survey invitation or follow up by message.',
    lifeskills_regression:
      'Re-teach or offer 1:1 coaching on the regressed module topic before the next assessment.',
    low_attendance:
      'Check in about scheduling barriers and consider changing the meeting cadence or time.',
    no_recent_checkin:
      'Send the 3-week check-in prompt and follow up if not completed within 48 hours.',
    cert_expiring:
      'Notify the student about upcoming certification expiry and plan renewal steps.',
    plan_stalled:
      'Review the post-graduation plan with the student and update milestones this week.',
  };

  return risks.map((r) => ({
    key: r.key,
    text: map[r.key] || `Follow up on: ${r.label}.`,
    severity: r.severity,
  }));
}

/**
 * Insufficient-data threshold for the AI summary section.
 * The deterministic data is always shown; this only governs whether we even call the AI.
 */
export function hasSufficientEvidenceForAI(opts: {
  notesInRangeCount: number;
  checkInsInRangeCount: number;
  statusChangesInRangeCount: number;
  appointmentsInRangeCount: number;
}): boolean {
  return (
    opts.notesInRangeCount >= 2 ||
    opts.checkInsInRangeCount >= 1 ||
    opts.statusChangesInRangeCount >= 1 ||
    opts.appointmentsInRangeCount >= 1
  );
}
