# Codebase Audit Report

This is a **read-only audit** of frontend, backend, data, auth, and UX. No files have been changed. Each item lists severity, affected files, and suggested order. Approve which sections you want me to implement.

---

## Snapshot

- 183 source files, 31k LOC. 51 runtime deps. 15 edge functions. 34 hooks.
- Routing in single `App.tsx` (~220 lines), no lazy loading.
- React Query is configured globally (5 min staleTime) — good baseline.
- RLS is on for all tables. Roles handled correctly via `user_roles` + `has_role`.
- Supabase linter: 8 warnings, all "SECURITY DEFINER function executable by public/authenticated" (medium risk).

---

## P0 — Critical (do first)

### 1. No Error Boundary anywhere
Any render error blanks the entire app for the user. **Files:** `src/App.tsx` (add wrapper), new `src/components/ErrorBoundary.tsx`.
**Risk:** High (production stability). **Effort:** Small.

### 2. SECURITY DEFINER functions exposed to anon/authenticated
Linter flags 8 warnings on `has_role`, `get_user_role`, `handle_new_user`, `handle_invited_signup`, `update_updated_at_column`. Trigger functions and helpers shouldn't be callable via PostgREST. **Fix:** `REVOKE EXECUTE ... FROM anon, authenticated` for trigger functions; keep `has_role`/`get_user_role` callable by `authenticated` only (revoke from `anon`).
**Risk:** Medium-High (privilege surface). **Effort:** Small (1 migration).

### 3. `AuthContext.fetchUserData` uses `.single()` on profile/role
If the profile row hasn't been created yet (race with `handle_new_user` trigger) or a user has zero roles, `.single()` throws and `isLoading` may not flip correctly. Also no error surfacing — silently logs.
**Files:** `src/contexts/AuthContext.tsx`. **Fix:** use `.maybeSingle()`, set loading false in all branches, expose error.
**Risk:** Medium (intermittent blank dashboard). **Effort:** Small.

### 4. Direct `supabase` calls inside 12 components/pages
Bypasses the hooks layer → no caching, no invalidation, harder to test. **Files:** 12 files in `src/components` + `src/pages` (full list on request).
**Risk:** Medium (data drift, duplicate fetches). **Effort:** Medium (incremental refactor).

---

## P1 — High priority

### 5. No code-splitting / lazy routes
`App.tsx` eagerly imports 30+ page components. Initial bundle is larger than needed; first paint slower on mobile. **Fix:** `React.lazy` + `Suspense` for protected routes. **Effort:** Small.

### 6. Largest files are doing too much
- `pages/StudentDetail.tsx` 873 lines
- `pages/AdminDashboard.tsx` 710 lines
- `pages/Dashboard.tsx` 627 lines
- `components/requests/RequestActions.tsx` 607 lines
- `pages/Auth.tsx` 567 lines
- `hooks/useRequest.ts` 556 lines

Symptoms: re-renders entire tree on small state changes, hard to test, duplicated UI patterns. **Fix:** extract sub-components + colocated hooks. **Risk:** Medium (perf + maintainability). **Effort:** Medium-Large.

### 7. Realtime subscriptions
Only 2 channels (`useNotifications`, `useRealtimeMessages`). Need to verify cleanup on unmount and that channel names are unique per user (current names are global strings → may collide across tabs/users). **Effort:** Small.

### 8. Mock data still in source tree
`src/lib/mock-data.ts` (677 lines) is not imported anywhere. Dead code shipped to bundle if accidentally referenced. **Fix:** delete.
**Risk:** Low (bundle bloat, confusion). **Effort:** Trivial.

### 9. Form validation coverage uneven
Only 8 files use Zod. Other forms (`StudentCheckIn`, `PostGraduationPlan`, `IntakeSurvey`, `BulkInviteStudentsDialog`, several admin dialogs) rely on ad-hoc validation. **Fix:** standardize on Zod + `react-hook-form` resolver. **Risk:** Medium (data quality, XSS surface). **Effort:** Medium.

### 10. Accessibility gaps
- `aria-*`/`role=` density is low across the app.
- Only 6 files use `alt=` on images.
- No skip-to-content link, no focus trap audit on dialogs (shadcn handles most, but custom popovers in admin not verified).
**Compliance impact:** WCAG 2.2 AA is in your stated requirements. **Effort:** Medium.

---

## P2 — Medium priority

### 11. Console noise in production
~3KB of `console.log/warn/error` strings across 186 files. Strip non-error logs in build. **Fix:** vite plugin or manual cleanup + a `logger` util that no-ops in prod.

### 12. `: any` / `as any` usage
Several occurrences (3.5KB worth). Strict-null is already off in `tsconfig`. Tighten gradually starting with hooks and edge function shared code.

### 13. `useStudentDetail` over-fetches
Sequentially: profile → assignment → CM profile → requests → appointments → updates. 6 round-trips. **Fix:** parallelize with `Promise.all` where independent; consider a single RPC for the detail view. **Effort:** Small-Medium.

### 14. Query key consistency
No central `queryKeys` factory. Risk of mismatched invalidation strings (e.g., `['students']` vs `['student-list']`). **Fix:** add `src/lib/queryKeys.ts`. **Effort:** Small.

### 15. Long route paths
`/student-submitting-a-support-request` etc. are SEO-unfriendly and ugly. These come from the project knowledge spec; recommend aliases (e.g., `/submit`, `/track`) with redirects from the long ones. **Effort:** Small. **Requires your approval** since paths are user-facing.

### 16. No shared loading skeleton system
`LoadingSpinner` is used, but list/detail pages flash empty states or full-page spinners. **Fix:** add per-section skeletons for Dashboard, RequestsList, StudentDetail. **Effort:** Small-Medium.

### 17. Mobile responsiveness
Not exhaustively verified — admin tables already have horizontal-scroll memory note. Need a pass on `StudentDetail`, `AdminDashboard`, `Settings`, `RequestDetail` at <640px.

---

## P3 — Lower priority / hygiene

- **PWA cache** for Supabase REST is `NetworkFirst` with 5-min cache — fine, but listed even in editor preview where SW is unregistered. Verify no stale data hits in production.
- **Edge function shared code** is good (`_shared/security.ts`). Reuse `getCorsHeaders` everywhere — confirm all 15 functions use it (not yet verified).
- **`useEffect` count** is low (good). `Auth.tsx` has 5 — consider consolidation.
- **No tests beyond `example.test.ts`** — add at minimum: assignment logic, RLS smoke, auth flow.

---

## Recommended implementation order

```text
Batch A (critical, low risk):     1, 2, 3, 8
Batch B (perf wins):              5, 13, 14
Batch C (refactor + a11y):        6, 9, 10, 16
Batch D (polish):                 4, 11, 12, 15, 17
Batch E (long-term):              tests, edge fn cleanup, PWA review
```

Each batch is independently shippable and reversible.

---

## What I need from you

Tell me which batches (or individual items) to start on. I will not change any code without explicit approval, per your instruction. If you want, I can begin with **Batch A** since it is small, isolated, and addresses real production risks.
