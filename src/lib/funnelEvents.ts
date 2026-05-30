import { supabase } from '@/integrations/supabase/client';

export type FunnelEventType =
  | 'qr_scan'
  | 'signup_started'
  | 'signup_completed'
  | 'nda_accepted'
  | 'profile_completed'
  | 'intake_completed'
  | 'request_submitted'
  | 'meeting_scheduled'
  | 'placement_recorded';

interface LogParams {
  eventType: FunnelEventType;
  userId?: string | null;
  organizationId?: string | null;
  qrSessionId?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Fire-and-forget participant funnel event logger.
 * Never throws; failures are logged to console only so they don't
 * disrupt the calling flow.
 */
export async function logFunnelEvent(params: LogParams): Promise<void> {
  try {
    await supabase.from('participant_funnel_events').insert({
      event_type: params.eventType,
      user_id: params.userId ?? null,
      organization_id: params.organizationId ?? null,
      qr_session_id: params.qrSessionId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.warn('[funnel] failed to log event', params.eventType, err);
  }
}
