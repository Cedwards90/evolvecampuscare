import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Video, MoreHorizontal, ExternalLink, Loader2 } from 'lucide-react';
import { format, isPast, startOfDay } from 'date-fns';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AppointmentDialog } from '@/components/scheduling/AppointmentDialog';
import {
  useCancelAppointment,
  useStaffAppointments,
  type StaffAppointment,
} from '@/hooks/useStaffAppointments';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';

function AppointmentCard({ apt }: { apt: StaffAppointment }) {
  const [reschedOpen, setReschedOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancel = useCancelAppointment();

  const when = new Date(apt.scheduled_at);
  const past = isPast(when);
  const isCancelled = apt.status === 'cancelled';

  return (
    <>
      <Card className="border border-border/50 hover:shadow-sm transition-shadow">
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium truncate">{apt.title}</h3>
              {isCancelled && <Badge variant="secondary">Cancelled</Badge>}
              {!isCancelled && past && <Badge variant="outline">Past</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              <Link to={`/students/${apt.student_id}`} className="hover:underline">
                {apt.student?.full_name || apt.student?.email || 'Student'}
              </Link>
              <span className="mx-2">·</span>
              {format(when, 'EEE, MMM d · h:mm a')}
              <span className="mx-2">·</span>
              {apt.duration_minutes} min
            </p>
            {apt.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{apt.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {apt.meeting_link && !isCancelled && (
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <a href={apt.meeting_link} target="_blank" rel="noopener noreferrer">
                  <Video className="h-4 w-4 mr-1" /> Join
                </a>
              </Button>
            )}
            {!isCancelled && !past && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="rounded-full">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setReschedOpen(true)}>Reschedule</DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/students/${apt.student_id}`}>
                      <ExternalLink className="h-4 w-4 mr-2" /> View student
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setConfirmCancel(true)}
                  >
                    Cancel appointment
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>

      <AppointmentDialog
        open={reschedOpen}
        onOpenChange={setReschedOpen}
        appointment={{
          id: apt.id,
          student_id: apt.student_id,
          student_name: apt.student?.full_name || apt.student?.email,
          title: apt.title,
          description: apt.description,
          scheduled_at: apt.scheduled_at,
          duration_minutes: apt.duration_minutes,
        }}
      />

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              The student and case manager will be notified. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await cancel.mutateAsync(apt.id);
                setConfirmCancel(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancel.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Appointments() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const { filters: gf } = useGlobalFilters();

  const { data: rows = [], isLoading } = useStaffAppointments({ status });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((a) => {
      if (gf.organizationId.length && a.student?.organization_id && !gf.organizationId.includes(a.student.organization_id))
        return false;
      if (gf.caseManager.length && !gf.caseManager.includes(a.case_manager_id)) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        (a.student?.full_name || '').toLowerCase().includes(q) ||
        (a.student?.email || '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, gf]);

  const now = Date.now();
  const upcoming = filtered.filter((a) => a.status !== 'cancelled' && new Date(a.scheduled_at).getTime() >= startOfDay(new Date()).getTime());
  const past = filtered.filter((a) => a.status !== 'cancelled' && new Date(a.scheduled_at).getTime() < now).reverse();
  const cancelled = filtered.filter((a) => a.status === 'cancelled');

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageHeader
          title="Appointments"
          description="Schedule, reschedule, or cancel meetings with students."
          actions={
            <AppointmentDialog
              trigger={
                <Button className="rounded-full">
                  <CalendarDays className="h-4 w-4 mr-2" /> New appointment
                </Button>
              }
            />
          }
        />

        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search by title, student name, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled ({cancelled.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-3 mt-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : upcoming.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No upcoming appointments" description="Click New appointment to schedule one." />
            ) : (
              upcoming.map((a) => <AppointmentCard key={a.id} apt={a} />)
            )}
          </TabsContent>
          <TabsContent value="past" className="space-y-3 mt-4">
            {past.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No past appointments" description="" />
            ) : (
              past.map((a) => <AppointmentCard key={a.id} apt={a} />)
            )}
          </TabsContent>
          <TabsContent value="cancelled" className="space-y-3 mt-4">
            {cancelled.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No cancelled appointments" description="" />
            ) : (
              cancelled.map((a) => <AppointmentCard key={a.id} apt={a} />)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
}
