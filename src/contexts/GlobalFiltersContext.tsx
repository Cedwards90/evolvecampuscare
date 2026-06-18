import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type FilterKey =
  | 'cohort'
  | 'yearOfStudy'
  | 'organizationId'
  | 'status'
  | 'role'
  | 'assignedCaseManagerId'
  | 'studentStatus'
  | 'program';

export type GlobalFilters = Record<FilterKey, string[]>;

const EMPTY_FILTERS: GlobalFilters = {
  cohort: [],
  yearOfStudy: [],
  organizationId: [],
  status: [],
  role: [],
  assignedCaseManagerId: [],
  studentStatus: [],
  program: [],
};

const URL_KEYS: Record<FilterKey, string> = {
  cohort: 'cohort',
  yearOfStudy: 'year',
  organizationId: 'org',
  status: 'status',
  role: 'role',
  assignedCaseManagerId: 'cm',
  studentStatus: 'sstatus',
  program: 'program',
};

interface Ctx {
  filters: GlobalFilters;
  setFilter: (key: FilterKey, values: string[]) => void;
  toggleValue: (key: FilterKey, value: string) => void;
  clearFilter: (key: FilterKey) => void;
  resetAll: () => void;
  activeCount: number;
  isHydrated: boolean;
}

const GlobalFiltersContext = createContext<Ctx | undefined>(undefined);

function readFromUrl(sp: URLSearchParams): GlobalFilters {
  const out: GlobalFilters = { ...EMPTY_FILTERS };
  (Object.keys(URL_KEYS) as FilterKey[]).forEach((k) => {
    const raw = sp.get(URL_KEYS[k]);
    if (raw) out[k] = raw.split(',').filter(Boolean);
  });
  return out;
}

function writeToUrl(sp: URLSearchParams, filters: GlobalFilters): URLSearchParams {
  const next = new URLSearchParams(sp);
  (Object.keys(URL_KEYS) as FilterKey[]).forEach((k) => {
    const param = URL_KEYS[k];
    if (filters[k].length === 0) next.delete(param);
    else next.set(param, filters[k].join(','));
  });
  return next;
}

function normalize(raw: Partial<GlobalFilters> | null | undefined): GlobalFilters {
  const merged = { ...EMPTY_FILTERS, ...(raw || {}) } as GlobalFilters;
  (Object.keys(EMPTY_FILTERS) as FilterKey[]).forEach((k) => {
    if (!Array.isArray(merged[k])) merged[k] = [];
  });
  return merged;
}

export function GlobalFiltersProvider({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<GlobalFilters>(() => readFromUrl(searchParams));
  const [isHydrated, setIsHydrated] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // Hydrate from DB on user load (URL wins if present; otherwise seed by role)
  useEffect(() => {
    if (!user) {
      setIsHydrated(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const urlFilters = readFromUrl(searchParams);
      const hasUrl = Object.values(urlFilters).some((v) => v.length > 0);
      if (hasUrl) {
        setFilters(urlFilters);
        setIsHydrated(true);
        return;
      }

      const { data } = await supabase
        .from('user_filter_preferences')
        .select('filters')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;

      let next: GlobalFilters;
      if (data?.filters) {
        next = normalize(data.filters as Partial<GlobalFilters>);
      } else {
        // Role-based default org context seeding
        next = { ...EMPTY_FILTERS };
        if (role === 'org_admin') {
          const { data: orgs } = await supabase
            .from('org_admins')
            .select('organization_id')
            .eq('user_id', user.id);
          if (cancelled) return;
          const ids = (orgs || []).map((o: any) => o.organization_id).filter(Boolean);
          if (ids.length) next.organizationId = ids;
        } else if (role === 'case_manager') {
          const { data: assigns } = await supabase
            .from('student_assignments')
            .select('student_id, profiles:student_id(organization_id)')
            .eq('case_manager_id', user.id);
          if (cancelled) return;
          const ids = Array.from(
            new Set(
              (assigns || [])
                .map((a: any) => a.profiles?.organization_id)
                .filter(Boolean)
            )
          );
          if (ids.length) next.organizationId = ids as string[];
        }
      }

      setFilters(next);
      setSearchParams(writeToUrl(searchParams, next), { replace: true });
      setIsHydrated(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role]);

  // Persist on change (debounced)
  const persist = useCallback((next: GlobalFilters) => {
    if (!user) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      supabase
        .from('user_filter_preferences')
        .upsert({ user_id: user.id, filters: next, updated_at: new Date().toISOString() })
        .then(() => {});
    }, 500);
  }, [user]);

  const applyChange = useCallback((next: GlobalFilters) => {
    setFilters(next);
    setSearchParams(writeToUrl(searchParams, next), { replace: true });
    persist(next);
  }, [searchParams, setSearchParams, persist]);

  const setFilter = useCallback((key: FilterKey, values: string[]) => {
    applyChange({ ...filters, [key]: values });
  }, [filters, applyChange]);

  const toggleValue = useCallback((key: FilterKey, value: string) => {
    const cur = filters[key];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    applyChange({ ...filters, [key]: next });
  }, [filters, applyChange]);

  const clearFilter = useCallback((key: FilterKey) => {
    applyChange({ ...filters, [key]: [] });
  }, [filters, applyChange]);

  const resetAll = useCallback(() => {
    applyChange({ ...EMPTY_FILTERS });
  }, [applyChange]);

  const activeCount = useMemo(
    () => Object.values(filters).reduce((acc, v) => acc + (v.length > 0 ? 1 : 0), 0),
    [filters]
  );

  const value = useMemo<Ctx>(() => ({
    filters, setFilter, toggleValue, clearFilter, resetAll, activeCount, isHydrated,
  }), [filters, setFilter, toggleValue, clearFilter, resetAll, activeCount, isHydrated]);

  return <GlobalFiltersContext.Provider value={value}>{children}</GlobalFiltersContext.Provider>;
}

export function useGlobalFilters() {
  const ctx = useContext(GlobalFiltersContext);
  if (!ctx) throw new Error('useGlobalFilters must be used within GlobalFiltersProvider');
  return ctx;
}

// Helpers ---------------------------------------------------------------

/** @deprecated Cohort filter now uses profiles.cohort_id directly. Retained for any legacy callers. */
export function getCohortFromDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const y = new Date(date).getUTCFullYear();
  if (Number.isNaN(y)) return null;
  return String(y);
}

export type ProfileStatus = 'active' | 'inactive';

export function getProfileStatus(p: { deactivated_at?: string | null }): ProfileStatus {
  return p.deactivated_at ? 'inactive' : 'active';
}

/** Filter a list of profile-like objects by cohort/year/org/program/studentStatus. */
export function filterByProfile<T extends {
  cohort_id?: string | null;
  year_of_study?: string | null;
  organization_id?: string | null;
  department?: string | null;
  deactivated_at?: string | null;
}>(rows: T[], filters: GlobalFilters): T[] {
  return rows.filter((r) => {
    if (filters.cohort.length) {
      if (!r.cohort_id || !filters.cohort.includes(r.cohort_id)) return false;
    }
    if (filters.yearOfStudy.length) {
      if (!r.year_of_study || !filters.yearOfStudy.includes(r.year_of_study)) return false;
    }
    if (filters.organizationId.length) {
      if (!r.organization_id || !filters.organizationId.includes(r.organization_id)) return false;
    }
    if (filters.program.length) {
      if (!r.department || !filters.program.includes(r.department)) return false;
    }
    if (filters.studentStatus.length) {
      const s = getProfileStatus(r);
      if (!filters.studentStatus.includes(s)) return false;
    }
    return true;
  });
}
