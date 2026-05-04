import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SESSION_KEY = 'qr_session_id';
const CODE_KEY = 'qr_code_id';

function uuid() {
  // RFC4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getQRSession(): { sessionId: string | null; qrCodeId: string | null } {
  if (typeof window === 'undefined') return { sessionId: null, qrCodeId: null };
  return {
    sessionId: sessionStorage.getItem(SESSION_KEY),
    qrCodeId: sessionStorage.getItem(CODE_KEY),
  };
}

export function clearQRSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(CODE_KEY);
}

export function startQRSession(qrCodeId: string): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  const existingCode = sessionStorage.getItem(CODE_KEY);
  if (!sessionId || existingCode !== qrCodeId) {
    sessionId = uuid();
    sessionStorage.setItem(SESSION_KEY, sessionId);
    sessionStorage.setItem(CODE_KEY, qrCodeId);
  }
  return sessionId;
}

export type QREventType =
  | 'scan'
  | 'auth_required'
  | 'auth_completed'
  | 'action_selected'
  | 'action_started'
  | 'action_completed';

export type QRActionKind = 'request' | 'meeting';

export async function logQREvent(params: {
  eventType: QREventType;
  actionKind?: QRActionKind;
  targetId?: string;
  qrCodeId?: string;
  sessionId?: string;
}) {
  const { sessionId: storedSession, qrCodeId: storedCode } = getQRSession();
  const sessionId = params.sessionId || storedSession;
  const qrCodeId = params.qrCodeId || storedCode;
  if (!sessionId || !qrCodeId) return;

  const { data: userData } = await supabase.auth.getUser();
  await supabase.from('qr_scan_events').insert({
    qr_code_id: qrCodeId,
    session_id: sessionId,
    user_id: userData.user?.id || null,
    event_type: params.eventType,
    action_kind: params.actionKind || null,
    target_id: params.targetId || null,
    user_agent: navigator.userAgent.slice(0, 500),
  });
}

export function useQRSession() {
  const log = useCallback(logQREvent, []);
  return { log, get: getQRSession, start: startQRSession, clear: clearQRSession };
}
