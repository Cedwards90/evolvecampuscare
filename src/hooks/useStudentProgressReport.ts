
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type {
  Profile,
  SupportRequest,
  RequestUpdate,
  Appointment,
} from '@/types/database';
import {
  evaluateRisks,
  deriveActionItems,
  hasSufficientEvidenceForAI,
  type RiskIndicator,
  type ActionItem,
  type CheckInLite,
  type SurveyInvitationLite,
} from '@/lib/studentProgressRules';

export type StudentReportPreset = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface StudentProgressReportParams {
  studentId: string | undefined;
  from: Date;
  to: Date;
}

export interface FileNoteLite {
  id: string;
  created_at: string;
  note_type: string;
  content: string;
  author_id: string;
}

export interface StaffMessageLite {
  id: string;
  created_at: string;
  sender_id: string;
  recipient_id: string;
  subject: string | null;
  content: string;
}

export interface StudentProgressReport {
  student: Profile | null;
  caseManager: Profile | null;
  organization: { id: string; name: string } | null;
  range: { from: string; to: string };
  generatedAt: string;
  // Section 2: deterministic activity summary
  summary: {
    requestsOpened: number;
    requestsResolved: number;
    requestsUnresolved: number;
    emergencyOpenCount: number;
    notesAdded: number;
    messagesSent: number;
    messagesReceived: number;
    appointmentsCompleted: number;
    appointmentsUpcoming: number;
    surveysSentInRange: number;
    surveysCompletedInRange: number;
    checkInsInRange: number;
    lastContactAt: string | null;
  };
  // Section 3: detailed activity (deterministic)
  detail: {
    notes: FileNoteLite[];
    statusChanges: Array<RequestUpdate & { request?: { id: string; title: string } }>;
    appointments: Appointment[];
    checkIns: CheckInLite[];
    surveysInRange: SurveyInvitationLite[];
    messagesInRange: StaffMessageLite[];
    requestsOpenedInRange: SupportRequest[];
    requestsResolvedInRange: SupportRequest[];
  };
  // Section 4 + 5 + 7: deterministic
  risks: RiskIndicator[];
  unresolvedRequests: Array<
    SupportRequest & { lastUpdateAt: string | null; ageDays: number }
  >;
  actionItems: ActionItem[];
  // Hint for the AI panel: don't even call the AI when too sparse
  aiEligible: boolean;
}

export function getStudentReportPresetRange(
  preset: Exclude<StudentReportPreset, 'custom'>,
): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  if (preset === 'daily') from.setDate(to.getDate() - 1);
  else if (preset === 'weekly') from.setDate(to.getDate() - 7);
  else from.setDate(to.getDate() - 30);
  return { from, to };
}

export function useStudentProgressReport({
  studentId,
  from,
  to,
}: StudentProgressReportParams) {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const enabled = !!studentId && !!user;

  // Defense-in-depth on top of RLS:
  // - admins can pull any student
  // - case managers can only pull students they are assigned to
  //   (the actual check happens in queryFn via student_assignments)
  const permitted = enabled && (role === 'admin' || role === 'case_manager');

  const queryKey = ['student-progress-report', studentId, fromIso, toIso] as const;

  // Realtime invalidation handled centrally by useRealtimeBridge.


  return useQuery({
    queryKey,
    enabled: permitted,
    queryFn: async (): Promise<StudentProgressReport> => {
      if (!studentId || !user) throw new Error('Missing student');

      // Permission re-check for case managers (RLS will also block, but fail fast).
      if (role === 'case_manager') {
        const { data: assignment, error: assignmentError } = await supabase
          .from('student_assignments')
          .select('id, case_manager_id')
          .eq('student_id', studentId)
          .eq('case_manager_id', user.id)
          .maybeSingle();
        if (assignmentError) throw assignmentError;
        if (!assignment) {
          throw new Error('Access denied: student not assigned to you');
        }
      }

      const [
        studentRes,
        assignmentRes,
        requestsAllRes,
        statusChangesAllRes,
        statusChangesInRangeRes,
        notesRes,
        messagesSentRes,
        messagesReceivedRes,
        surveysAllRes,
        appointmentsRes,
        checkInsLatestRes,
        checkInsInRangeRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', studentId).maybeSingle(),
        supabase
          .from('student_assignments')
          .select('case_manager_id, created_at')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('support_requests').select('*').eq('student_id', studentId),
        supabase
          .from('request_updates')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200), // we'll filter below by request_id of this student
        supabase
          .from('request_updates')
          .select('*')
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('file_notes')
          .select('id, created_at, note_type, content, author_id')
          .eq('student_id', studentId)
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .order('created_at', { ascending: false }),
        supabase
          .from('staff_messages')
          .select('id, created_at, sender_id, recipient_id, subject, content')
          .eq('sender_id', studentId)
          .gte('created_at', fromIso)
          .lte('created_at', toIso),
        supabase
          .from('staff_messages')
          .select('id, created_at, sender_id, recipient_id, subject, content')
          .eq('recipient_id', studentId)
          .gte('created_at', fromIso)
          .lte('created_at', toIso),
        supabase
          .from('survey_invitations')
          .select('id, survey_type, created_at, completed_at')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('appointments')
          .select('*')
          .eq('student_id', studentId)
          .gte('scheduled_at', fromIso)
          .lte('scheduled_at', toIso)
          .order('scheduled_at', { ascending: true }),
        supabase
          .from('student_checkins')
          .select('id, created_at, mood_rating, progress_rating, blockers, wins')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('student_checkins')
          .select('id, created_at, mood_rating, progress_rating, blockers, wins')
          .eq('student_id', studentId)
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .order('created_at', { ascending: false }),
      ]);

      const errors = [
        studentRes.error,
        assignmentRes.error,
        requestsAllRes.error,
        statusChangesAllRes.error,
        statusChangesInRangeRes.error,
        notesRes.error,
        messagesSentRes.error,
        messagesReceivedRes.error,
        surveysAllRes.error,
        appointmentsRes.error,
        checkInsLatestRes.error,
        checkInsInRangeRes.error,
      ].filter(Boolean);
      if (errors.length) throw errors[0];

      const allRequests = (requestsAllRes.data || []) as SupportRequest[];
      const requestById = new Map(allRequests.map((r) => [r.id, r]));

      // Filter status changes to this student's requests only
      const statusChangesAll = ((statusChangesAllRes.data || []) as RequestUpdate[]).filter(
        (u) => requestById.has(u.request_id),
      );
      const statusChangesInRange = (
        (statusChangesInRangeRes.data || []) as RequestUpdate[]
      )
        .filter((u) => requestById.has(u.request_id))
        .map((u) => ({
          ...u,
          request: requestById.get(u.request_id)
            ? {
                id: requestById.get(u.request_id)!.id,
                title: requestById.get(u.request_id)!.title,
              }
            : undefined,
        }));

      const requestsOpenedInRange = allRequests.filter(
        (r) => r.created_at >= fromIso && r.created_at <= toIso,
      );
      const requestsResolvedInRange = allRequests.filter(
        (r) => r.resolved_at && r.resolved_at >= fromIso && r.resolved_at <= toIso,
      );
      const unresolved = allRequests.filter(
        (r) => r.status !== 'resolved' && r.status !== 'cancelled',
      );

      // Look up case manager profile (most recent assignment)
      let caseManager: Profile | null = null;
      const cmId = assignmentRes.data?.case_manager_id;
      if (cmId) {
        const { data: cmProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', cmId)
          .maybeSingle();
        caseManager = (cmProfile as Profile) || null;
      }

      // Look up organization (for branding in reports/exports)
      let organization: { id: string; name: string } | null = null;
      const orgId = (studentRes.data as Profile | null)?.organization_id;
      if (orgId) {
        const { data: orgRow } = await supabase
          .from('training_organizations')
          .select('id, name')
          .eq('id', orgId)
          .maybeSingle();
        if (orgRow) organization = { id: orgRow.id, name: orgRow.name };
      }


      const notes = (notesRes.data || []) as FileNoteLite[];
      const messagesSent = (messagesSentRes.data || []) as StaffMessageLite[];
      const messagesReceived = (messagesReceivedRes.data || []) as StaffMessageLite[];
      const messagesInRange = [...messagesSent, ...messagesReceived].sort((a, b) =>
        a.created_at < b.created_at ? 1 : -1,
      );
      const surveys = (surveysAllRes.data || []) as SurveyInvitationLite[];
      const surveysInRange = surveys.filter(
        (s) => s.created_at >= fromIso && s.created_at <= toIso,
      );
      const appointments = (appointmentsRes.data || []) as Appointment[];
      const checkInsLatest = (checkInsLatestRes.data || []) as CheckInLite[];
      const checkInsInRange = (checkInsInRangeRes.data || []) as CheckInLite[];

      // Last contact = most recent of notes / messages / appointments (within range)
      const candidates: string[] = [];
      if (notes[0]) candidates.push(notes[0].created_at);
      if (messagesInRange[0]) candidates.push(messagesInRange[0].created_at);
      if (appointments.length > 0) {
        const last = [...appointments].sort((a, b) =>
          a.scheduled_at < b.scheduled_at ? 1 : -1,
        )[0];
        candidates.push(last.scheduled_at);
      }
      const lastContactAt =
        candidates.length > 0
          ? candidates.sort((a, b) => (a < b ? 1 : -1))[0]
          : null;

      const now = new Date();
      const appointmentsCompleted = appointments.filter(
        (a) => new Date(a.scheduled_at) < now && a.status !== 'cancelled',
      ).length;
      const appointmentsUpcoming = appointments.filter(
        (a) => new Date(a.scheduled_at) >= now && a.status !== 'cancelled',
      ).length;

      // Unresolved enrichment with last update
      const unresolvedEnriched = unresolved
        .map((r) => {
          const updates = statusChangesAll.filter((u) => u.request_id === r.id);
          const lastUpdate =
            updates.length > 0
              ? updates.reduce((a, b) => (a.created_at > b.created_at ? a : b))
              : null;
          return {
            ...r,
            lastUpdateAt: lastUpdate?.created_at || null,
            ageDays: Math.floor(
              (now.getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24),
            ),
          };
        })
        .sort((a, b) => {
          // Emergencies first, then oldest
          if (a.is_emergency !== b.is_emergency) return a.is_emergency ? -1 : 1;
          return a.created_at < b.created_at ? -1 : 1;
        });

      const risks = evaluateRisks({
        rangeFrom: from,
        rangeTo: to,
        unresolvedRequests: unresolved,
        statusChangesAll,
        notesInRangeCount: notes.length,
        messagesInRangeCount: messagesInRange.length,
        appointmentsInRange: appointments,
        checkInsLatest,
        surveys,
      });

      const actionItems = deriveActionItems(risks);

      const aiEligible = hasSufficientEvidenceForAI({
        notesInRangeCount: notes.length,
        checkInsInRangeCount: checkInsInRange.length,
        statusChangesInRangeCount: statusChangesInRange.length,
        appointmentsInRangeCount: appointments.length,
      });

      return {
        student: (studentRes.data || null) as Profile | null,
        caseManager,
        organization,
        range: { from: fromIso, to: toIso },
        generatedAt: new Date().toISOString(),
        summary: {
          requestsOpened: requestsOpenedInRange.length,
          requestsResolved: requestsResolvedInRange.length,
          requestsUnresolved: unresolved.length,
          emergencyOpenCount: unresolved.filter((r) => r.is_emergency).length,
          notesAdded: notes.length,
          messagesSent: messagesSent.length,
          messagesReceived: messagesReceived.length,
          appointmentsCompleted,
          appointmentsUpcoming,
          surveysSentInRange: surveysInRange.length,
          surveysCompletedInRange: surveysInRange.filter((s) => !!s.completed_at).length,
          checkInsInRange: checkInsInRange.length,
          lastContactAt,
        },
        detail: {
          notes,
          statusChanges: statusChangesInRange,
          appointments,
          checkIns: checkInsInRange,
          surveysInRange,
          messagesInRange,
          requestsOpenedInRange,
          requestsResolvedInRange,
        },
        risks,
        unresolvedRequests: unresolvedEnriched,
        actionItems,
        aiEligible,
      };
    },
    staleTime: 60 * 1000,
  });
}
