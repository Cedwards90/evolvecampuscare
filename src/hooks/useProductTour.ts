import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuth } from '@/contexts/AuthContext';
import { getTourSteps, type TourStep } from '@/lib/tour/steps';

const SKIP_PATH_PREFIXES = [
  '/auth',
  '/reset-password',
  '/complete-profile',
  '/accept-nda',
  '/onboarding',
  '/invite',
];

// Session-scoped fallback if localStorage is unavailable (private mode).
const memStore = new Map<string, string>();

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memStore.get(key) ?? null;
  }
}
function safeSet(key: string, val: string) {
  try {
    localStorage.setItem(key, val);
  } catch {
    memStore.set(key, val);
  }
}
function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    memStore.delete(key);
  }
}

function storageKey(userId: string) {
  return `evolve:tour-completed:${userId}`;
}

function loginsKey(userId: string) {
  return `evolve:login-count:${userId}`;
}

function shouldSkipAutoStart(): boolean {
  if (typeof window === 'undefined') return true;
  const p = window.location.pathname;
  return SKIP_PATH_PREFIXES.some((prefix) => p.startsWith(prefix));
}

async function waitForElement(selector: string | undefined, maxFrames = 20): Promise<void> {
  if (!selector) return;
  for (let i = 0; i < maxFrames; i++) {
    if (document.querySelector(selector)) return;
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
}

export function useProductTour() {
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const driverRef = useRef<Driver | null>(null);
  const stepsRef = useRef<TourStep[]>([]);
  const completedRef = useRef(false);
  const runningRef = useRef(false);

  const buildDriver = useCallback(() => {
    const steps = getTourSteps(role, profile?.full_name || '');
    stepsRef.current = steps;
    completedRef.current = false;

    const d: Driver = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayOpacity: 0.55,
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Got it',
      progressText: '{{current}} of {{total}}',
      steps: steps.map((s, idx) => ({
        element: s.element,
        popover: {
          title: s.title,
          description: s.description,
          side: s.element ? undefined : ('over' as any),
          align: s.element ? undefined : ('center' as any),
          onNextClick: async () => {
            const next = stepsRef.current[idx + 1];
            if (next?.navigateTo && window.location.pathname !== next.navigateTo) {
              navigate(next.navigateTo);
              await waitForElement(next.element);
            } else if (next?.element) {
              await waitForElement(next.element);
            }
            d.moveNext();
            setTimeout(() => d.refresh?.(), 30);
          },
          onPrevClick: async () => {
            const prev = stepsRef.current[idx - 1];
            if (prev?.navigateTo && window.location.pathname !== prev.navigateTo) {
              navigate(prev.navigateTo);
              await waitForElement(prev.element);
            } else if (prev?.element) {
              await waitForElement(prev.element);
            }
            d.movePrevious();
            setTimeout(() => d.refresh?.(), 30);
          },
          onCloseClick: () => {
            // Explicit skip — do not mark completed.
            d.destroy();
          },
        },
      })),
      onDestroyed: () => {
        runningRef.current = false;
        const finished =
          completedRef.current ||
          (typeof d.getActiveIndex === 'function' &&
            (d.getActiveIndex() ?? -1) >= stepsRef.current.length - 1);
        if (finished && user?.id) {
          safeSet(storageKey(user.id), new Date().toISOString());
        }
      },
    });
    return d;
  }, [navigate, profile?.full_name, role, user?.id]);

  const startTour = useCallback(async () => {
    if (!role) return;
    driverRef.current?.destroy();
    const d = buildDriver();
    driverRef.current = d;
    runningRef.current = true;

    const first = stepsRef.current[0];
    if (first?.navigateTo && window.location.pathname !== first.navigateTo) {
      navigate(first.navigateTo);
      await waitForElement(first.element);
    } else if (first?.element) {
      await waitForElement(first.element);
    }
    // Mark completedRef when driver reaches the last step through Done.
    // driver.js will call onDestroyed after done; we detect via active index there.
    d.drive();
  }, [buildDriver, navigate, role]);

  // One-time recovery: unblock users who had the tour incorrectly marked complete
  // by the previous buggy version. Only clears the flag once per user.
  useEffect(() => {
    if (!user?.id) return;
    const migrateKey = `evolve:tour-flag-migrated:v1:${user.id}`;
    if (safeGet(migrateKey)) return;
    const loginsRaw = safeGet(loginsKey(user.id));
    const logins = loginsRaw ? parseInt(loginsRaw, 10) || 0 : 0;
    if (logins < 2 && safeGet(storageKey(user.id))) {
      safeRemove(storageKey(user.id));
    }
    safeSet(migrateKey, '1');
  }, [user?.id]);

  // Auto-trigger on first login, once profile+role are hydrated.
  useEffect(() => {
    if (!user?.id || !role || !profile) return;
    if (safeGet(storageKey(user.id))) return;
    if (shouldSkipAutoStart()) return;

    const t = setTimeout(() => {
      if (shouldSkipAutoStart()) return;
      if (safeGet(storageKey(user.id!))) return;
      startTour();
    }, 1500);
    return () => clearTimeout(t);
  }, [user?.id, role, profile, startTour]);

  // Track login count (used for nudges + migration heuristic)
  useEffect(() => {
    if (!user?.id) return;
    const raw = safeGet(loginsKey(user.id));
    const n = raw ? parseInt(raw, 10) : 0;
    if (!Number.isNaN(n)) safeSet(loginsKey(user.id), String(n + 1));
  }, [user?.id]);

  const getLoginCount = useCallback((): number => {
    if (!user?.id) return 0;
    const raw = safeGet(loginsKey(user.id));
    return raw ? parseInt(raw, 10) || 0 : 0;
  }, [user?.id]);

  const hasCompletedTour = useCallback((): boolean => {
    if (!user?.id) return false;
    return !!safeGet(storageKey(user.id));
  }, [user?.id]);

  const resetTour = useCallback(() => {
    if (!user?.id) return;
    safeRemove(storageKey(user.id));
    driverRef.current?.destroy();
    driverRef.current = null;
  }, [user?.id]);

  return { startTour, hasCompletedTour, resetTour, getLoginCount };
}
