import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { clearDraft, loadDraft, saveDraft } from '@/lib/formDraftStorage';

interface UseFormPersistenceOptions<T> {
  /** Debounce delay (ms) before writing to storage. Defaults to 500. */
  debounceMs?: number;
  /** Disable persistence conditionally (e.g. after a successful submit). */
  enabled?: boolean;
  /** Optional predicate — return false to skip persisting a specific snapshot. */
  shouldPersist?: (values: T) => boolean;
  /** Called after the user chooses "Restore" from the toast. */
  onRestore?: (values: T) => void;
  /** Human-readable form name for the restore toast. */
  label?: string;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(Date.now());
  }
}

/**
 * Persist a form's in-progress values to localStorage so users don't lose
 * their work when a browser tab is discarded, reloaded, or accidentally
 * closed.
 *
 * The hook is intentionally state-shape agnostic: pass the full values
 * object and a setter that can rehydrate the form when the user chooses to
 * restore a previously-saved draft.
 *
 * Returns a small API with `clear()` (call after a successful submit) and
 * `savedAt` for a "Draft saved" indicator.
 */
export function useFormPersistence<T>(
  formKey: string,
  values: T,
  setValues: (values: T) => void,
  options: UseFormPersistenceOptions<T> = {},
): { clear: () => void; savedAt: string | null; hasDraft: boolean } {
  const { user } = useAuth();
  const {
    debounceMs = 500,
    enabled = true,
    shouldPersist,
    onRestore,
    label,
  } = options;

  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const hydratedKeyRef = useRef<string | null>(null);
  const firstSaveEffectRef = useRef(true);
  const skipNextSaveRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValuesRef = useRef<T>(values);
  latestValuesRef.current = values;

  const clear = useCallback(() => {
    clearDraft(formKey, user?.id);
    setSavedAt(null);
    setHasDraft(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [formKey, user?.id]);

  const persistNow = useCallback((snapshot: T): boolean => {
    if (!enabled) return false;
    if (!user?.id) return false;
    if (shouldPersist && !shouldPersist(snapshot)) return false;
    const ok = saveDraft(formKey, user.id, snapshot);
    if (ok) {
      setSavedAt(new Date().toISOString());
      setHasDraft(true);
    }
    return ok;
  }, [enabled, formKey, shouldPersist, user?.id]);

  // Hydrate once per (form, user) — offer to restore if there's a saved draft.
  useEffect(() => {
    const hydrateKey = `${formKey}:${user?.id || ''}`;
    if (hydratedKeyRef.current === hydrateKey) return;
    if (!user?.id) return; // wait for auth
    hydratedKeyRef.current = hydrateKey;
    firstSaveEffectRef.current = true;
    const envelope = loadDraft<T>(formKey, user.id);
    if (!envelope || envelope.values == null) return;
    skipNextSaveRef.current = true;
    setHasDraft(true);
    setSavedAt(envelope.savedAt);

    setValues(envelope.values);
    if (onRestore) onRestore(envelope.values);

    const discard = () => {
      clear();
      toast('Draft discarded');
    };

    toast.success(label ? `Draft restored for ${label}` : 'Draft restored', {
      description: `Saved ${new Date(envelope.savedAt).toLocaleString()}`,
      duration: 12000,
      action: { label: 'Discard', onClick: discard },
    });
    // Intentionally exclude setValues/onRestore/label/clear — hydrate exactly once per user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey, user?.id]);

  // Debounced writes on any change.
  useEffect(() => {
    if (!enabled) return;
    if (!user?.id) return;
    if (firstSaveEffectRef.current) {
      firstSaveEffectRef.current = false;
      return;
    }
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (shouldPersist && !shouldPersist(values)) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    const serializedAtSchedule = safeStringify(values);
    timerRef.current = setTimeout(() => {
      if (serializedAtSchedule !== safeStringify(latestValuesRef.current)) return;
      persistNow(latestValuesRef.current);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [values, enabled, formKey, user?.id, debounceMs, shouldPersist, persistNow]);

  // Flush immediately when the tab becomes hidden (Chrome tab discard scenario).
  useEffect(() => {
    if (!enabled || !user?.id) return;
    const flush = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      persistNow(latestValuesRef.current);
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', flushWhenHidden);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [enabled, persistNow, user?.id]);

  return { clear, savedAt, hasDraft };
}
