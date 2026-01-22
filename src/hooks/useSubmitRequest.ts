import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RequestCategory, RequestPriority } from '@/types/database';

interface SubmitRequestParams {
  category: RequestCategory;
  title: string;
  description: string;
  priority: RequestPriority;
  isEmergency: boolean;
  userId: string;
  studentName: string;
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
    }: SubmitRequestParams) => {
      // Insert request into database
      const { data, error } = await supabase
        .from('support_requests')
        .insert({
          student_id: userId,
          category,
          title,
          description,
          priority,
          is_emergency: isEmergency,
          status: 'submitted',
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger admin notification (fire and forget)
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
        console.error('Failed to send admin notification:', err);
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}
