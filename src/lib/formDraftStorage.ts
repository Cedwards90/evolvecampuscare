/**
 * Per-user form draft storage.
 *
 * Primary layer: window.localStorage (synchronous, per-device).
 * Secondary layer: Supabase `form_drafts` table (cross-device, survives
 * Chrome tab discard + localStorage eviction). See `useFormPersistence`.
 *
 * Reliability contract
 * --------------------
 * A draft is never sent to the server without a real user session. Earlier
 * versions fell back to the publishable key when the access token was
 * unavailable, which produced a write that RLS rejected — the draft looked
 * saved but was silently lost. Now an unauthenticated flush is queued locally
 * (`OUTBOX_KEY`) and retried on the next load, and every remote attempt
 * reports an explicit outcome so the UI can show Saved locally / Synced /
 * Sync failed.
 */

import { supabase } from '@/integrations/supabase/client';

const KEY_PREFIX = 'evolve:draft:';
const OUTBOX_KEY = 'evolve:draft-outbox:v1';
const STORAGE_VERSION = 1;

/** Drafts older than this are dropped locally, matching the DB retention. */
const LOCAL_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type RemoteSyncOutcome = 'synced' | 'queued' | 'failed';

export interface DraftEnvelope<T = unknown> {
  v: number;
  savedAt: string; // ISO
  values: T;
}

interface OutboxEntry {
  formKey: string;
  userId: string;
  savedAt: string;
  values: unknown;
  queuedAt: string;
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
    // Enforce local retention so stale sensitive drafts don't linger.
    if (Date.now() - new Date(parsed.savedAt).getTime() > LOCAL_RETENTION_MS) {
      clearDraft(formKey, userId);
      return null;
    }
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
  dropFromOutbox(formKey, userId || '');
}

/* ================= Server-side (Supabase) ================= */

export async function saveDraftRemote<T>(
  formKey: string,
  userId: string,
  values: T,
  savedAt: string,
): Promise<RemoteSyncOutcome> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) {
      // No session: queue rather than issue a write we know RLS will reject.
      queueForRetry({ formKey, userId, savedAt, values: sanitizeForStorage(values), queuedAt: new Date().toISOString() });
      return 'queued';
    }
    const { error } = await supabase.from('form_drafts').upsert(
      {
        user_id: userId,
        form_key: formKey,
        values: sanitizeForStorage(values) as any,
        saved_at: savedAt,
      },
      { onConflict: 'user_id,form_key' },
    );
    if (error) {
      console.warn('formDraftStorage: remote draft save failed', error.message);
      queueForRetry({ formKey, userId, savedAt, values: sanitizeForStorage(values), queuedAt: new Date().toISOString() });
      return 'failed';
    }
    dropFromOutbox(formKey, userId);
    return 'synced';
  } catch (err) {
    console.warn('formDraftStorage: remote draft save threw', err);
    queueForRetry({ formKey, userId, savedAt, values: sanitizeForStorage(values), queuedAt: new Date().toISOString() });
    return 'failed';
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
  dropFromOutbox(formKey, userId);
}

/**
 * Flush that survives tab discard. `sendBeacon` cannot set the Authorization
 * header, so this uses `fetch` with `keepalive`. Without a live access token
 * the write is queued for retry instead of being sent with the publishable
 * key, which would fail RLS and lose the draft without any signal.
 */
export function beaconSaveDraft<T>(
  formKey: string,
  userId: string,
  values: T,
  savedAt: string,
  accessToken: string | null,
): RemoteSyncOutcome {
  const sanitized = sanitizeForStorage(values);

  if (!accessToken) {
    queueForRetry({ formKey, userId, savedAt, values: sanitized, queuedAt: new Date().toISOString() });
    return 'queued';
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/form_drafts?on_conflict=user_id,form_key`;
  const body = JSON.stringify({
    user_id: userId,
    form_key: formKey,
    values: sanitized,
    saved_at: savedAt,
  });
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  // Queue optimistically, then clear the entry once the write is confirmed.
  // If the tab dies mid-flight the draft is still recoverable on next load.
  queueForRetry({ formKey, userId, savedAt, values: sanitized, queuedAt: new Date().toISOString() });

  try {
    fetch(url, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey,
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body,
    })
      .then((res) => {
        if (res.ok) dropFromOutbox(formKey, userId);
      })
      .catch(() => {
        /* stays in the outbox for retry */
      });
    return 'synced';
  } catch {
    return 'failed';
  }
}

/* ================= Retry outbox ================= */

function readOutbox(): OutboxEntry[] {
  if (!storageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(entries: OutboxEntry[]): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries.slice(-25)));
  } catch {
    /* noop */
  }
}

function queueForRetry(entry: OutboxEntry): void {
  const rest = readOutbox().filter(
    (e) => !(e.formKey === entry.formKey && e.userId === entry.userId),
  );
  rest.push(entry);
  writeOutbox(rest);
}

function dropFromOutbox(formKey: string, userId: string): void {
  const entries = readOutbox();
  const next = entries.filter((e) => !(e.formKey === formKey && e.userId === userId));
  if (next.length !== entries.length) writeOutbox(next);
}

/** True when this form has an unsynced draft waiting to reach the server. */
export function hasPendingSync(formKey: string, userId: string | null | undefined): boolean {
  if (!userId) return false;
  return readOutbox().some((e) => e.formKey === formKey && e.userId === userId);
}

/**
 * Retry every queued draft for this user. Called on load and when the
 * connection returns. Entries older than the retention window are dropped.
 */
export async function flushDraftOutbox(userId: string): Promise<{ synced: number; failed: number }> {
  const entries = readOutbox().filter((e) => e.userId === userId);
  if (entries.length === 0) return { synced: 0, failed: 0 };

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) return { synced: 0, failed: entries.length };

  let synced = 0;
  let failed = 0;

  for (const entry of entries) {
    const age = Date.now() - new Date(entry.queuedAt).getTime();
    if (age > LOCAL_RETENTION_MS) {
      dropFromOutbox(entry.formKey, entry.userId);
      continue;
    }
    const { error } = await supabase.from('form_drafts').upsert(
      {
        user_id: entry.userId,
        form_key: entry.formKey,
        values: entry.values as any,
        saved_at: entry.savedAt,
      },
      { onConflict: 'user_id,form_key' },
    );
    if (error) {
      failed += 1;
      console.warn('formDraftStorage: outbox retry failed', entry.formKey, error.message);
    } else {
      synced += 1;
      dropFromOutbox(entry.formKey, entry.userId);
    }
  }

  return { synced, failed };
}
