import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribes the current user (case manager) to live changes on
 * student_assignments so newly-assigned (or reassigned-away) students
 * appear immediately without a page reload.
 */
export function useRealtimeStudentAssignments(caseManagerId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!caseManagerId) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['my-students', caseManagerId] });
      queryClient.invalidateQueries({ queryKey: ['my-students'] });
      queryClient.invalidateQueries({ queryKey: ['student-folders'] });
      queryClient.invalidateQueries({ queryKey: ['case-manager-stats', caseManagerId] });
      queryClient.invalidateQueries({ queryKey: ['case-manager-stats'] });
      queryClient.invalidateQueries({ queryKey: ['my-assignment'] });
      queryClient.invalidateQueries({ queryKey: ['student-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    };

    const channel = supabase
      .channel(`student-assignments-cm-${caseManagerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'student_assignments' },
        (payload) => {
          const newCm = (payload.new as any)?.case_manager_id;
          const oldCm = (payload.old as any)?.case_manager_id;
          if (newCm === caseManagerId || oldCm === caseManagerId) {
            invalidate();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseManagerId, queryClient]);
}
