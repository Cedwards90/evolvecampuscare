/**
 * Organization Report — aggregates across a filtered pool of students.
 *
 * All metrics are computed from real records (no fabrication). Empty scopes
 * return an empty-but-valid shape; the UI renders "No data on file" per
 * section.
 *
 * RLS + scoping:
 *   - Base pool comes from `useReportStudentFilters` (already scoped by role:
 *     admin → all, org_admin → their orgs, case_manager → their caseload).
 *   - Callers should ideally further constrain via GlobalFilters before
 *     passing student IDs in.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  computeLifeSkillsProgress,
  emptyLifeSkillsResult,
  type LifeSkillsProgressResult,
} from '@/hooks/useLifeSkillsProgress';
import type { ImpactMetrics } from '@/components/reports/ImpactMetricsBlock';
import type { RiskIndicator, ActionItem } from '@/lib/studentProgressRules';

export interface OrgReportSummary {
  studentCount: number;
  requestsOpened: number;
  requestsResolved: number;
  unresolvedCount: number;
  emergencyOpen: number;
  avgResolutionHours: number;
  notesInRange: number;
  appointmentsInRange: number;
  appointmentsKept: number;
  attendanceRate: number | null;
  checkInsInRange: number;
  surveysSent: number;
  surveysCompleted: number;
}

export interface OrgReport {
  range: { from: string; to: string };
  generatedAt: string;
  scopeLabel: string;
  summary: OrgReportSummary;
  financials: {
    count: number;
    requested: number;
    approved: number;
    pending: number;
    approvedCount: number;
    partiallyApprovedCount: number;
    deniedCount: number;
    pendingCount: number;
  };
  lifeSkills: LifeSkillsProgressResult;
  impactMetrics: ImpactMetrics;
  risks: RiskIndicator[];
  actionItems: ActionItem[];
  topUnresolved: Array<{
    id: string;
    title: string;
    student_name: string | null;
    priority: string;
    status: string;
    ageDays: number;
    is_emergency: boolean;
  }>;
}

interface Params {
  studentIds: string[];
  studentNameById: Record<string, string | null>;
  from: Date;
  to: Date;
  enabled?: boolean;
  scopeLabel?: string;
}

export function useOrganizationReport({
  studentIds,
  studentNameById,
  from,
  to,
  enabled = true,
  scopeLabel,
}: Params) {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const idsKey = studentIds.slice().sort().join(',');

  return useQuery({
    queryKey: ['org-report', idsKey, fromIso, toIso],
    enabled: enabled && studentIds.length >= 0,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<OrgReport> => {
      const emptyReport: OrgReport = {
        range: { from: fromIso, to: toIso },
        generatedAt: new Date().toISOString(),
        scopeLabel: scopeLabel || `${studentIds.length} student${studentIds.length === 1 ? '' : 's'} in scope`,
        summary: {
          studentCount: studentIds.length,
          requestsOpened: 0,
          requestsResolved: 0,
          unresolvedCount: 0,
          emergencyOpen: 0,
          avgResolutionHours: 0,
          notesInRange: 0,
          appointmentsInRange: 0,
          appointmentsKept: 0,
          attendanceRate: null,
          checkInsInRange: 0,
          surveysSent: 0,
          surveysCompleted: 0,
        },
        lifeSkills: emptyLifeSkillsResult(),
        impactMetrics: {
          scopeLabel: scopeLabel || '0 students',
          noteBreakdown: [],
          lastNoteAt: null,
          surveys: { sent: 0, completed: 0, responseRate: null },
          certifications: { earnedInRange: 0, active: 0, expiringSoon: 0 },
          supportNeeds: { openTotal: 0, byCategory: [], byPriority: [] },
          referrals: { createdInRange: 0, clickedInRange: 0 },
          milestones: { plansOnFile: 0, graduationsInRange: 0, stalled: 0 },
          engagement: { messagesSent: 0, messagesReceived: 0, activeDays: 0 },
          employmentReadiness: { employed: 0, seeking: 0, unknown: 0, m05PostAvg: null },
        },
        risks: [],
        actionItems: [],
        topUnresolved: [],
      };
      if (studentIds.length === 0) return emptyReport;

      const [
        reqsRes,
        notesInRangeRes,
        notesAllRes,
        appointmentsRes,
        checkInsRes,
        surveysRes,
        lifeSkillsRes,
        certsRes,
        referralsRes,
        plansRes,
        outcomesRes,
        messagesSentRes,
        messagesReceivedRes,
      ] = await Promise.all([
        supabase.from('support_requests').select('*').in('student_id', studentIds),
        supabase
          .from('file_notes')
          .select('note_type, created_at')
          .in('student_id', studentIds)
          .gte('created_at', fromIso)
          .lte('created_at', toIso),
        supabase
          .from('file_notes')
          .select('note_type, created_at')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('appointments')
          .select('id, status, scheduled_at, student_id')
          .in('student_id', studentIds)
          .gte('scheduled_at', fromIso)
          .lte('scheduled_at', toIso),
        supabase
          .from('student_checkins')
          .select('id, created_at')
          .in('student_id', studentIds)
          .gte('created_at', fromIso)
          .lte('created_at', toIso),
        supabase
          .from('survey_invitations')
          .select('id, completed_at, created_at')
          .in('student_id', studentIds)
          .gte('created_at', fromIso)
          .lte('created_at', toIso),
        supabase
          .from('impact_survey_responses')
          .select('score_summary, impact_survey_templates!inner(slug)')
          .in('student_id', studentIds),
        supabase
          .from('student_certifications')
          .select('status, completion_date, expiration_date')
          .in('student_id', studentIds),
        supabase
          .from('resource_recommendations')
          .select('id, created_at, clicked_at')
          .in('student_id', studentIds)
          .gte('created_at', fromIso)
          .lte('created_at', toIso),
        supabase
          .from('post_graduation_plans')
          .select('id, updated_at, graduation_date, student_id')
          .in('student_id', studentIds),
        supabase
          .from('participant_outcomes')
          .select('employment_status, program_completion_date')
          .in('student_id', studentIds),
        supabase
          .from('staff_messages')
          .select('id, created_at')
          .in('sender_id', studentIds)
          .gte('created_at', fromIso)
          .lte('created_at', toIso),
        supabase
          .from('staff_messages')
          .select('id, created_at')
          .in('recipient_id', studentIds)
          .gte('created_at', fromIso)
          .lte('created_at', toIso),
      ]);

      const errors = [
        reqsRes.error,
        notesInRangeRes.error,
        notesAllRes.error,
        appointmentsRes.error,
        checkInsRes.error,
        surveysRes.error,
        lifeSkillsRes.error,
        certsRes.error,
        referralsRes.error,
        plansRes.error,
        outcomesRes.error,
        messagesSentRes.error,
        messagesReceivedRes.error,
      ].filter(Boolean);
      if (errors.length) throw errors[0];

      const allReqs = (reqsRes.data || []) as Array<{
        id: string;
        student_id: string;
        title: string;
        priority: string;
        status: string;
        category: string;
        is_emergency: boolean;
        created_at: string;
        resolved_at: string | null;
        requested_amount: number | null;
        approved_amount: number | null;
        approval_status: string | null;
      }>;
      const opened = allReqs.filter((r) => r.created_at >= fromIso && r.created_at <= toIso);
      const resolvedInRange = allReqs.filter(
        (r) => r.resolved_at && r.resolved_at >= fromIso && r.resolved_at <= toIso,
      );
      const unresolved = allReqs.filter((r) => r.status !== 'resolved' && r.status !== 'cancelled');

      // Financial assistance totals scoped to requests opened in the report window.
      const financialRows = opened.filter(
        (r) => r.category === 'financial' || (r.requested_amount != null && r.requested_amount > 0),
      );
      const financials = {
        count: financialRows.length,
        requested: financialRows.reduce((s, r) => s + (r.requested_amount || 0), 0),
        approved: financialRows.reduce((s, r) => s + (r.approved_amount || 0), 0),
        pending: financialRows
          .filter((r) => (r.approval_status ?? 'pending') === 'pending')
          .reduce((s, r) => s + (r.requested_amount || 0), 0),
        approvedCount: financialRows.filter((r) => r.approval_status === 'approved').length,
        partiallyApprovedCount: financialRows.filter((r) => r.approval_status === 'partially_approved').length,
        deniedCount: financialRows.filter((r) => r.approval_status === 'denied').length,
        pendingCount: financialRows.filter((r) => (r.approval_status ?? 'pending') === 'pending').length,
      };
      const durations = resolvedInRange
        .map((r) => new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime())
        .filter((n) => n > 0);
      const avgResolutionHours =
        durations.length > 0
          ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length / (1000 * 60 * 60)) * 10) / 10
          : 0;

      const notesInRange = (notesInRangeRes.data || []) as Array<{ note_type: string; created_at: string }>;
      const noteTypeCounts = new Map<string, number>();
      notesInRange.forEach((n) =>
        noteTypeCounts.set(n.note_type, (noteTypeCounts.get(n.note_type) || 0) + 1),
      );

      const appts = (appointmentsRes.data || []) as Array<{ status: string; scheduled_at: string }>;
      const scheduled = appts.filter((a) => a.status !== 'cancelled');
      const now = new Date();
      const kept = scheduled.filter(
        (a) => new Date(a.scheduled_at) < now && a.status !== 'no_show' && a.status !== 'cancelled',
      );
      const attendanceRate = scheduled.length > 0 ? kept.length / scheduled.length : null;

      const surveys = (surveysRes.data || []) as Array<{ completed_at: string | null }>;

      const lsRows = ((lifeSkillsRes.data as unknown as Array<{
        score_summary: Record<string, unknown> | null;
        impact_survey_templates: { slug: string };
      }>) || []).map((r) => ({
        slug: r.impact_survey_templates?.slug,
        score: r.score_summary,
      }));
      const lifeSkills = computeLifeSkillsProgress(lsRows);

      // Certifications aggregate
      const nowMs = Date.now();
      const in30 = nowMs + 30 * 24 * 60 * 60 * 1000;
      let certsEarnedInRange = 0;
      let certsActive = 0;
      let certsExpiringSoon = 0;
      ((certsRes.data || []) as Array<{ status: string; completion_date: string | null; expiration_date: string | null }>).forEach((c) => {
        if (c.status === 'active' || c.status === 'earned' || c.status === 'completed') certsActive += 1;
        if (c.completion_date && c.completion_date >= fromIso.slice(0, 10) && c.completion_date <= toIso.slice(0, 10)) certsEarnedInRange += 1;
        if (c.expiration_date) {
          const t = new Date(c.expiration_date).getTime();
          if (t >= nowMs && t <= in30) certsExpiringSoon += 1;
        }
      });

      const refs = (referralsRes.data || []) as Array<{ clicked_at: string | null }>;
      const referralsCreatedInRange = refs.length;
      const referralsClickedInRange = refs.filter((r) => !!r.clicked_at).length;

      const plans = (plansRes.data || []) as Array<{ id: string; updated_at: string | null; graduation_date: string | null }>;
      const plansOnFile = plans.length;
      let graduationsInRange = 0;
      let plansStalled = 0;
      plans.forEach((p) => {
        if (p.graduation_date && p.graduation_date >= fromIso.slice(0, 10) && p.graduation_date <= toIso.slice(0, 10)) graduationsInRange += 1;
        if (p.updated_at) {
          const days = Math.floor((nowMs - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24));
          if (days > 30) plansStalled += 1;
        }
      });

      let employedCount = 0;
      let seekingCount = 0;
      let unknownEmpCount = 0;
      ((outcomesRes.data || []) as Array<{ employment_status: string | null }>).forEach((o) => {
        const s = (o.employment_status || '').toLowerCase();
        if (s.includes('employed') && !s.includes('un')) employedCount += 1;
        else if (s.includes('seeking') || s.includes('unemployed')) seekingCount += 1;
        else unknownEmpCount += 1;
      });
      const m05 = lifeSkills.modules.find((m) => m.module.id === 'm05');

      // Category / priority breakdown of unresolved
      const openByCat = new Map<string, number>();
      const openByPri = new Map<string, number>();
      unresolved.forEach((r) => {
        openByCat.set(r.category, (openByCat.get(r.category) || 0) + 1);
        openByPri.set(r.priority, (openByPri.get(r.priority) || 0) + 1);
      });

      const messagesSentCount = ((messagesSentRes.data || []) as unknown[]).length;
      const messagesReceivedCount = ((messagesReceivedRes.data || []) as unknown[]).length;

      const impactMetrics: ImpactMetrics = {
        scopeLabel: scopeLabel || `${studentIds.length} student${studentIds.length === 1 ? '' : 's'} in scope`,
        noteBreakdown: Array.from(noteTypeCounts.entries())
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count),
        lastNoteAt: (notesAllRes.data?.[0] as { created_at?: string } | undefined)?.created_at || null,
        surveys: {
          sent: surveys.length,
          completed: surveys.filter((s) => !!s.completed_at).length,
          responseRate: surveys.length > 0 ? surveys.filter((s) => !!s.completed_at).length / surveys.length : null,
        },
        certifications: { earnedInRange: certsEarnedInRange, active: certsActive, expiringSoon: certsExpiringSoon },
        supportNeeds: {
          openTotal: unresolved.length,
          byCategory: Array.from(openByCat.entries()).map(([key, count]) => ({ key, count })),
          byPriority: Array.from(openByPri.entries()).map(([key, count]) => ({ key, count })),
        },
        referrals: { createdInRange: referralsCreatedInRange, clickedInRange: referralsClickedInRange },
        milestones: { plansOnFile, graduationsInRange, stalled: plansStalled },
        engagement: {
          messagesSent: messagesSentCount,
          messagesReceived: messagesReceivedCount,
          activeDays: 0,
        },
        employmentReadiness: {
          employed: employedCount,
          seeking: seekingCount,
          unknown: unknownEmpCount,
          m05PostAvg: m05?.postAvg ?? null,
        },
      };

      // Deterministic org-level risk/action items derived from aggregates.
      const risks: RiskIndicator[] = [];
      const actionItems: ActionItem[] = [];
      const emergencyOpen = unresolved.filter((r) => r.is_emergency).length;
      if (emergencyOpen > 0) {
        risks.push({
          key: 'org_open_emergency',
          label: 'Open emergency requests in scope',
          severity: 'high',
          detail: `${emergencyOpen} unresolved emergency request${emergencyOpen > 1 ? 's' : ''}.`,
        });
        actionItems.push({
          key: 'org_open_emergency',
          text: 'Triage all emergency requests in scope this session.',
          severity: 'high',
        });
      }
      if (attendanceRate != null && scheduled.length >= 5 && attendanceRate < 0.6) {
        risks.push({
          key: 'org_low_attendance',
          label: 'Low attendance across scope',
          severity: 'medium',
          detail: `Only ${Math.round(attendanceRate * 100)}% of scheduled meetings were kept in this period.`,
        });
        actionItems.push({
          key: 'org_low_attendance',
          text: 'Review meeting cadence and scheduling barriers with case managers.',
          severity: 'medium',
        });
      }
      if (plansStalled > 0) {
        risks.push({
          key: 'org_plans_stalled',
          label: 'Stalled post-grad plans',
          severity: 'medium',
          detail: `${plansStalled} plans not updated in 30+ days.`,
        });
        actionItems.push({
          key: 'org_plans_stalled',
          text: 'Assign case managers to refresh stalled post-grad plans this week.',
          severity: 'medium',
        });
      }
      if (certsExpiringSoon > 0) {
        risks.push({
          key: 'org_cert_expiring',
          label: 'Certifications expiring soon',
          severity: 'low',
          detail: `${certsExpiringSoon} certification${certsExpiringSoon > 1 ? 's' : ''} expiring within 30 days.`,
        });
        actionItems.push({
          key: 'org_cert_expiring',
          text: 'Contact students with expiring certifications about renewal steps.',
          severity: 'low',
        });
      }
      const regressions = lifeSkills.modules.filter((m) => m.delta != null && m.delta <= -0.5);
      if (regressions.length > 0) {
        risks.push({
          key: 'org_lifeskills_regression',
          label: 'Life Skills confidence regression',
          severity: 'medium',
          detail: `Post < pre by ≥0.5 in: ${regressions.map((r) => r.module.title).join(', ')}.`,
        });
        actionItems.push({
          key: 'org_lifeskills_regression',
          text: 'Review lesson delivery for the regressed modules with the curriculum team.',
          severity: 'medium',
        });
      }
      if (risks.length === 0) {
        actionItems.push({
          key: 'org_all_clear',
          text: 'No org-level risks detected from current data.',
          severity: 'low',
        });
      }

      const topUnresolved = unresolved
        .slice()
        .sort((a, b) => {
          if (a.is_emergency !== b.is_emergency) return a.is_emergency ? -1 : 1;
          return a.created_at < b.created_at ? -1 : 1;
        })
        .slice(0, 25)
        .map((r) => ({
          id: r.id,
          title: r.title,
          student_name: studentNameById[r.student_id] ?? null,
          priority: r.priority,
          status: r.status,
          ageDays: Math.floor((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24)),
          is_emergency: r.is_emergency,
        }));

      return {
        range: { from: fromIso, to: toIso },
        generatedAt: new Date().toISOString(),
        scopeLabel: scopeLabel || `${studentIds.length} student${studentIds.length === 1 ? '' : 's'} in scope`,
        summary: {
          studentCount: studentIds.length,
          requestsOpened: opened.length,
          requestsResolved: resolvedInRange.length,
          unresolvedCount: unresolved.length,
          emergencyOpen,
          avgResolutionHours,
          notesInRange: notesInRange.length,
          appointmentsInRange: appts.length,
          appointmentsKept: kept.length,
          attendanceRate,
          checkInsInRange: ((checkInsRes.data || []) as unknown[]).length,
          surveysSent: surveys.length,
          surveysCompleted: surveys.filter((s) => !!s.completed_at).length,
        },
        lifeSkills,
        impactMetrics,
        risks,
        actionItems,
        topUnresolved,
      };
    },
  });
}
