import { format } from 'date-fns';
import { AlertCircle, FileText, Inbox } from 'lucide-react';
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
import type { InteractionReport } from '@/hooks/useInteractionReport';
import { LifeSkillsProgressBlock } from '@/components/reports/LifeSkillsProgressBlock';
import { ImpactMetricsBlock } from '@/components/reports/ImpactMetricsBlock';
import { formatCurrency } from '@/lib/utils';

interface Props {
  data: InteractionReport | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-display font-semibold">{value}</div>
    </div>
  );
}

export function ReportPreview({ data, isLoading, error, isFetching }: Props) {
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
          <p>Select a date range to generate the report.</p>
        </CardContent>
      </Card>
    );
  }

  const empty =
    data.summary.requestsOpened === 0 &&
    data.summary.requestsResolved === 0 &&
    data.contacts.messagesSent === 0 &&
    data.notes.total === 0 &&
    data.followUps.total === 0 &&
    data.statusChanges.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold">
            {data.caseManager?.full_name || 'Case Manager'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {format(new Date(data.range.from), 'PP')} – {format(new Date(data.range.to), 'PP')}
          </p>
        </div>
        {isFetching && (
          <Badge variant="secondary" className="rounded-full">Updating…</Badge>
        )}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Active students" value={data.summary.activeStudents} />
        <StatTile label="Requests opened" value={data.summary.requestsOpened} />
        <StatTile label="Requests resolved" value={data.summary.requestsResolved} />
        <StatTile label="Avg resolution (hrs)" value={data.summary.avgResolutionHours} />
        <StatTile label="Unresolved" value={data.summary.unresolvedCount} />
        <StatTile label="Emergency" value={data.summary.emergencyCount} />
      </section>

      {empty && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
            <Inbox className="h-8 w-8" />
            <p>No activity in this period.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Student contacts</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-sm">
            <div><div className="text-muted-foreground">Sent</div><div className="text-xl font-semibold">{data.contacts.messagesSent}</div></div>
            <div><div className="text-muted-foreground">Received</div><div className="text-xl font-semibold">{data.contacts.messagesReceived}</div></div>
            <div><div className="text-muted-foreground">Distinct</div><div className="text-xl font-semibold">{data.contacts.distinctStudents}</div></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Notes & surveys</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-sm">
            <div><div className="text-muted-foreground">Notes</div><div className="text-xl font-semibold">{data.notes.total}</div></div>
            <div><div className="text-muted-foreground">Surveys sent</div><div className="text-xl font-semibold">{data.surveys.sent}</div></div>
            <div><div className="text-muted-foreground">Completed</div><div className="text-xl font-semibold">{data.surveys.completed}</div></div>
          </CardContent>
        </Card>
      </div>

      <LifeSkillsProgressBlock data={data.lifeSkills} title="Life Skills — caseload average" description="Pre vs post confidence across your assigned caseload." />

      <ImpactMetricsBlock metrics={data.impactMetrics} />

      <Card>
        <CardHeader><CardTitle className="text-base">Status changes</CardTitle></CardHeader>
        <CardContent>
          {data.statusChanges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No status changes recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.statusChanges.slice(0, 25).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap text-xs">{format(new Date(s.created_at), 'PP p')}</TableCell>
                      <TableCell><Badge variant="outline">{s.previous_status || '—'}</Badge></TableCell>
                      <TableCell><Badge>{s.new_status || '—'}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.note || ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.statusChanges.length > 25 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing 25 of {data.statusChanges.length}. Full list included in export.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Follow-ups (meetings)</CardTitle></CardHeader>
        <CardContent>
          {data.followUps.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.followUps.rows.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-xs">{format(new Date(a.scheduled_at), 'PP p')}</TableCell>
                      <TableCell>{a.title}</TableCell>
                      <TableCell><Badge variant="secondary">{a.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Unresolved items</CardTitle></CardHeader>
        <CardContent>
          {data.unresolved.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unresolved items. 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.unresolved.slice(0, 25).map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="whitespace-nowrap text-xs">{format(new Date(req.created_at), 'PP')}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{req.title}</TableCell>
                      <TableCell>{req.student?.full_name || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{(req.student as any)?.organization_name || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{req.priority}</Badge></TableCell>
                      <TableCell><Badge>{req.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.unresolved.length > 25 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing 25 of {data.unresolved.length}. Full list included in export.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
