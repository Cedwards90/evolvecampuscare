import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, addDays, setHours, setMinutes } from 'date-fns';
import { CalendarDays, Loader2, Clock, Video } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StudentPicker } from '@/components/admin/StudentPicker';
import { useScheduleMeeting } from '@/hooks/useScheduleMeeting';
import { useRescheduleAppointment } from '@/hooks/useStaffAppointments';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  date: z.date({ required_error: 'Please select a date' }),
  time: z.string().min(1, 'Please select a time'),
  duration: z.number().min(15).max(240),
});
type FormData = z.infer<typeof schema>;

const timeSlots = Array.from({ length: 24 }, (_, i) => {
  const hour = Math.floor(i / 2) + 7;
  const minute = (i % 2) * 30;
  return {
    value: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
    label: format(setMinutes(setHours(new Date(), hour), minute), 'h:mm a'),
  };
});

const durationOptions = [15, 30, 45, 60, 90, 120].map((v) => ({
  value: v,
  label: v < 60 ? `${v} minutes` : `${v / 60} hour${v > 60 ? 's' : ''}`,
}));

interface Props {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Preset student. If omitted, dialog shows a student picker (for staff). */
  studentId?: string;
  studentName?: string;
  requestId?: string;
  /** Reschedule mode */
  appointment?: {
    id: string;
    student_id: string;
    student_name?: string;
    title: string;
    description?: string | null;
    scheduled_at: string;
    duration_minutes: number;
  };
}

export function AppointmentDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  studentId: presetStudentId,
  studentName: presetStudentName,
  requestId,
  appointment,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (o: boolean) => {
    onOpenChange?.(o);
    if (controlledOpen === undefined) setInternalOpen(o);
  };

  const isReschedule = !!appointment;
  const { user } = useAuth();
  const schedule = useScheduleMeeting();
  const reschedule = useRescheduleAppointment();

  const [pickedStudentId, setPickedStudentId] = useState<string | undefined>(
    presetStudentId ?? appointment?.student_id,
  );
  const [pickedStudentName, setPickedStudentName] = useState<string | undefined>(
    presetStudentName ?? appointment?.student_name,
  );

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: appointment?.title ?? `Meeting with ${presetStudentName || 'student'}`,
      description: appointment?.description ?? '',
      duration: appointment?.duration_minutes ?? 30,
      date: appointment ? new Date(appointment.scheduled_at) : undefined,
      time: appointment ? format(new Date(appointment.scheduled_at), 'HH:mm') : '',
    },
  });

  // If a preset student changes (opened from a different row), re-sync title.
  useEffect(() => {
    if (!isReschedule && presetStudentName) {
      form.setValue('title', `Meeting with ${presetStudentName}`);
      setPickedStudentId(presetStudentId);
      setPickedStudentName(presetStudentName);
    }
  }, [presetStudentId, presetStudentName, isReschedule, form]);

  const onSubmit = async (data: FormData) => {
    const [h, m] = data.time.split(':').map(Number);
    const scheduledAt = setMinutes(setHours(data.date, h), m);

    if (isReschedule && appointment) {
      await reschedule.mutateAsync({
        appointmentId: appointment.id,
        scheduledAt,
        durationMinutes: data.duration,
        title: data.title,
        description: data.description,
      });
    } else {
      if (!pickedStudentId) {
        form.setError('root', { message: 'Please select a student' });
        return;
      }
      await schedule.mutateAsync({
        studentId: pickedStudentId,
        caseManagerId: user!.id,
        title: data.title,
        description: data.description,
        scheduledAt,
        durationMinutes: data.duration,
        requestId,
      });
    }

    form.reset();
    setOpen(false);
  };

  const selectedDate = form.watch('date');
  const pending = schedule.isPending || reschedule.isPending;
  const showPicker = !isReschedule && !presetStudentId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            {isReschedule ? 'Reschedule appointment' : 'Schedule appointment'}
          </DialogTitle>
          <DialogDescription>
            {isReschedule
              ? 'Update the date, time, or details. Both parties will be notified.'
              : 'Both parties will receive email invitations.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {showPicker && (
            <div className="space-y-2">
              <Label>Student</Label>
              <StudentPicker
                value={pickedStudentId}
                onChange={(id, name) => {
                  setPickedStudentId(id);
                  setPickedStudentName(name);
                  form.setValue('title', `Meeting with ${name}`);
                }}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="meeting-title">Title</Label>
            <Input id="meeting-title" {...form.register('title')} />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !selectedDate && 'text-muted-foreground')}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && form.setValue('date', d)}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0)) || d > addDays(new Date(), 180)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.date && (
                <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Time</Label>
              <Select value={form.watch('time')} onValueChange={(v) => form.setValue('time', v)}>
                <SelectTrigger>
                  <Clock className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.time && (
                <p className="text-sm text-destructive">{form.formState.errors.time.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Duration</Label>
            <Select
              value={form.watch('duration').toString()}
              onValueChange={(v) => form.setValue('duration', Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {durationOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value.toString()}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-description">Notes (optional)</Label>
            <Textarea id="meeting-description" rows={3} {...form.register('description')} />
          </div>

          {form.formState.errors.root?.message && (
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isReschedule ? 'Save changes' : 'Schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
