import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getQRSession, logQREvent, clearQRSession } from '@/hooks/useQRSession';
import type { RequestCategory, RequestPriority } from '@/types/database';

interface SubmitRequestParams {
  category: RequestCategory;
  title: string;
  description: string;
  priority: RequestPriority;
  isEmergency: boolean;
  userId: string;
  studentName: string;
  requestedAmount?: number;
}

export function useSubmitRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      category,
      title,
      description,
      priority,
      isEmergency,
      userId,
      studentName,
      requestedAmount,
    }: SubmitRequestParams) => {
      // Check if student has an assigned case manager
      const { data: assignment } = await supabase
        .from('student_assignments')
        .select('case_manager_id')
        .eq('student_id', userId)
        .maybeSingle();

      const hasAssignedCM = assignment?.case_manager_id;

      // Insert request into database with auto-assignment if student has a case manager
      const { data, error } = await supabase
        .from('support_requests')
        .insert({
          student_id: userId,
          category,
          title,
          description,
          priority,
          is_emergency: isEmergency,
          status: hasAssignedCM ? 'in_progress' : 'submitted',
          assigned_case_manager_id: hasAssignedCM || null,
          requested_amount: requestedAmount || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Always notify about the new request (notifies admins and/or assigned case manager)
      supabase.functions.invoke('notify-new-request', {
        body: {
          requestId: data.id,
          requestTitle: title,
          category,
          priority,
          isEmergency,
          studentId: userId,
          studentName,
        },
      }).catch((err) => {
        console.error('Failed to send new request notification:', err);
      });

      // If auto-assigned, create an internal note, send assignment notification, and send welcome message
      if (hasAssignedCM) {
        supabase.from('request_updates').insert({
          request_id: data.id,
          user_id: userId,
          note: 'Request automatically assigned based on student-case manager assignment.',
          is_internal: true,
          new_status: 'in_progress',
          previous_status: 'submitted',
        }).then(({ error: noteError }) => {
          if (noteError) console.error('Failed to create assignment note:', noteError);
        });

        // Also send assignment notification to the case manager
        supabase.functions.invoke('send-assignment-notification', {
          body: {
            requestId: data.id,
            caseManagerId: hasAssignedCM,
            requestTitle: title,
            requestCategory: category,
            requestPriority: priority,
            studentName,
            isAutoAssigned: true,
          },
        }).catch((err) => {
          console.error('Failed to send case manager notification:', err);
        });

        // Send automated welcome message so the student's message thread isn't empty
        supabase.from('staff_messages').insert({
          request_id: data.id,
          sender_id: hasAssignedCM,
          recipient_id: userId,
          student_id: userId,
          content: `Hi ${studentName.split(' ')[0] || 'there'}! Your request "${title}" has been received and assigned. You'll hear back within 24–48 hours. Feel free to message here if you have any questions in the meantime.`,
          subject: `Re: ${title}`,
        }).then(({ error: msgError }) => {
          if (msgError) console.error('Failed to send welcome message:', msgError);
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}
