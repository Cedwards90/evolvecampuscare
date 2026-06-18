import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, Square, Loader2, Clock, Calendar as CalIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActiveShift, useClockIn, useClockOut, useCancelShift } from '@/hooks/useActiveShift';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { format, startOfWeek, endOfWeek, isToday, parseISO } from 'date-fns';

const SERVICE_TYPES = [
  'case_management',
  'direct_service',
  'documentation',
  'meeting',
  'outreach',
  'travel',
  'other',
] as const;

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
};

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function ElapsedTimer({ start }: { start: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, now - new Date(start).getTime());
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return (
    <span className="font-mono tabular-nums text-3xl">
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

export default function TimeTracking() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: activeShift, isLoading: shiftLoading } = useActiveShift(user?.id);
  const { data: entries = [] } = useTimeEntries({ mineOnly: true });
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const cancelShift = useCancelShift();

  const [serviceType, setServiceType] = useState<string>('case_management');
  const [notes, setNotes] = useState('');
  const [outNotes, setOutNotes] = useState('');

  const handleClockIn = async () => {
    try {
      await clockIn.mutateAsync({ service_type: serviceType, notes: notes || null });
      toast({ title: 'Clocked in', description: 'Your shift has started.' });
      setNotes('');
    } catch (e: any) {
      toast({ title: 'Could not clock in', description: e.message, variant: 'destructive' });
    }
  };

  const handleClockOut = async () => {
    try {
      await clockOut.mutateAsync({ notes: outNotes || null, billable: true });
      toast({ title: 'Clocked out', description: 'Time entry submitted for review.' });
      setOutNotes('');
    } catch (e: any) {
      toast({ title: 'Could not clock out', description: e.message, variant: 'destructive' });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelShift.mutateAsync();
      toast({ title: 'Shift discarded' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const todayMins = entries
    .filter((e) => isToday(parseISO(e.entry_date)))
    .reduce((acc, e) => acc + e.duration_minutes, 0);
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  const weekMins = entries
    .filter((e) => {
      const d = parseISO(e.entry_date);
      return d >= weekStart && d <= weekEnd;
    })
    .reduce((acc, e) => acc + e.duration_minutes, 0);

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageHeader
          title="Time Tracking"
          description="Clock in and out to log your case management hours."
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {activeShift ? 'Active shift' : 'Start a shift'}
            </CardTitle>
            <CardDescription>
              {activeShift
                ? `Started ${format(new Date(activeShift.start_time), 'PPpp')}`
                : 'Pick a service type, add optional notes, then clock in.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {shiftLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeShift ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-6 bg-muted/40 rounded-lg">
                  <ElapsedTimer start={activeShift.start_time} />
                  <p className="text-sm text-muted-foreground mt-2 capitalize">
                    {activeShift.service_type.replace('_', ' ')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="out-notes">Add notes (optional)</Label>
                  <Textarea
                    id="out-notes"
                    placeholder="What did you work on?"
                    value={outNotes}
                    onChange={(e) => setOutNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="lg"
                    onClick={handleClockOut}
                    disabled={clockOut.isPending}
                    className="flex-1 min-w-[160px]"
                  >
                    {clockOut.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Square className="h-4 w-4 mr-2" />
                    )}
                    Clock out
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={cancelShift.isPending}
                  >
                    Discard shift
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Service type</Label>
                    <Select value={serviceType} onValueChange={setServiceType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Starting notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Briefly describe what you're starting on..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button
                  size="lg"
                  onClick={handleClockIn}
                  disabled={clockIn.isPending}
                  className="w-full"
                >
                  {clockIn.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Clock in
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Today</CardDescription>
              <CardTitle className="text-3xl">{formatDuration(todayMins)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground flex items-center gap-2">
              <CalIcon className="h-4 w-4" />
              Logged today
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>This week</CardDescription>
              <CardTitle className="text-3xl">{formatDuration(weekMins)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground flex items-center gap-2">
              <CalIcon className="h-4 w-4" />
              {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent entries</CardTitle>
            <CardDescription>Your most recent submitted time entries.</CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No time entries yet. Clock in to get started.
              </p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.slice(0, 25).map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{format(parseISO(e.entry_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="capitalize">
                          {e.service_type.replace('_', ' ')}
                        </TableCell>
                        <TableCell>{formatDuration(e.duration_minutes)}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[e.status]}>{e.status}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-[280px] truncate text-muted-foreground text-sm">
                          {e.notes || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
