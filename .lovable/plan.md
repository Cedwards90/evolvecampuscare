
# Plan: Sitewide Realtime Data Sync

## Problem

Realtime is partial today. Mounted at app root: `useRealtimeRequests` (support_requests, request_updates, request_attachments). Per-page: messages, notifications, invitations, student_assignments, reports. Many domain tables (surveys, file_notes, appointments, check-ins, intake, post-grad plans, profiles, orgs, qr) are NOT in the realtime publication and have no subscriptions, so admin/case-manager dashboards go stale until refresh. Several duplicate hooks subscribe to the same tables (request_updates, student_assignments) creating extra websocket traffic.

## Goals

1. One **single source of truth** for realtime: a centralized root-mounted bridge with a domain → query-key invalidation map.
2. Every create/update/delete mutation triggers correct cache invalidation locally AND propagates to other sessions via Postgres changes.
3. **Permission-aware**: subscribers only receive rows their RLS allows (already enforced by Supabase Realtime when RLS is on).
4. **Optimistic UI** on the most-used mutations (status change, assignment, read-receipts).
5. No duplicate channels; no extra page-level subscriptions for tables the bridge already covers.

## Scope (data domains covered)

Requests, request_updates, request_attachments, request_share_links, student_assignments, appointments, file_notes, student_checkins, intake_responses, post_graduation_plans, profiles, organization_memberships, org_admins, training_organizations, qr_codes, qr_scan_events, site_settings, staff_messages, notifications, user_invitations, scheduled_survey_distributions, nda_documents, nda_acceptances.

Out of scope: email queue tables, bulk_invite_jobs internals (admin-only polling is fine), ai_insights (already case-manager scoped UI).

## Approach

### 1. Database migration (additive only)

- Add the following tables to `supabase_realtime` publication: appointments, file_notes, student_checkins, intake_responses, post_graduation_plans, profiles, organization_memberships, org_admins, training_organizations, qr_codes, qr_scan_events, site_settings, scheduled_survey_distributions, request_share_links, nda_documents, nda_acceptances.
- Set `REPLICA IDENTITY FULL` on each so UPDATE/DELETE payloads carry both old and new rows (needed to invalidate by either student_id).
- No schema, RLS, or column changes.

### 2. New centralized bridge: `src/hooks/useRealtimeBridge.ts`

Replaces the patchwork. Mounted once in `App.tsx` (next to existing `RealtimeBridge`). Owns one Supabase channel per domain table. Each handler reads `payload.new`/`payload.old` and calls a small **invalidation router** that maps tables → React Query keys. Examples:

```
support_requests       -> ['requests'], ['my-requests'], ['request', id], ['student-detail', studentId], ['analytics'], ['workload-analytics'], ['case-manager-stats']
student_assignments    -> ['my-students'], ['student-folders'], ['my-assignment'], ['student-assignments'], ['case-manager-stats']
appointments           -> ['appointments', cmId], ['appointments', studentId], ['student-detail', studentId]
file_notes             -> ['file-notes', studentId], ['student-detail', studentId], ['interaction-report']
student_checkins       -> ['student-checkins', studentId], ['student-detail', studentId]
intake_responses       -> ['intake', studentId], ['student-detail', studentId]
post_graduation_plans  -> ['post-grad-plan', studentId], ['student-detail', studentId]
profiles               -> ['profile', userId], ['users'], ['student-folders']
training_organizations -> ['training-orgs'], ['org', id]
organization_memberships, org_admins -> ['org-admins'], ['users'], ['student-folders']
qr_codes / qr_scan_events -> ['qr-codes'], ['qr-analytics']
site_settings          -> ['site-settings']
user_invitations       -> ['invitations'], ['pending-invitations']
scheduled_survey_distributions -> ['scheduled-surveys'], ['survey-responses']
staff_messages         -> ['messages'], ['conversations'], ['messages-unread']
notifications          -> ['notifications', userId]
nda_documents / nda_acceptances -> ['nda'], ['nda-acceptances']
```

Channel handlers gate by current `user.id` and `role` so we don't burn cycles on irrelevant rows. Toast/browser-notification side effects (currently in `useRealtimeMessages` and `useNotifications`) move into the bridge behind the same gates.

### 3. Retire duplicate subscriptions

Delete the per-page channels now superseded by the bridge:
- `useRealtimeRequests` (folded in)
- `useRealtimeStudentAssignments` (folded in)
- `useRealtimeMessages` (folded in, keeps toast logic)
- `useNotifications` realtime block (folded in; keeps query)
- `useInvitations` realtime block (folded in)
- `useInteractionReport` and `useStudentProgressReport` channels (folded in; their query keys are added to the router)

The hooks themselves stay (they own queries/mutations); only their `supabase.channel` blocks are removed to avoid double-fire.

### 4. Optimistic UI + conflict handling

Add `onMutate` / `onError` rollback to the highest-traffic mutations only:
- `useAssignRequest`, `useReassignStudent`
- `useSubmitRequest` status changes
- `useMessages.markAsRead`
- `useNotifications.markAsRead` / `markAllAsRead`

Conflict strategy: on `onError`, rollback snapshot; on `onSettled`, invalidate so server truth wins. Realtime echo is idempotent because we always invalidate by key.

### 5. Permission-aware syncing

Already enforced server-side: Supabase Realtime applies RLS to broadcast. We additionally guard handlers with `role`/`user.id` checks to avoid pointless invalidations (e.g., students never get `['users']` invalidated).

### 6. Cleanup / lifecycle

- Single `useEffect` in the bridge creates channels on mount, removes on unmount.
- Auto-reconnect handled by supabase-js. Add a `visibilitychange` listener that calls `queryClient.invalidateQueries()` on the active domain when the tab regains focus AND the websocket was disconnected (belt-and-suspenders).

## Files to change

New:
- `supabase/migrations/<ts>_realtime_publication_expand.sql`
- `src/hooks/useRealtimeBridge.ts`
- `src/lib/realtimeRouter.ts` (table → query keys map)

Edited (subscription blocks removed only — no behavioral changes):
- `src/App.tsx` (swap `useRealtimeRequests` for `useRealtimeBridge`)
- `src/hooks/useRealtimeRequests.ts` (deprecate; keep file as thin re-export or delete)
- `src/hooks/useRealtimeStudentAssignments.ts` (deprecate)
- `src/hooks/useRealtimeMessages.ts` (deprecate)
- `src/hooks/useNotifications.ts` (remove channel block)
- `src/hooks/useInvitations.ts` (remove channel block)
- `src/hooks/useInteractionReport.ts` (remove channel block)
- `src/hooks/useStudentProgressReport.ts` (remove channel block)

Optimistic updates added to:
- `src/hooks/useAssignRequest.ts`, `useReassignStudent.ts`, `useMessages.ts`, `useNotifications.ts`, `useSubmitRequest.ts`

Nothing else is touched.

## Validation

1. Two browsers signed in as different roles. Create/update/delete in one → assert the other's UI updates within ~1s on the relevant page.
2. Spot-check: assigning a student in Admin reflects instantly on the Case Manager dashboard, Student Folders, and the student's own dashboard.
3. Network tab: confirm only the bridge channels exist (no duplicate subscriptions per page).
4. RLS: a Case Manager session does not receive payloads for students outside their caseload (verify via Realtime debug logs).

## Risk / non-goals

- No RLS or schema changes.
- No UI redesign.
- No change to mutation contracts beyond adding optimistic handlers.
- Edge functions untouched.
