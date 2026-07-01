import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, addDays, setHours, setMinutes } from 'date-fns';
import { 
  CalendarDays, 
  Loader2,
  Clock,
  Video,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useScheduleMeeting } from '@/hooks/useScheduleMeeting';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { DraftIndicator } from '@/components/forms/DraftIndicator';

const meetingSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  date: z.date({ required_error: 'Please select a date' }),
  time: z.string().min(1, 'Please select a time'),
  duration: z.number().min(15).max(120),
});

type MeetingFormData = z.infer<typeof meetingSchema>;

interface ScheduleMeetingDialogProps {
  studentId: string;
  studentName: string;
  requestId?: string;
  trigger?: React.ReactNode;
}

const timeSlots = Array.from({ length: 20 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minute = (i % 2) * 30;
  return {
    value: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
    label: format(setMinutes(setHours(new Date(), hour), minute), 'h:mm a'),
  };
});

const durationOptions = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

export function ScheduleMeetingDialog({ 
  studentId, 
  studentName, 
  requestId,
  trigger 
}: ScheduleMeetingDialogProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const scheduleMeeting = useScheduleMeeting();

  const form = useForm<MeetingFormData>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      title: `Meeting with ${studentName}`,
      description: '',
      duration: 30,
    },
  });
  const watchedTitle = form.watch('title');
  const watchedDescription = form.watch('description');
  const watchedDate = form.watch('date');
  const watchedTime = form.watch('time');
  const watchedDuration = form.watch('duration');
  const draftValues = {
    title: watchedTitle || `Meeting with ${studentName}`,
    description: watchedDescription || '',
    date: watchedDate,
    time: watchedTime || '',
    duration: watchedDuration || 30,
  };
  const { clear: clearDraft, savedAt, hasDraft } = useFormPersistence(
    `schedule-meeting:${studentId}:${requestId || 'general'}`,
    draftValues,
    (v) => {
      form.reset({
        title: v.title || `Meeting with ${studentName}`,
        description: v.description || '',
        duration: Number(v.duration) || 30,
        date: v.date ? new Date(v.date) : undefined,
        time: v.time || '',
      });
      setOpen(true);
    },
    {
      enabled: open,
      label: `meeting notes for ${studentName}`,
      shouldPersist: (v) => !!(v.description?.trim() || v.date || v.time),
    },
  );

  const onSubmit = async (data: MeetingFormData) => {
    const [hours, minutes] = data.time.split(':').map(Number);
    const scheduledAt = setMinutes(setHours(data.date, hours), minutes);

    await scheduleMeeting.mutateAsync({
      studentId,
      caseManagerId: user!.id,
      title: data.title,
      description: data.description,
      scheduledAt,
      durationMinutes: data.duration,
      requestId,
    });

    form.reset();
    clearDraft();
    setOpen(false);
  };

  const selectedDate = form.watch('date');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <CalendarDays className="h-4 w-4 mr-2" />
            Schedule Meeting
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Schedule Meeting
          </DialogTitle>
          <DialogDescription>
            Schedule a meeting with {studentName}. Both parties will receive calendar invitations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meeting-title">Meeting Title</Label>
            <Input
              id="meeting-title"
              placeholder="Enter meeting title..."
              {...form.register('title')}
            />
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
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && form.setValue('date', date)}
                    disabled={(date) => date < new Date() || date > addDays(new Date(), 60)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.date && (
                <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Time</Label>
              <Select 
                value={form.watch('time')} 
                onValueChange={(value) => form.setValue('time', value)}
              >
                <SelectTrigger>
                  <Clock className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
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
              onValueChange={(value) => form.setValue('duration', Number(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {durationOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-description">Description (Optional)</Label>
            <Textarea
              id="meeting-description"
              placeholder="Add meeting agenda or notes..."
              rows={3}
              {...form.register('description')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={scheduleMeeting.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={scheduleMeeting.isPending}>
              {scheduleMeeting.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Schedule Meeting
            </Button>
          </DialogFooter>
          <DraftIndicator savedAt={savedAt} hasDraft={hasDraft} onDiscard={() => { clearDraft(); form.reset({ title: `Meeting with ${studentName}`, description: '', duration: 30 }); }} className="justify-end" />
        </form>
      </DialogContent>
    </Dialog>
  );
}
