import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Mount once at app root (inside AuthProvider). Subscribes to changes on
 * support_requests, request_updates, request_attachments and invalidates
 * relevant React Query caches so the UI updates instantly for all users.
 * RLS limits which rows each subscriber actually receives.
 */
export function useRealtimeRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const invalidateAll = (requestId?: string, studentId?: string) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-students'] });
      queryClient.invalidateQueries({ queryKey: ['case-manager-stats'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['filter-options'] });
      queryClient.invalidateQueries({ queryKey: ['workload-analytics'] });
      if (requestId) queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      if (studentId) queryClient.invalidateQueries({ queryKey: ['student-detail', studentId] });
    };

    const channel = supabase
      .channel('realtime-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_requests' }, (payload: any) => {
        const row = (payload.new || payload.old) as any;
        invalidateAll(row?.id, row?.student_id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'request_updates' }, (payload: any) => {
        const row = (payload.new || payload.old) as any;
        invalidateAll(row?.request_id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'request_attachments' }, (payload: any) => {
        const row = (payload.new || payload.old) as any;
        invalidateAll(row?.request_id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}
