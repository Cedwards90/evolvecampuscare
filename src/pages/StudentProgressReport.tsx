import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Download, FileText, Loader2, Users } from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { PageNav } from '@/components/navigation/PageNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  useStudentProgressReport,
  getStudentReportPresetRange,
  type StudentReportPreset,
  type StudentProgressReport,
} from '@/hooks/useStudentProgressReport';
import { useReportStudentFilters } from '@/hooks/useReportStudentFilters';
import { StudentPicker } from '@/components/reports/StudentPicker';
import { StudentReportPreview } from '@/components/reports/StudentReportPreview';
import { ReportFilters } from '@/components/reports/ReportFilters';
import {
  AISummaryPanel,
} from '@/components/reports/AISummaryPanel';
import {
  exportStudentProgressCsv,
  exportStudentProgressPdf,
  exportBulkStudentProgressCsv,
  exportBulkStudentProgressPdf,
  type AISummarySections,
  type BulkReportEntry,
} from '@/lib/studentProgressExport';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';



export default function StudentProgressReportPage() {
  const { studentId: routeStudentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const initialPreset =
    (searchParams.get('preset') as StudentReportPreset) || 'weekly';
  const initialRange = useMemo(
    () =>
      initialPreset === 'custom'
        ? getStudentReportPresetRange('weekly')
        : getStudentReportPresetRange(
            initialPreset as Exclude<StudentReportPreset, 'custom'>,
          ),
    [initialPreset],
  );

  const [preset, setPreset] = useState<StudentReportPreset>(
    initialPreset === 'custom' ? 'weekly' : initialPreset,
  );
  const [from, setFrom] = useState<Date>(initialRange.from);
  const [to, setTo] = useState<Date>(initialRange.to);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [studentId, setStudentId] = useState<string | undefined>(routeStudentId);
  const [aiSummary, setAiSummary] = useState<AISummarySections | null>(null);

  // Sync route -> state
  useEffect(() => {
    if (routeStudentId && routeStudentId !== studentId) {
      setStudentId(routeStudentId);
    }
  }, [routeStudentId, studentId]);

  // Reset AI summary whenever inputs change
  useEffect(() => {
    setAiSummary(null);
  }, [studentId, from, to]);

  const { data, isLoading, isFetching, error, refetch } = useStudentProgressReport({
    studentId,
    from,
    to,
  });

  const handlePreset = (p: Exclude<StudentReportPreset, 'custom'>) => {
    const r = getStudentReportPresetRange(p);
    setPreset(p);
    setFrom(r.from);
    setTo(r.to);
  };

  const handleStudentChange = (id: string) => {
    setStudentId(id);
    // Update URL so it's shareable
    navigate(
      `/reports/student/${id}${preset !== 'custom' ? `?preset=${preset}` : ''}`,
      { replace: true },
    );
  };

  const handleExportPdf = () => {
    if (!data) return;
    try {
      exportStudentProgressPdf(data, aiSummary);
    } catch (e) {
      toast({
        title: 'PDF export failed',
        description: (e as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleExportCsv = () => {
    if (!data) return;
    try {
      exportStudentProgressCsv(data, aiSummary);
    } catch (e) {
      toast({
        title: 'CSV export failed',
        description: (e as Error).message,
        variant: 'destructive',
      });
    }
  };

  // ---- Filters + bulk export pool ----
  const {
    filters,
    setFilter,
    resetFilters,
    filteredStudents,
    totalCount,
    matchingCount,
  } = useReportStudentFilters();
  const myStudents = filteredStudents;
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchReportFor = async (
    sid: string,
  ): Promise<StudentProgressReport | null> => {
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
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
      supabase.from('profiles').select('*').eq('user_id', sid).maybeSingle(),
      supabase
        .from('student_assignments')
        .select('case_manager_id, created_at')
        .eq('student_id', sid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('support_requests').select('*').eq('student_id', sid),
      supabase
        .from('request_updates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
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
        .eq('student_id', sid)
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: false }),
      supabase
        .from('staff_messages')
        .select('id, created_at, sender_id, recipient_id, subject, content')
        .eq('sender_id', sid)
        .gte('created_at', fromIso)
        .lte('created_at', toIso),
      supabase
        .from('staff_messages')
        .select('id, created_at, sender_id, recipient_id, subject, content')
        .eq('recipient_id', sid)
        .gte('created_at', fromIso)
        .lte('created_at', toIso),
      supabase
        .from('survey_invitations')
        .select('id, survey_type, created_at, completed_at')
        .eq('student_id', sid)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('appointments')
        .select('*')
        .eq('student_id', sid)
        .gte('scheduled_at', fromIso)
        .lte('scheduled_at', toIso)
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('student_checkins')
        .select('id, created_at, mood_rating, progress_rating, blockers, wins')
        .eq('student_id', sid)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('student_checkins')
        .select('id, created_at, mood_rating, progress_rating, blockers, wins')
        .eq('student_id', sid)
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
    if (errors.length) {
      console.error('Bulk fetch error', errors[0]);
      return null;
    }

    const rulesMod = await import('@/lib/studentProgressRules');
    const allRequests = requestsAllRes.data || [];
    const requestById = new Map(allRequests.map((r) => [r.id, r]));
    const statusChangesAll = (statusChangesAllRes.data || []).filter((u) =>
      requestById.has(u.request_id),
    );
    const statusChangesInRange = (statusChangesInRangeRes.data || [])
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

    let caseManager = null;
    const cmId = assignmentRes.data?.case_manager_id;
    if (cmId) {
      const { data: cmProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', cmId)
        .maybeSingle();
      caseManager = cmProfile;
    }

    const notes = notesRes.data || [];
    const messagesSent = messagesSentRes.data || [];
    const messagesReceived = messagesReceivedRes.data || [];
    const messagesInRange = [...messagesSent, ...messagesReceived].sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1,
    );
    const surveys = surveysAllRes.data || [];
    const surveysInRange = surveys.filter(
      (s) => s.created_at >= fromIso && s.created_at <= toIso,
    );
    const appointments = appointmentsRes.data || [];
    const checkInsLatest = checkInsLatestRes.data || [];
    const checkInsInRange = checkInsInRangeRes.data || [];

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
            (now.getTime() - new Date(r.created_at).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        };
      })
      .sort((a, b) => {
        if (a.is_emergency !== b.is_emergency) return a.is_emergency ? -1 : 1;
        return a.created_at < b.created_at ? -1 : 1;
      });

    const risks = rulesMod.evaluateRisks({
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
    const actionItems = rulesMod.deriveActionItems(risks);
    const aiEligible = rulesMod.hasSufficientEvidenceForAI({
      notesInRangeCount: notes.length,
      checkInsInRangeCount: checkInsInRange.length,
      statusChangesInRangeCount: statusChangesInRange.length,
      appointmentsInRangeCount: appointments.length,
    });

    return {
      student: studentRes.data,
      caseManager,
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
        surveysCompletedInRange: surveysInRange.filter((s) => !!s.completed_at)
          .length,
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
    } as StudentProgressReport;
  };

  const handleBulkExport = async (formatType: 'pdf' | 'csv') => {
    if (myStudents.length === 0) {
      toast({
        title: 'No students to export',
        description: 'There are no assigned students.',
        variant: 'destructive',
      });
      return;
    }
    setBulkLoading(true);
    try {
      const entries: BulkReportEntry[] = [];
      // Sequential to be gentle on the network and respect RLS round-trips
      for (const a of myStudents) {
        const r = await fetchReportFor(a.student_id);
        if (r) entries.push({ report: r, ai: null });
      }
      if (entries.length === 0) {
        throw new Error('No reports could be generated');
      }
      const rangeLabel = `${format(from, 'PP')} – ${format(to, 'PP')}  •  ${entries.length} student${entries.length === 1 ? '' : 's'}`;
      if (formatType === 'pdf') {
        exportBulkStudentProgressPdf(entries, rangeLabel);
      } else {
        exportBulkStudentProgressCsv(entries);
      }
      toast({
        title: 'Bulk export ready',
        description: `Generated reports for ${entries.length} student${entries.length === 1 ? '' : 's'}.`,
      });
    } catch (e) {
      toast({
        title: 'Bulk export failed',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const exportsDisabled = !data || isLoading;

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageNav
          fallback="/reports"
          crumbs={[
            { label: 'Reports', to: '/reports' },
            { label: 'Student Progress' },
          ]}
        />
        <PageHeader
          title="Student Progress Reports"
          description="Live, per-student summary of activity, risks, and recommended actions. Exports include only real data — no fabricated insights."
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReportFilters
              filters={filters}
              setFilter={setFilter}
              resetFilters={resetFilters}
              preset={preset}
              from={from}
              to={to}
              onPresetChange={handlePreset}
              onRangeChange={(f, t) => {
                setPreset('custom');
                setFrom(f);
                setTo(t);
              }}
              totalCount={totalCount}
              matchingCount={matchingCount}
            />

            <StudentPicker
              value={studentId}
              onChange={handleStudentChange}
              students={filteredStudents}
            />

            <div className="flex flex-wrap items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={!studentId}
                >
                  {isFetching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Refresh'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportCsv}
                  disabled={exportsDisabled}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  CSV
                </Button>
                <Button onClick={handleExportPdf} disabled={exportsDisabled}>
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border/60 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Bulk export for filtered students ({myStudents.length})
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkExport('csv')}
                  disabled={bulkLoading || myStudents.length === 0}
                >
                  {bulkLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Bulk CSV
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleBulkExport('pdf')}
                  disabled={bulkLoading || myStudents.length === 0}
                >
                  {bulkLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Bulk PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <StudentReportPreview
          data={data}
          isLoading={isLoading && !!studentId}
          isFetching={isFetching}
          error={error}
        />

        {data && (
          <AISummaryPanel report={data} onSummary={setAiSummary} />
        )}
      </div>
    </SidebarLayout>
  );
}
