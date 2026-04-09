

## Plan: Add Edit Request for Case Managers and Admins

### Problem
The edit request feature hasn't been built yet. It needs to allow both case managers (for assigned requests) and admins (for any request) to edit request details like title, description, category, priority, and requested amount.

### Changes

**1. `src/hooks/useRequest.ts`** — Add `useEditRequest` mutation
- Updates `support_requests` fields: title, description, category, priority, requested_amount
- Creates a `request_updates` entry logging what changed (e.g., "Request modified: title updated, amount changed from $500 to $300")
- Sends in-app notification to the student about the modification

**2. `src/components/requests/RequestActions.tsx`** — Add Edit button + dialog
- Add `'edit'` to `DialogType`
- New props: `requestTitle`, `requestDescription`, `requestCategory`, `requestPriority` for pre-populating the edit form
- Add "Edit Request" button (Pencil icon) visible when status is `submitted` or `in_progress`
- Edit dialog with form fields: title, description, category (dropdown), priority (dropdown), requested amount
- On save, call `useEditRequest` mutation

**3. `src/pages/RequestDetail.tsx`** — Pass additional props to RequestActions
- Pass `requestTitle`, `requestDescription`, `requestCategory`, `requestPriority` so the edit form can pre-populate

### No database changes needed
Both admins and case managers already have UPDATE permission on `support_requests` via existing RLS policies.

### File Summary

| File | Change |
|------|--------|
| `src/hooks/useRequest.ts` | Add `useEditRequest` mutation |
| `src/components/requests/RequestActions.tsx` | Add Edit button + edit dialog |
| `src/pages/RequestDetail.tsx` | Pass request detail props to RequestActions |

