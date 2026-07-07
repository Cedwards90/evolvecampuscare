
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile, SupportRequest, RequestUpdate, Appointment } from '@/types/database';
import {
  computeLifeSkillsProgress,
  emptyLifeSkillsResult,
  type LifeSkillsProgressResult,
} from '@/hooks/useLifeSkillsProgress';
import type { ImpactMetrics } from '@/components/reports/ImpactMetricsBlock';

export type ReportPreset = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface InteractionReportParams {
  caseManagerId: string | undefined;
  from: Date;
  to: Date;
}

export interface InteractionReport {
  caseManager: Profile | null;
  organization: { id: string; name: string } | null;
  range: { from: string; to: string };
  generatedAt: string;
  summary: {
    activeStudents: number;
    requestsOpened: number;
    requestsResolved: number;
    avgResolutionHours: number;
    unresolvedCount: number;
    emergencyCount: number;
  };
  contacts: {
    messagesSent: number;
    messagesReceived: number;
    distinctStudents: number;
  };
  notes: { total: number; byType: Record<string, number> };
  surveys: { sent: number; completed: number };
  requests: {
    opened: number;
    inProgress: number;
    resolved: number;
    escalated: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
    rows: SupportRequest[];
  };
  statusChanges: RequestUpdate[];
  followUps: {
    total: number;
    completed: number;
    upcoming: number;
    rows: Appointment[];
  };
  unresolved: SupportRequest[];
  lifeSkills: LifeSkillsProgressResult;
  impactMetrics: ImpactMetrics;
}

export function getPresetRange(preset: Exclude<ReportPreset, 'custom'>): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  if (preset === 'daily') from.setDate(to.getDate() - 1);
  else if (preset === 'weekly') from.setDate(to.getDate() - 7);
  else from.setDate(to.getDate() - 30);
  return { from, to };
}

export function useInteractionReport({ caseManagerId, from, to }: InteractionReportParams) {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const enabled = !!caseManagerId && !!user;

  // Defense-in-depth: case managers can only request their own data
  const permitted =
    enabled && (role === 'admin' || (role === 'case_manager' && caseManagerId === user?.id));

  const queryKey = ['interaction-report', caseManagerId, fromIso, toIso] as const;

  // Realtime invalidation handled centrally by useRealtimeBridge.


  return useQuery({
    queryKey,
    enabled: permitted,
    queryFn: async (): Promise<InteractionReport> => {
      if (!caseManagerId) throw new Error('Missing case manager');

      const [
        profileRes,
        assignmentsRes,
        requestsAllRes,
        requestsInRangeRes,
        statusChangesRes,
        notesRes,
        sentMessagesRes,
        receivedMessagesRes,
        surveysRes,
        appointmentsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', caseManagerId).maybeSingle(),
        supabase.from('student_assignments').select('student_id').eq('case_manager_id', caseManagerId),
        supabase
          .from('support_requests')
          .select('*')
          .eq('assigned_case_manager_id', caseManagerId),
        supabase
          .from('support_requests')
          .select('*')
          .eq('assigned_case_manager_id', caseManagerId)
          .gte('created_at', fromIso)
          .lte('created_at', toIso),
        supabase
          .from('request_updates')
          .select('*')
          .eq('user_id', caseManagerId)
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .order('created_at', { ascending: false }),
        supabase
          .from('file_notes')
          .select('*')
          .eq('author_id', caseManagerId)
          .gte('created_at', fromIso)
          .lte('created_at', toIso),
        supabase
          .from('staff_messages')
          .select('id, recipient_id, created_at')
          .eq('sender_id', caseManagerId)
          .gte('created_at', fromIso)
          .lte('created_at', toIso),
        supabase
          .from('staff_messages')
          .select('id, sender_id, created_at')
          .eq('recipient_id', caseManagerId)
          .gte('created_at', fromIso)
          .lte('created_at', toIso),
        supabase
          .from('survey_invitations')
          .select('id, completed_at, created_at')
          .eq('sent_by', caseManagerId)
          .gte('created_at', fromIso)
          .lte('created_at', toIso),
        supabase
          .from('appointments')
          .select('*')
          .eq('case_manager_id', caseManagerId)
          .gte('scheduled_at', fromIso)
          .lte('scheduled_at', toIso)
          .order('scheduled_at', { ascending: true }),
      ]);

      const errors = [
        profileRes.error,
        assignmentsRes.error,
        requestsAllRes.error,
        requestsInRangeRes.error,
        statusChangesRes.error,
        notesRes.error,
        sentMessagesRes.error,
        receivedMessagesRes.error,
        surveysRes.error,
        appointmentsRes.error,
      ].filter(Boolean);
      if (errors.length) throw errors[0];

      const allRequests = (requestsAllRes.data || []) as SupportRequest[];
      const opened = (requestsInRangeRes.data || []) as SupportRequest[];
      const resolvedInRange = allRequests.filter(
        (r) => r.resolved_at && r.resolved_at >= fromIso && r.resolved_at <= toIso,
      );
      const unresolved = allRequests.filter(
        (r) => r.status !== 'resolved' && r.status !== 'cancelled',
      );

      // Hydrate students for opened/unresolved tables
      const studentIds = Array.from(
        new Set(
          [...opened, ...unresolved].map((r) => r.student_id).filter(Boolean) as string[],
        ),
      );
      let studentMap = new Map<string, Profile & { organization_name?: string | null }>();
      if (studentIds.length > 0) {
        const [{ data: studentProfiles }, { data: orgs }] = await Promise.all([
          supabase.from('profiles').select('*').in('user_id', studentIds),
          supabase.from('training_organizations').select('id, name'),
        ]);
        const orgMap = new Map((orgs || []).map((o) => [o.id, o.name as string]));
        studentMap = new Map(
          (studentProfiles || []).map((p) => [
            p.user_id,
            { ...(p as Profile), organization_name: p.organization_id ? orgMap.get(p.organization_id) || null : null },
          ]),
        );
      }
      const hydrate = (r: SupportRequest) => ({ ...r, student: studentMap.get(r.student_id) });

      // Avg resolution hours
      const resolvedDurations = resolvedInRange
        .map((r) => new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime())
        .filter((n) => n > 0);
      const avgResolutionHours =
        resolvedDurations.length > 0
          ? Math.round(
              (resolvedDurations.reduce((a, b) => a + b, 0) /
                resolvedDurations.length /
                (1000 * 60 * 60)) *
                10,
            ) / 10
          : 0;

      // Group by category/priority (within range opened)
      const byCategory: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      opened.forEach((r) => {
        byCategory[r.category] = (byCategory[r.category] || 0) + 1;
        byPriority[r.priority] = (byPriority[r.priority] || 0) + 1;
      });

      // Notes by type
      const notes = (notesRes.data || []) as Array<{ note_type: string }>;
      const notesByType: Record<string, number> = {};
      notes.forEach((n) => {
        notesByType[n.note_type] = (notesByType[n.note_type] || 0) + 1;
      });

      // Contacts
      const sent = (sentMessagesRes.data || []) as Array<{ recipient_id: string }>;
      const received = (receivedMessagesRes.data || []) as Array<{ sender_id: string }>;
      const distinctStudents = new Set<string>();
      sent.forEach((m) => distinctStudents.add(m.recipient_id));
      received.forEach((m) => distinctStudents.add(m.sender_id));

      // Surveys
      const surveys = (surveysRes.data || []) as Array<{ completed_at: string | null }>;

      // Appointments
      const appts = (appointmentsRes.data || []) as Appointment[];
      const now = new Date();
      const followUps = {
        total: appts.length,
        completed: appts.filter((a) => new Date(a.scheduled_at) < now && a.status !== 'cancelled').length,
        upcoming: appts.filter((a) => new Date(a.scheduled_at) >= now && a.status !== 'cancelled').length,
        rows: appts,
      };

      // Fetch case manager's organization for report branding
      let organization: { id: string; name: string } | null = null;
      const orgId = (profileRes.data as Profile | null)?.organization_id;
      if (orgId) {
        const { data: orgRow } = await supabase
          .from('training_organizations')
          .select('id, name')
          .eq('id', orgId)
          .maybeSingle();
        if (orgRow) organization = { id: orgRow.id, name: orgRow.name };
      }

      // --- Life Skills & impact metrics aggregation over caseload ---
      const studentIdsAll = (assignmentsRes.data || []).map((a) => a.student_id).filter(Boolean) as string[];
      let lifeSkills: LifeSkillsProgressResult = emptyLifeSkillsResult();
      let certsEarnedInRange = 0;
      let certsActive = 0;
      let certsExpiringSoon = 0;
      let referralsCreatedInRange = 0;
      let referralsClickedInRange = 0;
      let plansOnFile = 0;
      let graduationsInRange = 0;
      let plansStalled = 0;
      let employedCount = 0;
      let seekingCount = 0;
      let unknownEmpCount = 0;
      if (studentIdsAll.length > 0) {
        const [lsRes, certsRes, refsRes, plansRes, outcomesRes] = await Promise.all([
          supabase
            .from('impact_survey_responses')
            .select('score_summary, impact_survey_templates!inner(slug)')
            .in('student_id', studentIdsAll),
          supabase
            .from('student_certifications')
            .select('status, completion_date, expiration_date')
            .in('student_id', studentIdsAll),
          supabase
            .from('resource_recommendations')
            .select('id, created_at, clicked_at')
            .in('student_id', studentIdsAll)
            .gte('created_at', fromIso)
            .lte('created_at', toIso),
          supabase
            .from('post_graduation_plans')
            .select('id, updated_at, graduation_date')
            .in('student_id', studentIdsAll),
          supabase
            .from('participant_outcomes')
            .select('employment_status, program_completion_date')
            .in('student_id', studentIdsAll),
        ]);
        const lsRows = ((lsRes.data as unknown as Array<{
          score_summary: Record<string, unknown> | null;
          impact_survey_templates: { slug: string };
        }>) || []).map((r) => ({ slug: r.impact_survey_templates?.slug, score: r.score_summary }));
        lifeSkills = computeLifeSkillsProgress(lsRows);

        const nowMs = Date.now();
        const in30 = nowMs + 30 * 24 * 60 * 60 * 1000;
        ((certsRes.data || []) as Array<{ status: string; completion_date: string | null; expiration_date: string | null }>).forEach((c) => {
          if (c.status === 'active' || c.status === 'earned' || c.status === 'completed') certsActive += 1;
          if (c.completion_date && c.completion_date >= fromIso.slice(0, 10) && c.completion_date <= toIso.slice(0, 10)) certsEarnedInRange += 1;
          if (c.expiration_date) {
            const t = new Date(c.expiration_date).getTime();
            if (t >= nowMs && t <= in30) certsExpiringSoon += 1;
          }
        });
        const refs = (refsRes.data || []) as Array<{ clicked_at: string | null }>;
        referralsCreatedInRange = refs.length;
        referralsClickedInRange = refs.filter((r) => !!r.clicked_at).length;

        const plans = (plansRes.data || []) as Array<{ id: string; updated_at: string | null; graduation_date: string | null }>;
        plansOnFile = plans.length;
        plans.forEach((p) => {
          if (p.graduation_date && p.graduation_date >= fromIso.slice(0, 10) && p.graduation_date <= toIso.slice(0, 10)) graduationsInRange += 1;
          if (p.updated_at) {
            const days = Math.floor((nowMs - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24));
            if (days > 30) plansStalled += 1;
          }
        });

        ((outcomesRes.data || []) as Array<{ employment_status: string | null }>).forEach((o) => {
          const s = (o.employment_status || '').toLowerCase();
          if (s.includes('employed') && !s.includes('un')) employedCount += 1;
          else if (s.includes('seeking') || s.includes('unemployed')) seekingCount += 1;
          else unknownEmpCount += 1;
        });
      }
      const m05 = lifeSkills.modules.find((m) => m.module.id === 'm05');

      const impactMetrics: ImpactMetrics = {
        scopeLabel: `${studentIdsAll.length} student${studentIdsAll.length === 1 ? '' : 's'} in caseload`,
        noteBreakdown: Object.entries(notesByType).map(([type, count]) => ({ type, count: count as number })),
        lastNoteAt: null,
        surveys: {
          sent: surveys.length,
          completed: surveys.filter((s) => !!s.completed_at).length,
          responseRate: surveys.length > 0 ? surveys.filter((s) => !!s.completed_at).length / surveys.length : null,
        },
        certifications: { earnedInRange: certsEarnedInRange, active: certsActive, expiringSoon: certsExpiringSoon },
        supportNeeds: {
          openTotal: unresolved.length,
          byCategory: Object.entries(byCategory).map(([key, count]) => ({ key, count: count as number })),
          byPriority: Object.entries(byPriority).map(([key, count]) => ({ key, count: count as number })),
        },
        referrals: { createdInRange: referralsCreatedInRange, clickedInRange: referralsClickedInRange },
        milestones: { plansOnFile, graduationsInRange, stalled: plansStalled },
        engagement: { messagesSent: sent.length, messagesReceived: received.length, activeDays: 0 },
        employmentReadiness: {
          employed: employedCount,
          seeking: seekingCount,
          unknown: unknownEmpCount,
          m05PostAvg: m05?.postAvg ?? null,
        },
      };

      return {
        caseManager: (profileRes.data || null) as Profile | null,
        organization,
        range: { from: fromIso, to: toIso },
        generatedAt: new Date().toISOString(),
        summary: {
          activeStudents: (assignmentsRes.data || []).length,
          requestsOpened: opened.length,
          requestsResolved: resolvedInRange.length,
          avgResolutionHours,
          unresolvedCount: unresolved.length,
          emergencyCount: opened.filter((r) => r.is_emergency).length,
        },
        contacts: {
          messagesSent: sent.length,
          messagesReceived: received.length,
          distinctStudents: distinctStudents.size,
        },
        notes: { total: notes.length, byType: notesByType },
        surveys: {
          sent: surveys.length,
          completed: surveys.filter((s) => !!s.completed_at).length,
        },
        requests: {
          opened: opened.length,
          inProgress: opened.filter((r) => r.status === 'in_progress').length,
          resolved: resolvedInRange.length,
          escalated: opened.filter((r) => r.status === 'escalated').length,
          byCategory,
          byPriority,
          rows: opened.map(hydrate),
        },
        statusChanges: (statusChangesRes.data || []) as RequestUpdate[],
        followUps,
        unresolved: unresolved.map(hydrate),
        lifeSkills,
        impactMetrics,
      };
    },
    staleTime: 60 * 1000,
  });
}
