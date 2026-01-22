import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useRealtimeMessages() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    // Enable for all authenticated users
    if (!user?.id) {
      return;
    }

    const channel = supabase
      .channel('staff-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'staff_messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['messages'] });
          queryClient.invalidateQueries({ queryKey: ['messages-unread'] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });

          // Fetch sender profile for notification
          const { data: sender } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', payload.new.sender_id)
            .single();

          const senderName = sender?.full_name || 'A staff member';
          const subject = payload.new.subject || 'New message';

          // Show toast notification
          toast({
            title: senderName,
            description: subject,
          });

          // Browser notification if tab is not focused
          if (document.hidden && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              new Notification(`New message from ${senderName}`, {
                body: subject,
                icon: '/favicon.ico',
              });
            } else if (Notification.permission !== 'denied') {
              // Request permission for future notifications
              Notification.requestPermission();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, role, queryClient, toast]);
}
