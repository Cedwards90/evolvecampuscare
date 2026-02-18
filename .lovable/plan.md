

## Fix: Request Detail 404 and Minor Remaining Issues

### Root Cause

There is a **one-character typo** in `src/components/RequestCard.tsx` line 33:

```text
Current:  navigate(`/request/${request.id}`)
Correct:  navigate(`/requests/${request.id}`)
```

The route defined in `App.tsx` is `/requests/:id` (plural), but `RequestCard` navigates to `/request/:id` (singular). This causes every request card clicked from the **Dashboard** (where no custom `onClick` is passed) to hit the catch-all 404 route.

On the **TrackRequests** page, this bug is masked because `RequestCard` is wrapped inside a `SheetTrigger` which intercepts clicks before the default `handleClick` fires.

### Changes Required

**File: `src/components/RequestCard.tsx`** -- Fix the navigation path (line 33)
- Change `/request/${request.id}` to `/requests/${request.id}`
- This is the only change needed; the `RequestDetail` page, `useRequest` hook, and route definition are all already correct

### Already Working (No Changes Needed)

1. **Offline drafts persistence** -- The `useOfflineDrafts` hook already implements dual-storage (IndexedDB + database). Drafts are saved to IndexedDB immediately on save (works offline) and synced to the database when online. On reload, drafts are fetched from the database (online) or IndexedDB (offline).

2. **Seed data removal** -- `TrackRequests.tsx` queries `support_requests` filtered by `student_id: user?.id`. New users see "You haven't submitted any support requests yet." No mock data imports remain.

3. **Meeting scheduling** -- `ScheduleMeetingDialog` is already integrated into `TrackRequests.tsx` (line 285). It provides date/time selection, duration picker, confirmation button, and creates both a database appointment and a calendar event via Edge Function. Once the 404 is fixed, the full request detail page (which also shows case manager info) will be accessible, completing the scheduling verification path.

### Summary

| File | Change | Lines |
|------|--------|-------|
| `src/components/RequestCard.tsx` | Fix `/request/` to `/requests/` | Line 33 |

This is a single-line fix that unblocks the entire request detail flow.

