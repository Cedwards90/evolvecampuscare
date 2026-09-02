import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  beaconSaveDraft,
  clearDraft,
  clearDraftRemote,
  flushDraftOutbox,
  hasPendingSync,
  loadDraft,
  loadDraftRemote,
  saveDraft,
  saveDraftRemote,
} from '@/lib/formDraftStorage';

/** What the user is told about where their in-progress work currently lives. */
export type DraftSyncState = 'idle' | 'saving' | 'local' | 'synced' | 'failed';

interface UseFormPersistenceOptions<T> {
  debounceMs?: number;
  enabled?: boolean;
  shouldPersist?: (values: T) => boolean;
  onRestore?: (values: T) => void;
  label?: string;
  /** Delay between remote (Supabase) writes. Defaults to 2500ms. */
  remoteDebounceMs?: number;
}

export interface FormPersistenceResult<T> {
  clear: () => void;
  savedAt: string | null;
  hasDraft: boolean;
  /** Where the draft currently lives — drives the DraftStatus indicator. */
  syncState: DraftSyncState;
  /** Manually retry a failed/queued server sync. */
  retrySync: () => Promise<void>;
  /**
   * Set when a newer draft exists on another device. Both versions are kept;
   * the user chooses instead of the newest silently winning.
   */
  conflict: { savedAt: string; values: T } | null;
  /** Apply the other device's draft. */
  resolveConflictUseRemote: () => void;
  /** Keep the draft on this device and overwrite the server copy. */
  resolveConflictKeepLocal: () => void;
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
 *
 * Cross-device conflicts are surfaced rather than resolved by timestamp: both
 * copies are retained and the caller renders a choice.
 */
export function useFormPersistence<T>(
  formKey: string,
  values: T,
  setValues: (values: T) => void,
  options: UseFormPersistenceOptions<T> = {},
): FormPersistenceResult<T> {
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
  const [syncState, setSyncState] = useState<DraftSyncState>('idle');
  const [conflict, setConflict] = useState<{ savedAt: string; values: T } | null>(null);
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
    setSyncState('idle');
    setConflict(null);
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
    setSyncState('local');
    return at;
  }, [enabled, formKey, user?.id]);

  const persistRemote = useCallback(async (snapshot: T, at: string) => {
    if (!user?.id) return;
    setSyncState('saving');
    const outcome = await saveDraftRemote(formKey, user.id, snapshot, at);
    setSyncState(outcome === 'synced' ? 'synced' : outcome === 'queued' ? 'local' : 'failed');
  }, [formKey, user?.id]);

  const retrySync = useCallback(async () => {
    if (!user?.id) return;
    setSyncState('saving');
    const { failed } = await flushDraftOutbox(user.id);
    if (failed > 0) {
      setSyncState('failed');
      return;
    }
    // Nothing queued (or everything drained) — push the current snapshot too.
    const at = savedAt ?? new Date().toISOString();
    const outcome = await saveDraftRemote(formKey, user.id, latestValuesRef.current, at);
    setSyncState(outcome === 'synced' ? 'synced' : outcome === 'queued' ? 'local' : 'failed');
  }, [formKey, user?.id, savedAt]);

  const resolveConflictUseRemote = useCallback(() => {
    if (!conflict) return;
    skipNextSaveRef.current = true;
    setValues(conflict.values);
    setSavedAt(conflict.savedAt);
    setHasDraft(true);
    setSyncState('synced');
    if (user?.id) saveDraft(formKey, user.id, conflict.values);
    if (onRestore) onRestore(conflict.values);
    setConflict(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflict, formKey, user?.id, setValues]);

  const resolveConflictKeepLocal = useCallback(() => {
    setConflict(null);
    const at = new Date().toISOString();
    setSavedAt(at);
    void persistRemote(latestValuesRef.current, at);
  }, [persistRemote]);

  // Hydrate. Local wins immediately; a newer remote draft becomes a conflict
  // the user resolves, except when there is no local draft at all.
  useEffect(() => {
    const hydrateKey = `${formKey}:${user?.id || ''}`;
    if (hydratedKeyRef.current === hydrateKey) return;
    if (!user?.id) return;
    hydratedKeyRef.current = hydrateKey;
    firstSaveEffectRef.current = true;

    // Drain anything that failed to reach the server last session.
    void flushDraftOutbox(user.id).then(({ synced, failed }) => {
      if (failed > 0) setSyncState('failed');
      else if (synced > 0) setSyncState('synced');
    });

    const local = loadDraft<T>(formKey, user.id);
    const applied: { values: T; savedAt: string } | null = local
      ? { values: local.values, savedAt: local.savedAt }
      : null;

    if (applied) {
      skipNextSaveRef.current = true;
      setHasDraft(true);
      setSavedAt(applied.savedAt);
      setSyncState(hasPendingSync(formKey, user.id) ? 'failed' : 'local');
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

    // Background: compare with the server copy.
    (async () => {
      const remote = await loadDraftRemote<T>(formKey, user.id);
      if (!remote || remote.values == null) return;
      const remoteTs = new Date(remote.savedAt).getTime();
      const localTs = applied ? new Date(applied.savedAt).getTime() : 0;
      if (remoteTs <= localTs) return;

      if (!applied) {
        // No local copy — safe to adopt the server version outright.
        skipNextSaveRef.current = true;
        setHasDraft(true);
        setSavedAt(remote.savedAt);
        setSyncState('synced');
        setValues(remote.values);
        saveDraft(formKey, user.id, remote.values);
        if (onRestore) onRestore(remote.values);
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
        return;
      }

      // Both exist and the server copy is newer: keep both, let the user pick.
      setConflict({ savedAt: remote.savedAt, values: remote.values });
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
        void persistRemote(latestValuesRef.current, new Date().toISOString());
      }, Math.max(0, remoteDebounceMs - debounceMs));
    }, debounceMs);

    return () => {
      if (localTimerRef.current) clearTimeout(localTimerRef.current);
    };
  }, [values, enabled, formKey, user?.id, debounceMs, remoteDebounceMs, persistLocal, persistRemote]);

  // Retry queued drafts as soon as connectivity returns.
  useEffect(() => {
    if (!enabled || !user?.id) return;
    const onOnline = () => {
      void flushDraftOutbox(user.id).then(({ synced, failed }) => {
        if (failed > 0) setSyncState('failed');
        else if (synced > 0) setSyncState('synced');
      });
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [enabled, user?.id]);

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
        // Session unavailable: the draft is already queued locally by
        // saveDraftRemote and will be retried on the next load.
        void persistRemote(latestValuesRef.current, at);
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

  return {
    clear,
    savedAt,
    hasDraft,
    syncState,
    retrySync,
    conflict,
    resolveConflictUseRemote,
    resolveConflictKeepLocal,
  };
}
