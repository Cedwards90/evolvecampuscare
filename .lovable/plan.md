## Goal
Prevent resolved/cancelled requests from showing in the "Escalated & Unassigned" dashboard sections, and make counts recalculate in real time.

## Findings (verified)
- `src/pages/Dashboard.tsx` line 712 filters with `status === 'escalated' || !assigned_case_manager_id` — matches unassigned resolved/cancelled requests.
- `src/pages/AdminDashboard.tsx` line 112 (`criticalRequests`) and lines 128 / 205 / 417 (`unassignedRequests`) have the same gap.
- `useRealtimeRequests` / `realtimeRouter` already invalidate `['requests']` on `support_requests` changes, so once the filter is fixed, resolving a request will refetch and drop it from the section automatically. No refetch wiring changes needed.
- Reports, student profile, timeline, and analytics hooks read from their own queries and are untouched.

## Changes (scoped, presentation-only)

**`src/pages/Dashboard.tsx`**
- Define active-status set: `submitted`, `in_progress`, `escalated`.
- Update the "Escalated & Unassigned" list filter (lines 712, 715) to require `activeStatuses.has(r.status)` AND (`status === 'escalated' || !assigned_case_manager_id`). This excludes resolved/cancelled implicitly.

**`src/pages/AdminDashboard.tsx`**
- Add the same active-status guard to:
  - `criticalRequests` (line 112)
  - `unassignedRequests` (line 128) — so the alert banner, bulk-assignment panel, and "X awaiting assignment" count all ignore resolved/cancelled.
- Escalated stat tile (line 256) already uses `status === 'escalated'` which excludes resolved — leave as-is.

## Out of scope
- Query in `useRequests` stays unchanged (history/reports still see everything).
- No schema, RLS, or hook signature changes.
- No changes to reports, student profile, audit logs, or analytics.

## Verification
- Resolve a request that was previously escalated or unassigned → it disappears from both dashboards within the realtime tick without a manual refresh; counts and emergency banner recompute.
- Same request remains visible in Requests list, request history, student profile, and analytics.