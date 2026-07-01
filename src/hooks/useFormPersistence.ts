import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  beaconSaveDraft,
  clearDraft,
  clearDraftRemote,
  loadDraft,
  loadDraftRemote,
  saveDraft,
  saveDraftRemote,
} from '@/lib/formDraftStorage';

interface UseFormPersistenceOptions<T> {
  debounceMs?: number;
  enabled?: boolean;
  shouldPersist?: (values: T) => boolean;
  onRestore?: (values: T) => void;
  label?: string;
  /** Delay between remote (Supabase) writes. Defaults to 2500ms. */
  remoteDebounceMs?: number;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(Date.now());
  }
}

/**
 * Persist a form's in-progress values to localStorage AND Supabase so users
 * don't lose their work across tab discards, reloads, or devices.
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
    remoteDebounceMs = 2500,
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
  const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldPersistRef = useRef<typeof shouldPersist>(shouldPersist);
  const latestValuesRef = useRef<T>(values);
  latestValuesRef.current = values;
  shouldPersistRef.current = shouldPersist;

  const clearTimers = () => {
    if (localTimerRef.current) {
      clearTimeout(localTimerRef.current);
      localTimerRef.current = null;
    }
    if (remoteTimerRef.current) {
      clearTimeout(remoteTimerRef.current);
      remoteTimerRef.current = null;
    }
  };

  const clear = useCallback(() => {
    clearDraft(formKey, user?.id);
    if (user?.id) void clearDraftRemote(formKey, user.id);
    setSavedAt(null);
    setHasDraft(false);
    clearTimers();
  }, [formKey, user?.id]);

  const persistLocal = useCallback((snapshot: T): string | null => {
    if (!enabled) return null;
    if (!user?.id) return null;
    if (shouldPersistRef.current && !shouldPersistRef.current(snapshot)) return null;
    const ok = saveDraft(formKey, user.id, snapshot);
    if (!ok) return null;
    const at = new Date().toISOString();
    setSavedAt(at);
    setHasDraft(true);
    return at;
  }, [enabled, formKey, user?.id]);

  const persistRemote = useCallback((snapshot: T, at: string) => {
    if (!user?.id) return;
    void saveDraftRemote(formKey, user.id, snapshot, at);
  }, [formKey, user?.id]);

  // Hydrate: prefer whichever draft (local or remote) has the newer savedAt.
  useEffect(() => {
    const hydrateKey = `${formKey}:${user?.id || ''}`;
    if (hydratedKeyRef.current === hydrateKey) return;
    if (!user?.id) return;
    hydratedKeyRef.current = hydrateKey;
    firstSaveEffectRef.current = true;

    const local = loadDraft<T>(formKey, user.id);
    let applied: { values: T; savedAt: string } | null = local
      ? { values: local.values, savedAt: local.savedAt }
      : null;

    if (applied) {
      skipNextSaveRef.current = true;
      setHasDraft(true);
      setSavedAt(applied.savedAt);
      setValues(applied.values);
      if (onRestore) onRestore(applied.values);
      toast.success(label ? `Draft restored for ${label}` : 'Draft restored', {
        description: `Saved ${new Date(applied.savedAt).toLocaleString()}`,
        duration: 10000,
        action: {
          label: 'Discard',
          onClick: () => {
            clear();
            toast('Draft discarded');
          },
        },
      });
    }

    // Background: check remote and prefer it if newer.
    (async () => {
      const remote = await loadDraftRemote<T>(formKey, user.id);
      if (!remote || remote.values == null) return;
      const remoteTs = new Date(remote.savedAt).getTime();
      const localTs = applied ? new Date(applied.savedAt).getTime() : 0;
      if (remoteTs <= localTs) return;
      skipNextSaveRef.current = true;
      setHasDraft(true);
      setSavedAt(remote.savedAt);
      setValues(remote.values);
      saveDraft(formKey, user.id, remote.values);
      if (onRestore) onRestore(remote.values);
      if (!applied) {
        toast.success(label ? `Draft restored for ${label}` : 'Draft restored', {
          description: `Synced from another device — saved ${new Date(remote.savedAt).toLocaleString()}`,
          duration: 10000,
          action: {
            label: 'Discard',
            onClick: () => {
              clear();
              toast('Draft discarded');
            },
          },
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey, user?.id]);

  // Debounced writes on any change (local fast, remote slower).
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
    if (shouldPersistRef.current && !shouldPersistRef.current(values)) return;

    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    const serializedAtSchedule = safeStringify(values);
    localTimerRef.current = setTimeout(() => {
      if (serializedAtSchedule !== safeStringify(latestValuesRef.current)) return;
      const at = persistLocal(latestValuesRef.current);
      if (!at) return;
      if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
      remoteTimerRef.current = setTimeout(() => {
        persistRemote(latestValuesRef.current, new Date().toISOString());
      }, Math.max(0, remoteDebounceMs - debounceMs));
    }, debounceMs);

    return () => {
      if (localTimerRef.current) clearTimeout(localTimerRef.current);
    };
  }, [values, enabled, formKey, user?.id, debounceMs, remoteDebounceMs, persistLocal, persistRemote]);

  // Flush immediately when the tab becomes hidden — Chrome tab discard scenario.
  useEffect(() => {
    if (!enabled || !user?.id) return;
    const flush = () => {
      clearTimers();
      const at = persistLocal(latestValuesRef.current);
      if (!at) return;
      // Use fetch keepalive so the write survives tab discard / navigation.
      supabase.auth.getSession().then(({ data }) => {
        beaconSaveDraft(
          formKey,
          user.id,
          latestValuesRef.current,
          at,
          data.session?.access_token ?? null,
        );
      }).catch(() => {
        // If we can't get the session synchronously enough, fall back to normal upsert.
        persistRemote(latestValuesRef.current, at);
      });
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
  }, [enabled, persistLocal, persistRemote, formKey, user?.id]);

  return { clear, savedAt, hasDraft };
}
