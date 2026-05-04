import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getQRSession, logQREvent, clearQRSession } from '@/hooks/useQRSession';

interface ScheduleMeetingParams {
  studentId: string;
  caseManagerId: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  durationMinutes: number;
  requestId?: string;
}

export function useScheduleMeeting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: ScheduleMeetingParams) => {
      const { sessionId: qrSessionId } = getQRSession();
      // Create appointment in database
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          student_id: params.studentId,
          case_manager_id: params.caseManagerId,
          title: params.title,
          description: params.description || null,
          scheduled_at: params.scheduledAt.toISOString(),
          duration_minutes: params.durationMinutes,
          request_id: params.requestId || null,
          status: 'scheduled',
          qr_session_id: qrSessionId || null,
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      if (qrSessionId) {
        logQREvent({ eventType: 'action_completed', actionKind: 'meeting', targetId: appointment.id }).finally(() => clearQRSession());
      }

      // Call edge function to create calendar event and send notifications
      const { data: calendarResult, error: calendarError } = await supabase.functions.invoke('create-calendar-event', {
        body: {
          appointmentId: appointment.id,
          studentId: params.studentId,
          caseManagerId: params.caseManagerId,
          title: params.title,
          description: params.description,
          startTime: params.scheduledAt.toISOString(),
          durationMinutes: params.durationMinutes,
        },
      });

      if (calendarError) {
        console.error('Failed to create calendar event:', calendarError);
        // Don't throw - appointment is created, just calendar sync failed
      } else if (calendarResult?.meetingLink) {
        // Update appointment with meeting link
        await supabase
          .from('appointments')
          .update({ meeting_link: calendarResult.meetingLink })
          .eq('id', appointment.id);
      }

      return appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['student-detail'] });
      toast({
        title: 'Meeting scheduled',
        description: 'Calendar invites have been sent to all participants.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to schedule meeting',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useCancelMeeting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['student-detail'] });
      toast({
        title: 'Meeting cancelled',
        description: 'The meeting has been cancelled and participants notified.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to cancel meeting',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
