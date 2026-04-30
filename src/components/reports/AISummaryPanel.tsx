import { useState, useCallback } from 'react';
import { Sparkles, Loader2, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import type { StudentProgressReport } from '@/hooks/useStudentProgressReport';
import type { AISummarySections } from '@/lib/studentProgressExport';

interface Props {
  report: StudentProgressReport;
  onSummary?: (s: AISummarySections | null) => void;
}

const INSUFFICIENT = 'Insufficient data for this period.';

function deriveUnresolvedConcerns(report: StudentProgressReport): string {
  if (report.unresolvedRequests.length === 0) {
    return 'No unresolved concerns recorded for this student.';
  }
  const top = report.unresolvedRequests.slice(0, 5).map((r) => {
    const tag = r.is_emergency ? '⚠ EMERGENCY: ' : '';
    return `• ${tag}"${r.title}" (${r.priority}, ${r.ageDays}d old, status: ${r.status})`;
  });
  const more =
    report.unresolvedRequests.length > 5
      ? `\n…and ${report.unresolvedRequests.length - 5} more.`
      : '';
  return top.join('\n') + more;
}

function deriveRecommendedNextSteps(report: StudentProgressReport): string {
  if (report.actionItems.length === 0) {
    return 'No recommended actions based on current data.';
  }
  return report.actionItems
    .map((a) => `• [${a.severity.toUpperCase()}] ${a.text}`)
    .join('\n');
}

export function AISummaryPanel({ report, onSummary }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AISummarySections | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Build evidence payload from real data only.
    const evidence = {
      notes: report.detail.notes.map((n) => ({
        id: n.id,
        date: n.created_at,
        note_type: n.note_type,
        excerpt: n.content,
      })),
      checkIns: report.detail.checkIns.map((c) => ({
        id: c.id,
        date: c.created_at,
        mood_rating: c.mood_rating,
        progress_rating: c.progress_rating,
        blockers: c.blockers,
        wins: c.wins,
      })),
      statusChanges: report.detail.statusChanges.map((s) => ({
        id: s.id,
        date: s.created_at,
        request_title: s.request?.title || s.request_id,
        from: s.previous_status,
        to: s.new_status,
        note: s.note,
      })),
      appointments: report.detail.appointments.map((a) => ({
        id: a.id,
        date: a.scheduled_at,
        title: a.title,
        status: a.status,
      })),
      unresolved: report.unresolvedRequests.slice(0, 10).map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        is_emergency: r.is_emergency,
        age_days: r.ageDays,
      })),
    };

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'student-progress-summary',
        {
          body: {
            studentId: report.student?.user_id,
            studentName: report.student?.full_name || report.student?.email,
            range: report.range,
            evidence,
          },
        },
      );
      if (fnError) throw fnError;
      const progressMade = data?.progress_made || INSUFFICIENT;
      const areas = data?.areas_needing_improvement || INSUFFICIENT;
      const insufficient =
        progressMade === INSUFFICIENT && areas === INSUFFICIENT;
      const next: AISummarySections = {
        progressMade,
        areasNeedingImprovement: areas,
        unresolvedConcerns: deriveUnresolvedConcerns(report),
        recommendedNextSteps: deriveRecommendedNextSteps(report),
        evidenceUsed: data?.evidence_used,
        insufficientData: insufficient,
      };
      setSummary(next);
      onSummary?.(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate summary';
      setError(msg);
      onSummary?.(null);
    } finally {
      setLoading(false);
    }
  }, [report, onSummary]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI narrative summary
          </CardTitle>
          <div className="flex items-center gap-2">
            {summary && !summary.insufficientData && (
              <Badge variant="secondary" className="rounded-full">
                Grounded in evidence
              </Badge>
            )}
            <Button
              size="sm"
              onClick={generate}
              disabled={loading || !report.aiEligible}
              variant={summary ? 'outline' : 'default'}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : summary ? (
                'Regenerate'
              ) : (
                'Generate AI summary'
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!report.aiEligible && !summary && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Insufficient activity for AI narrative</AlertTitle>
            <AlertDescription>
              We need at least one note, check-in, status change, or appointment in
              the selected range. The deterministic sections above remain accurate.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Could not generate summary</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {summary?.insufficientData && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Insufficient data for this period</AlertTitle>
            <AlertDescription>
              The AI did not find enough grounded evidence to write a narrative.
              Deterministic data above is still valid.
            </AlertDescription>
          </Alert>
        )}

        {summary && !summary.insufficientData && (
          <>
            <Section title="Progress made" body={summary.progressMade} />
            <Section
              title="Areas needing improvement"
              body={summary.areasNeedingImprovement}
            />
            <Section
              title="Unresolved concerns"
              body={summary.unresolvedConcerns}
            />
            <Section
              title="Recommended next steps"
              body={summary.recommendedNextSteps}
            />
            {summary.evidenceUsed && summary.evidenceUsed.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-1 text-xs text-muted-foreground">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Evidence cited:
                {summary.evidenceUsed.slice(0, 12).map((id) => (
                  <code
                    key={id}
                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]"
                  >
                    {id}
                  </code>
                ))}
              </div>
            )}
          </>
        )}

        {!summary && !error && (
          <p className="text-sm text-muted-foreground">
            AI narrative is optional. It only summarizes the real notes, check-ins,
            and activity above — no fabrication. Click <em>Generate AI summary</em>{' '}
            to include it in the export.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm">{body}</p>
    </div>
  );
}
