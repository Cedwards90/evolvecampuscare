# Batch B — Performance Wins

Three focused, low-risk changes. No behavior changes for users — same data, faster delivery and easier maintenance.

---

## 1. Lazy-load route components (Item #5)

**Problem:** `src/App.tsx` eagerly imports 30+ pages. Every visitor downloads admin, analytics, survey, and offline screens before they ever sign in.

**Change:** Convert all route components except `Landing`, `Auth`, and `NotFound` to `React.lazy(...)` and wrap `<Routes>` in `<Suspense fallback={<LoadingSpinner />}>`.

**Files:** `src/App.tsx` only.

**Risk:** Very low. React Query, contexts, and providers are unchanged.

---

## 2. Parallelize `useStudentDetail` (Item #13)

**Problem:** 6 sequential round-trips (profile → assignment → CM profile → requests → appointments → updates). On a slow connection that's ~1.5–3s of waterfall.

**Change:** Run profile / assignment / requests / appointments in parallel via `Promise.all`. Then a second parallel batch for the CM profile (depends on assignment) and request_updates (depends on request IDs).

**Cuts round-trips from 6 sequential to 2 sequential rounds.** No SQL or RLS changes.

**Files:** `src/hooks/useStudentDetail.ts` only.

**Risk:** Low. Public hook signature unchanged; same `StudentDetail` shape returned.

---

## 3. Central query-key factory (Item #14)

**Problem:** Query keys are stringly-typed across 34 hooks. Today I can already see drift risk — e.g. `useTrainingOrganizations` invalidates 10 different keys by hand, including `['students']` (no hook actually reads that key).

**Change:** Add `src/lib/queryKeys.ts` exporting a typed factory:

```ts
export const queryKeys = {
  users: { all: ['users-with-roles'] as const, ... },
  students: { detail: (id: string) => ['student-detail', id] as const, ... },
  requests: { detail: (id: string) => ['request', id] as const, ... },
  // ...one entry per existing key
};
```

**Approach:** Introduce the file and migrate hooks **incrementally** — start with the highest-fanout keys (`student-detail`, `users-with-roles`, `training-organizations`, `request`, `analytics`). Other hooks keep their inline keys and can be migrated later. No big-bang rewrite.

**Files this batch touches:**
- new `src/lib/queryKeys.ts`
- `src/hooks/useStudentDetail.ts`
- `src/hooks/useUsers.ts`
- `src/hooks/useTrainingOrganizations.ts`
- `src/hooks/useRequest.ts` / `useRequests.ts`
- `src/hooks/useAnalyticsData.ts`
- `src/hooks/useStudentAssignments.ts` (already touches assignments + invalidations)

**Risk:** Low. Keys stay structurally identical to today's strings, so cache compatibility is preserved.

---

## Out of scope for this batch

- Item #6 (large file refactors) — bigger effort, separate batch.
- Item #4 (move direct supabase calls into hooks) — Batch D.
- Edge function review — Batch E.

---

## Verification

After changes I will:
1. Confirm the project still builds (Lovable's build runs automatically).
2. Re-read `App.tsx` and `useStudentDetail.ts` to verify diffs.
3. Spot-check that invalidation key shapes still match read keys (e.g. `['student-detail', id]` produced by both reader and invalidator).

Approve to proceed.
