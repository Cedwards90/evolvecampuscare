import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuth } from '@/contexts/AuthContext';
import { getTourSteps, type TourStep } from '@/lib/tour/steps';

function storageKey(userId: string | undefined) {
  return `evolve:tour-completed:${userId ?? 'anon'}`;
}

function loginsKey(userId: string | undefined) {
  return `evolve:login-count:${userId ?? 'anon'}`;
}

export function useProductTour() {
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const driverRef = useRef<Driver | null>(null);
  const stepsRef = useRef<TourStep[]>([]);

  const goTo = useCallback(
    (path: string | undefined, then: () => void) => {
      if (path && typeof window !== 'undefined' && window.location.pathname !== path) {
        navigate(path);
        // Wait for the route to mount before letting driver.js position the popover.
        setTimeout(() => {
          then();
          // Re-anchor highlight against any newly mounted element.
          setTimeout(() => driverRef.current?.refresh(), 50);
        }, 250);
      } else {
        then();
      }
    },
    [navigate],
  );

  const buildDriver = useCallback(() => {
    const steps = getTourSteps(role, profile?.full_name || '');
    stepsRef.current = steps;
    const d = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayOpacity: 0.55,
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Got it',
      progressText: '{{current}} of {{total}}',
      steps: steps.map((s) => ({
        element: s.element,
        popover: {
          title: s.title,
          description: s.description,
          side: 'over' as any,
          align: 'center' as any,
          onNextClick: () => {
            const idx = d.getActiveIndex() ?? 0;
            const next = stepsRef.current[idx + 1];
            goTo(next?.navigateTo, () => d.moveNext());
          },
          onPrevClick: () => {
            const idx = d.getActiveIndex() ?? 0;
            const prev = stepsRef.current[idx - 1];
            goTo(prev?.navigateTo, () => d.movePrevious());
          },
        },
      })),
      onDestroyed: () => {
        try {
          localStorage.setItem(storageKey(user?.id), new Date().toISOString());
        } catch {
          /* ignore */
        }
      },
    });
    return d;
  }, [goTo, profile?.full_name, role, user?.id]);

  const startTour = useCallback(() => {
    if (!role) return;
    driverRef.current?.destroy();
    const d = buildDriver();
    driverRef.current = d;
    // Navigate to the first step's destination before starting so the popover anchors correctly.
    const first = stepsRef.current[0];
    goTo(first?.navigateTo, () => d.drive());
  }, [buildDriver, goTo, role]);

  // Auto-trigger on first login (per user, persisted in localStorage)
  useEffect(() => {
    if (!user?.id || !role) return;
    try {
      const seen = localStorage.getItem(storageKey(user.id));
      if (seen) return;
      const t = setTimeout(() => startTour(), 800);
      return () => clearTimeout(t);
    } catch {
      /* ignore */
    }
  }, [user?.id, role, startTour]);

  // Track login count (used for nudges)
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(loginsKey(user.id));
      const n = raw ? parseInt(raw, 10) : 0;
      if (!Number.isNaN(n)) {
        localStorage.setItem(loginsKey(user.id), String(n + 1));
      }
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  const getLoginCount = useCallback((): number => {
    if (!user?.id) return 0;
    try {
      const raw = localStorage.getItem(loginsKey(user.id));
      return raw ? parseInt(raw, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }, [user?.id]);

  const hasCompletedTour = useCallback((): boolean => {
    if (!user?.id) return false;
    try {
      return !!localStorage.getItem(storageKey(user.id));
    } catch {
      return false;
    }
  }, [user?.id]);

  const resetTour = useCallback(() => {
    if (!user?.id) return;
    try {
      localStorage.removeItem(storageKey(user.id));
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  return { startTour, hasCompletedTour, resetTour, getLoginCount };
}
