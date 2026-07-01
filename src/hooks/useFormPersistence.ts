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
  const hydratedRef = useRef(false);
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

  // Hydrate once per (form, user) — offer to restore if there's a saved draft.
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!user?.id) return; // wait for auth
    hydratedRef.current = true;
    const envelope = loadDraft<T>(formKey, user.id);
    if (!envelope || envelope.values == null) return;
    setHasDraft(true);
    setSavedAt(envelope.savedAt);

    const restore = () => {
      setValues(envelope.values);
      if (onRestore) onRestore(envelope.values);
      toast.success('Draft restored');
    };
    const discard = () => {
      clear();
      toast('Draft discarded');
    };

    toast(label ? `You have an unsaved draft for ${label}` : 'You have an unsaved draft', {
      description: `Saved ${new Date(envelope.savedAt).toLocaleString()}`,
      duration: 12000,
      action: { label: 'Restore', onClick: restore },
      cancel: { label: 'Discard', onClick: discard },
    });
    // Intentionally exclude setValues/onRestore/label/clear — hydrate exactly once per user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey, user?.id]);

  // Debounced writes on any change.
  useEffect(() => {
    if (!enabled) return;
    if (!user?.id) return;
    if (shouldPersist && !shouldPersist(values)) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const ok = saveDraft(formKey, user.id, latestValuesRef.current);
      if (ok) {
        setSavedAt(new Date().toISOString());
        setHasDraft(true);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [values, enabled, formKey, user?.id, debounceMs, shouldPersist]);

  // Flush immediately when the tab becomes hidden (Chrome tab discard scenario).
  useEffect(() => {
    if (!enabled || !user?.id) return;
    const flush = () => {
      if (document.visibilityState === 'hidden') {
        if (shouldPersist && !shouldPersist(latestValuesRef.current)) return;
        saveDraft(formKey, user.id, latestValuesRef.current);
      }
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [enabled, formKey, user?.id, shouldPersist]);

  return { clear, savedAt, hasDraft };
}
