## Goal

Introduce a consistent, reusable "back" navigation system across every nested page in the app — without altering the existing sidebar, header, role guards, or route definitions in `App.tsx`.

## What exists today

- `SidebarLayout.tsx` already renders a single-segment "breadcrumb" label in the header (just the current page name). It will be left alone.
- `src/components/ui/breadcrumb.tsx` (shadcn) is available but unused.
- `src/components/PageHeader.tsx` is the standard title block on most pages.
- Several pages already call `useNavigate()` ad-hoc (e.g. `RequestDetail`, `StudentDetail`, `CaseManagerDetail`, `OrganizationDetail`, `StudentProgressReport`, `Messages` thread). These are inconsistent — some use `navigate(-1)`, some hardcode a parent route, some have no back affordance at all.
- `GlobalFiltersContext` already persists filters in URL + DB; `RequestsList`/admin tables read filters from `useSearchParams`. So filter preservation is mostly a matter of **navigating with the original query string intact**.

## Design

### 1. New utility: `src/lib/navigationHistory.ts`
A tiny in-memory stack (module singleton) that records the last N (e.g. 20) in-app locations: `{ pathname, search, scrollY, timestamp }`. Updated by a top-level `<NavigationTracker />` component that subscribes to `useLocation()` inside `BrowserRouter`. It also captures `window.scrollY` on each navigation away (via a `useEffect` cleanup + a `beforeunload`/`popstate`-aware push).

Exports:
- `recordNavigation(loc)`
- `getPreviousEntry(currentPath): Entry | null` — returns most recent entry whose pathname differs from current.
- `popTo(entry)` helper used by the back button.

This avoids relying solely on `navigate(-1)`, which breaks when the user landed via a deep link or external referrer.

### 2. New component: `src/components/navigation/BackButton.tsx`
Props: `{ fallback?: string; label?: string; className?: string }`.
Behavior:
- If `getPreviousEntry()` returns an in-app entry, navigate to `entry.pathname + entry.search` (preserves filters/search/pagination/tab query params) and restore `scrollY` after paint.
- Otherwise navigate to `fallback` (defaults to `/dashboard`).
- Renders a pill-shaped, ghost-variant button with `ArrowLeft` icon, sized for both desktop and mobile (icon-only ≤sm, icon+label ≥sm).

Accessibility: `aria-label="Go back"`, focus ring via existing tokens.

### 3. New component: `src/components/navigation/PageBreadcrumbs.tsx`
Props: `{ items: Array<{ label: string; to?: string }> }`. Renders the shadcn `Breadcrumb` primitive. Last item is the current page (no link). Hidden on `<sm` to keep mobile clean (BackButton remains).

### 4. New component: `src/components/navigation/PageNav.tsx`
Convenience wrapper that combines `BackButton` + `PageBreadcrumbs` in a single row above `PageHeader`. This is the primary API page authors will use:

```tsx
<PageNav
  fallback="/admin/organizations"
  crumbs={[
    { label: 'Admin', to: '/admin-monitoring-reassigning-requests' },
    { label: 'Organizations', to: '/admin/organizations' },
    { label: org.name },
  ]}
/>
<PageHeader title={org.name} ... />
```

### 5. Scroll + filter preservation
- Filters/search/pagination/tabs already live in the URL query string on the pages that support them. `BackButton` preserves the full `search` string from the recorded entry, which is sufficient.
- For pages where tab state lives in `useState` (e.g. `StudentDetail`, `RequestDetail`), wire those to `?tab=` so they survive round-trips. **Limited to read/write of a `tab` query param** — no behavior changes.
- Scroll: `NavigationTracker` saves `scrollY` of the main scroll container (`window`) on every `location` change; `BackButton` restores it via `requestAnimationFrame` after navigation.

### 6. Mount points (no route changes)
- Add `<NavigationTracker />` once inside `<BrowserRouter>` in `App.tsx` (a single import + one self-closing tag — no route restructuring).
- Add `<PageNav />` to nested/detail pages only. Top-level sidebar destinations (Dashboard, Manage Requests, Admin Dashboard, etc.) get **no** back button — they are sidebar roots.

### Pages that will receive `<PageNav />`
Detail / nested pages:
- `RequestDetail`, `StudentDetail`, `CaseManagerDetail`
- `admin/OrganizationDetail`, `admin/QRCodesPage` (when drilled in), `admin/SurveyResponses`
- `StudentProgressReport`, `Reports` sub-views
- `Messages/:userId` thread view
- `IntakeSurvey`, `CompleteProfile`, `AcceptNda` (fallback to `/dashboard`)
- `StudentCheckIn`, `PostGraduationPlan`, `OfflineDraft`, `SubmitRequest`
- `SupportCenter` article views

Sidebar root pages (`/dashboard`, `/settings`, list pages) are **not** touched.

### Role / route safety
- `BackButton` only navigates within the SPA via React Router. Existing `<ProtectedRoute>` guards run on the destination, so role enforcement is automatic — no bypass risk.
- If the previous entry is on a route the user no longer has access to (e.g. role changed mid-session), `<ProtectedRoute>` will redirect; `BackButton` does not need its own role logic.
- Public routes (`/`, `/auth`, `/qr/*`, `/shared/*`) get **no** back button to avoid leaking authenticated paths.

### Mobile
- `BackButton` is icon-only on `<sm`, sits flush-left above the page title.
- Breadcrumbs hidden `<sm`. The sidebar's existing mobile drawer is untouched.

## Files to add
- `src/lib/navigationHistory.ts`
- `src/components/navigation/NavigationTracker.tsx`
- `src/components/navigation/BackButton.tsx`
- `src/components/navigation/PageBreadcrumbs.tsx`
- `src/components/navigation/PageNav.tsx`

## Files to edit (additive only)
- `src/App.tsx` — add `<NavigationTracker />` mount (one line inside `BrowserRouter`).
- Each nested page listed above — add a single `<PageNav .../>` line above the existing `<PageHeader />`. No logic, styling, or data-fetch changes.

## Out of scope (will not touch without further approval)
- Sidebar nav items, header layout, route definitions, role guards.
- Any business logic, hooks, or data-fetching code.
- Visual redesign of `PageHeader` itself.

## Acceptance checks
- Going Admin → Organizations (with filter `?org=abc`) → Organization Detail → Back returns to the filtered list at the same scroll position.
- Student tapping a request from Track Requests → Request Detail → Back returns to Track Requests with the same tab/filter.
- Deep-linking directly to `/requests/:id` shows BackButton that falls back to `/dashboard` (or role-appropriate root).
- No new console errors; existing routes, role guards, and sidebar behavior unchanged.
