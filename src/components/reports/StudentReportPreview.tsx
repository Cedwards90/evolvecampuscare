import { format } from 'date-fns';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Inbox,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { StudentProgressReport } from '@/hooks/useStudentProgressReport';
import type { RiskSeverity } from '@/lib/studentProgressRules';

interface Props {
  data: StudentProgressReport | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-display font-semibold">{value}</div>
    </div>
  );
}

function severityVariant(s: RiskSeverity): 'destructive' | 'default' | 'secondary' {
  if (s === 'high') return 'destructive';
  if (s === 'medium') return 'default';
  return 'secondary';
}

export function StudentReportPreview({
  data,
  isLoading,
  isFetching,
  error,
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Could not load report</AlertTitle>
        <AlertDescription>
          {(error as Error)?.message || 'Please try again.'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
          <FileText className="h-8 w-8" />
          <p>Select a student and date range to generate the report.</p>
        </CardContent>
      </Card>
    );
  }

  const empty =
    data.summary.requestsOpened === 0 &&
    data.summary.requestsResolved === 0 &&
    data.summary.notesAdded === 0 &&
    data.summary.messagesSent === 0 &&
    data.summary.messagesReceived === 0 &&
    data.summary.appointmentsCompleted === 0 &&
    data.detail.statusChanges.length === 0 &&
    data.detail.checkIns.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold">
            {data.student?.full_name || data.student?.email || 'Student'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {format(new Date(data.range.from), 'PP')} –{' '}
            {format(new Date(data.range.to), 'PP')}
            {data.caseManager && (
              <>  •  CM: {data.caseManager.full_name || data.caseManager.email}</>
            )}
          </p>
        </div>
        {isFetching && (
          <Badge variant="secondary" className="rounded-full">
            Updating…
          </Badge>
        )}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Requests opened" value={data.summary.requestsOpened} />
        <StatTile label="Requests resolved" value={data.summary.requestsResolved} />
        <StatTile label="Unresolved" value={data.summary.requestsUnresolved} />
        <StatTile label="Open emergencies" value={data.summary.emergencyOpenCount} />
        <StatTile label="Notes added" value={data.summary.notesAdded} />
        <StatTile
          label="Messages (sent / received)"
          value={`${data.summary.messagesSent} / ${data.summary.messagesReceived}`}
        />
        <StatTile
          label="Appointments (done / upcoming)"
          value={`${data.summary.appointmentsCompleted} / ${data.summary.appointmentsUpcoming}`}
        />
        <StatTile label="Check-ins" value={data.summary.checkInsInRange} />
        <StatTile
          label="Surveys (sent / completed)"
          value={`${data.summary.surveysSentInRange} / ${data.summary.surveysCompletedInRange}`}
        />
      </section>

      {empty && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
            <Inbox className="h-8 w-8" />
            <p>No activity for this student in the selected period.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Risk indicators
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.risks.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              No risk indicators detected from the available data.
            </div>
          ) : (
            <ul className="space-y-2">
              {data.risks.map((r) => (
                <li
                  key={r.key}
                  className="flex flex-col gap-1 rounded-lg border border-border/60 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={severityVariant(r.severity)} className="rounded-full">
                      {r.severity}
                    </Badge>
                    <span className="font-medium">{r.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommended action items</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.actionItems.map((a) => (
              <li
                key={a.key}
                className="flex items-start gap-2 rounded-lg border border-border/60 p-3"
              >
                <Badge variant={severityVariant(a.severity)} className="rounded-full">
                  {a.severity}
                </Badge>
                <span className="text-sm">{a.text}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unresolved requests</CardTitle>
        </CardHeader>
        <CardContent>
          {data.unresolvedRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unresolved requests. 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Age (d)</TableHead>
                    <TableHead>Last update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.unresolvedRequests.slice(0, 25).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(r.created_at), 'PP')}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate">
                        {r.is_emergency && (
                          <Badge variant="destructive" className="mr-2 rounded-full">
                            Emergency
                          </Badge>
                        )}
                        {r.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.ageDays}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.lastUpdateAt
                          ? format(new Date(r.lastUpdateAt), 'PP')
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.unresolvedRequests.length > 25 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing 25 of {data.unresolvedRequests.length}. Full list included in
                  export.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status changes</CardTitle>
        </CardHeader>
        <CardContent>
          {data.detail.statusChanges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No status changes in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.detail.statusChanges.slice(0, 25).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(s.created_at), 'PP p')}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {s.request?.title || s.request_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.previous_status || '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge>{s.new_status || '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.note || ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Case notes</CardTitle>
        </CardHeader>
        <CardContent>
          {data.detail.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No notes recorded in this period.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.detail.notes.slice(0, 15).map((n) => (
                <li
                  key={n.id}
                  className="rounded-lg border border-border/60 p-3 text-sm"
                >
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="rounded-full">
                      {n.note_type}
                    </Badge>
                    {format(new Date(n.created_at), 'PP p')}
                  </div>
                  <div className="whitespace-pre-wrap">{n.content}</div>
                </li>
              ))}
              {data.detail.notes.length > 15 && (
                <p className="text-xs text-muted-foreground">
                  Showing 15 of {data.detail.notes.length}. Full list included in export.
                </p>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent check-ins</CardTitle>
          </CardHeader>
          <CardContent>
            {data.detail.checkIns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No check-ins in range.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.detail.checkIns.slice(0, 5).map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-border/60 p-3"
                  >
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(c.created_at), 'PP')}
                    </div>
                    <div className="mt-1">
                      Mood {c.mood_rating}/5 • Progress {c.progress_rating}/5
                    </div>
                    {c.wins && (
                      <div className="mt-1 text-xs">
                        <span className="font-medium">Wins:</span> {c.wins}
                      </div>
                    )}
                    {c.blockers && (
                      <div className="mt-1 text-xs">
                        <span className="font-medium">Blockers:</span> {c.blockers}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {data.detail.appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No appointments in this period.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.detail.appointments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 p-3"
                  >
                    <div>
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(a.scheduled_at), 'PP p')}
                      </div>
                    </div>
                    <Badge variant="secondary">{a.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
