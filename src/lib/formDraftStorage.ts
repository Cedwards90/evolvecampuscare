/**
 * Lightweight per-user form draft storage backed by window.localStorage.
 *
 * Used by `useFormPersistence` to keep users' typed input safe across tab
 * discards, accidental reloads, and browser crashes. This is intentionally
 * separate from the offline request-drafts system (IndexedDB + Supabase),
 * which handles queued submissions rather than in-progress form state.
 */

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
function sanitizeForStorage<T>(values: T): T {
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
    // Quota exceeded — best-effort: drop other draft entries and retry once.
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
