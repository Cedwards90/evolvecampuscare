/**
 * Per-user form draft storage.
 *
 * Primary layer: window.localStorage (synchronous, per-device).
 * Secondary layer: Supabase `form_drafts` table (cross-device, survives
 * Chrome tab discard + localStorage eviction). See `useFormPersistence`.
 */

import { supabase } from '@/integrations/supabase/client';

const KEY_PREFIX = 'evolve:draft:';
const STORAGE_VERSION = 1;

export interface DraftEnvelope<T = unknown> {
  v: number;
  savedAt: string; // ISO
  values: T;
}

function storageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export function buildDraftKey(formKey: string, userId: string | null | undefined): string {
  return `${KEY_PREFIX}${formKey}:${userId || 'anon'}`;
}

/**
 * Strip File/Blob values before serialization — those can't survive JSON.
 */
export function sanitizeForStorage<T>(values: T): T {
  if (values == null || typeof values !== 'object') return values;
  if (values instanceof Date) return values.toISOString() as T;
  const clone: any = Array.isArray(values) ? [] : {};
  for (const [k, v] of Object.entries(values as any)) {
    if (typeof File !== 'undefined' && v instanceof File) continue;
    if (typeof Blob !== 'undefined' && v instanceof Blob) continue;
    clone[k] = v != null && typeof v === 'object' ? sanitizeForStorage(v) : v;
  }
  return clone;
}

export function saveDraft<T>(formKey: string, userId: string | null | undefined, values: T): boolean {
  if (!storageAvailable()) return false;
  const key = buildDraftKey(formKey, userId);
  const envelope: DraftEnvelope<T> = {
    v: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    values: sanitizeForStorage(values),
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch (err) {
    try {
      const toDrop: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(KEY_PREFIX) && k !== key) toDrop.push(k);
      }
      toDrop.forEach((k) => window.localStorage.removeItem(k));
      window.localStorage.setItem(key, JSON.stringify(envelope));
      return true;
    } catch {
      console.warn('formDraftStorage: unable to persist draft', err);
      return false;
    }
  }
}

export function loadDraft<T>(formKey: string, userId: string | null | undefined): DraftEnvelope<T> | null {
  if (!storageAvailable()) return null;
  const key = buildDraftKey(formKey, userId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed || typeof parsed !== 'object' || parsed.v !== STORAGE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(formKey: string, userId: string | null | undefined): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(buildDraftKey(formKey, userId));
  } catch {
    /* noop */
  }
}

/* ================= Server-side (Supabase) ================= */

export async function saveDraftRemote<T>(
  formKey: string,
  userId: string,
  values: T,
  savedAt: string,
): Promise<boolean> {
  try {
    const { error } = await supabase.from('form_drafts').upsert(
      {
        user_id: userId,
        form_key: formKey,
        values: sanitizeForStorage(values) as any,
        saved_at: savedAt,
      },
      { onConflict: 'user_id,form_key' },
    );
    return !error;
  } catch {
    return false;
  }
}

export async function loadDraftRemote<T>(
  formKey: string,
  userId: string,
): Promise<DraftEnvelope<T> | null> {
  try {
    const { data, error } = await supabase
      .from('form_drafts')
      .select('values, saved_at')
      .eq('user_id', userId)
      .eq('form_key', formKey)
      .maybeSingle();
    if (error || !data) return null;
    return {
      v: STORAGE_VERSION,
      savedAt: (data as any).saved_at,
      values: (data as any).values as T,
    };
  } catch {
    return null;
  }
}

export async function clearDraftRemote(formKey: string, userId: string): Promise<void> {
  try {
    await supabase
      .from('form_drafts')
      .delete()
      .eq('user_id', userId)
      .eq('form_key', formKey);
  } catch {
    /* noop */
  }
}

/**
 * Fire-and-forget beacon so the write survives tab discard. Uses
 * `sendBeacon` when possible; falls back to fetch with `keepalive`.
 */
export function beaconSaveDraft<T>(
  formKey: string,
  userId: string,
  values: T,
  savedAt: string,
  accessToken: string | null,
): void {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/form_drafts?on_conflict=user_id,form_key`;
  const body = JSON.stringify({
    user_id: userId,
    form_key: formKey,
    values: sanitizeForStorage(values),
    saved_at: savedAt,
  });
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  try {
    // sendBeacon can't set headers, so use fetch with keepalive for auth+upsert semantics.
    fetch(url, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey,
        Authorization: `Bearer ${accessToken || apikey}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body,
    }).catch(() => {});
  } catch {
    /* noop */
  }
}
