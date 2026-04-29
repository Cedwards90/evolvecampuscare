# Case Managers Page with Student Assignment Management

A new admin-only page at `/admin/case-managers` that lists every case manager, shows their assigned students, and lets admins reassign students between case managers — fully wired to existing hooks so updates propagate everywhere instantly.

## Scope guardrails
- New code only. No edits to existing pages, hooks, RLS, or schema unless explicitly approved.
- Reuses the existing `useStudentAssignments`, `useAssignStudent`, `useCaseManagerStats` hooks and their query invalidations, which already cover dashboards, request lists, and CM stats.
- Sidebar gets one new link entry (Admin section). This is the only edit outside of new files — flagged for approval below.

## What gets built

### 1. New page: `src/pages/admin/CaseManagersPage.tsx`
Admin-only route. Two-pane layout:

```text
┌─ Case Managers ─────────────────────────────────────────┐
│ [Search CM…]  [Filter: All / Overloaded / Available]    │
├──────────────┬──────────────────────────────────────────┤
│ CM List      │ Selected CM detail panel                 │
│ • Avatar     │ • Profile header + workload bar          │
│ • Name       │ • Assigned students table                │
│ • # students │   [Search students] [Status filter]      │
│ • # active   │   Columns: Student • Status • Active     │
│   requests   │            requests • Last activity • ⋯  │
│ • Workload % │   Row action: "Reassign" → dialog        │
└──────────────┴──────────────────────────────────────────┘
```

Features:
- **CM cards** with assignment count badge, active-request count, workload bar (uses `useCaseManagerStats`).
- **CM search/filter** by name/email and workload bucket.
- **Student sub-table** per selected CM with search + status filter (active / inactive / has-pending-requests).
- **Empty states** for CMs with no assignments.

### 2. New component: `src/components/admin/ReassignStudentDialog.tsx`
Confirmation dialog triggered from a student row:
- Shows current CM → target CM (searchable Select of other CMs with workload hint).
- Optional notes textarea (audit context).
- Validation: target CM required, must differ from current, has `case_manager` role.
- "Also reassign open requests" checkbox (default on) — mirrors existing `useAssignStudent` behavior.
- Confirm button shows loading state, disabled until valid.

### 3. New hook: `src/hooks/useReassignStudent.ts`
Thin wrapper that:
- Calls existing `useAssignStudent` mutation (it already upserts on `student_id` and updates open requests).
- Inserts an audit row into `request_updates` for each updated request with `note: "Student reassigned from {oldCM} to {newCM} by admin. {notes}"` and `is_internal: true`.
- Permission check: throws if caller is not admin (defense-in-depth; RLS already enforces this).
- Invalidates the same query keys already used: `student-assignments`, `unassigned-students`, `requests`, `case-managers`, `case-manager-stats`, plus `my-students` and `my-assignment` so student & CM dashboards refresh instantly.

### 4. Routing
Add to `src/App.tsx` (new route only, no edits to existing routes):
```tsx
<Route path="/admin/case-managers" element={
  <ProtectedRoute allowedRoles={['admin']}>
    <CaseManagersPage />
  </ProtectedRoute>
} />
```

### 5. Sidebar entry — REQUIRES APPROVAL (one-line edit)
Add one item to `adminNavItems` in `src/components/layouts/SidebarLayout.tsx`:
```tsx
{ label: 'Case Managers', href: '/admin/case-managers', icon: UserCog, roles: ['admin'] }
```
This is the only change to an existing file. If you'd rather I leave the sidebar alone and you'll wire navigation yourself, say so.

## Realtime propagation guarantee
Every place that displays assignments already reads from these query keys; the mutation invalidates all of them in one pass, so reassignment instantly updates:
- Admin Case Managers page (this page)
- `CaseManagerDetail` page (`case-manager-stats`)
- Student dashboard "My Case Manager" card (`my-assignment`)
- CM dashboard "My Students" (`my-students`)
- Requests list / detail (`requests`)
- Existing `StudentAssignmentsTable` on admin dashboard (`student-assignments`)

## Security & audit
- Route gated by `ProtectedRoute allowedRoles={['admin']}`.
- Existing RLS on `student_assignments` already restricts management to admins (`Admins can manage student assignments`) — no schema changes needed.
- Audit trail via `request_updates` insert with `is_internal=true` so students don't see internal reassignment notes; CMs and admins do (per existing `request_updates` SELECT policy).

## Files
**New:**
- `src/pages/admin/CaseManagersPage.tsx`
- `src/components/admin/ReassignStudentDialog.tsx`
- `src/hooks/useReassignStudent.ts`

**Edited (with your approval):**
- `src/App.tsx` — add one route
- `src/components/layouts/SidebarLayout.tsx` — add one nav item

**Not touched:** database schema, RLS, existing hooks, existing pages.
