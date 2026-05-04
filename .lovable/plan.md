# Plan: Instant push updates (no lag)

## Goal
All updates to requests, notifications, and lists appear immediately for every connected user — no 30-second wait, no manual refresh.

## What's currently slow
1. React Query caches data for 30s (`staleTime: 30 * 1000`), so even after a mutation refresh, peer users only see updates on focus or after 30s.
2. Realtime is enabled only for `notifications`, `staff_messages`, `user_invitations`. The core tables — `support_requests`, `request_updates`, `request_attachments` — are **not** in the `supabase_realtime` publication, so changes by one user never push to others.
3. There is no central "subscribe and invalidate" hook for requests/lists.

## Changes

### 1. Database migration
Add to the realtime publication and ensure full row payloads:
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.support_requests, public.request_updates, public.request_attachments;`
- `ALTER TABLE ... REPLICA IDENTITY FULL;` for each (so DELETEs and updates carry full old-row data for filtering by RLS).

### 2. React Query defaults (`src/App.tsx`)
- `staleTime: 0` — every mount/focus/realtime nudge refetches.
- Keep `gcTime: 5 * 60 * 1000`, `refetchOnWindowFocus: true`, `refetchOnReconnect: true`.

### 3. New hook: `src/hooks/useRealtimeRequests.ts`
Single global subscription mounted once at app root. Subscribes to:
- `support_requests` (INSERT/UPDATE/DELETE)
- `request_updates` (INSERT/UPDATE/DELETE)
- `request_attachments` (INSERT/DELETE)

On any event, invalidate the relevant query keys:
- `['request', id]`, `['requests']`, `['my-requests']`, `['my-students']`,
  `['case-manager-stats']`, `['analytics']`, `['filter-options']`,
  `['student-detail', studentId]`.

Mounted inside `AuthProvider` so it only runs for authenticated users; RLS filters which rows the user actually receives.

### 4. Notifications hook
`useNotifications` already subscribes — confirm it invalidates on every event (no debounce) so the bell badge updates instantly.

### 5. Mutations
Already call `invalidateQueries`. No changes needed — realtime now handles peer-to-peer pushes; local mutator sees its own change immediately via optimistic invalidation.

## Out of scope
- Offline-mode behavior (unchanged — sync still happens on reconnect).
- Per-row optimistic updates (we rely on quick refetch instead, which is simpler and consistent).
- Messaging realtime (already working via `useRealtimeMessages`).

## Verification
- Open the same request in two browser windows (admin + student). Status change in one reflects in the other within ~1s without refresh.
- Submit a new request as a student → appears in case manager's list instantly.
- Add a note → timeline updates in the other window immediately.
- Notification bell increments live.
