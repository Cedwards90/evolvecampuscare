import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { invalidateForChange, REALTIME_TABLES } from '@/lib/realtimeRouter';

/**
 * Single source of truth for realtime sync. Mounted once at the app root.
 * Owns one Supabase channel per domain table and routes invalidations through
 * the centralized realtimeRouter. Also handles toast/browser notifications
 * for incoming staff messages and notifications targeted at the current user.
 *
 * RLS gates which payloads each subscriber actually receives, so this is
 * automatically permission-aware.
 */
export function useRealtimeBridge() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!user?.id) return;

    const ctx = { userId: user.id, role };

    const channel = supabase.channel(`realtime-bridge-${user.id}`);

    for (const table of REALTIME_TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload: any) => {
          const newRow = payload.new ?? null;
          const oldRow = payload.old ?? null;
          invalidateForChange(qc, table, newRow, oldRow, ctx);

          // Side effects for current user
          if (table === 'staff_messages' && payload.eventType === 'INSERT') {
            if (newRow?.recipient_id === user.id) {
              const subject = newRow.subject || 'New message';
              toast({ title: 'New message', description: subject });
              if (typeof document !== 'undefined' && document.hidden && 'Notification' in window) {
                if (Notification.permission === 'granted') {
                  try {
                    new Notification('New message', { body: subject, icon: '/favicon.ico' });
                  } catch {}
                } else if (Notification.permission !== 'denied') {
                  Notification.requestPermission().catch(() => {});
                }
              }
            }
          }
          if (table === 'notifications' && payload.eventType === 'INSERT') {
            if (newRow?.user_id === user.id) {
              toast({ title: newRow.title || 'Notification', description: newRow.message || '' });
            }
          }
        },
      );
    }

    channel.subscribe();

    // Re-sync on tab focus to recover from any missed events
    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        qc.invalidateQueries();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      supabase.removeChannel(channel);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [user?.id, role, qc, toast]);
}
