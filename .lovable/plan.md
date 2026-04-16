

## Plan: Ensure Org Assignment Changes Propagate Site-Wide

### Problem
When users are assigned to organizations (via the Bulk Assign dialog or organization detail page), only 3 React Query caches are invalidated (`training-organizations`, `users-with-roles`, `organization-members`). Other views that display organization data — student folders, student detail, case manager stats, analytics — show stale organization info until a manual page refresh.

### Root Cause
The `useBulkAssignOrganization` mutation's `onSuccess` handler doesn't invalidate all relevant query keys. Several hooks independently fetch and cache organization data.

### Solution
Add the missing query key invalidations to the `onSuccess` callback of `useBulkAssignOrganization` in `src/hooks/useTrainingOrganizations.ts`.

### Changes

**`src/hooks/useTrainingOrganizations.ts`** — Expand `onSuccess` invalidations in `useBulkAssignOrganization`

Add these query key invalidations alongside the existing ones:
- `student-folders` — so the Student Folders page reflects new org assignments
- `organization-detail` — so the Organization Detail page refreshes member lists
- `student-detail` — so individual student pages show the correct org
- `case-manager-stats` — so dashboard stats recalculate
- `analytics` — so admin analytics reflect org changes

**`src/hooks/useTrainingOrganizations.ts`** — Also expand `onSuccess` in `useUpdateOrganization`

When an org's name or status changes, invalidate:
- `student-folders` — org names displayed inline
- `users-with-roles` — org names in user table
- `organization-detail` — the detail page itself
- `org-name` — the `OrgBadgeInline` component's cache

### File Summary

| File | Change |
|------|--------|
| `src/hooks/useTrainingOrganizations.ts` | Add missing query invalidations to `useBulkAssignOrganization` and `useUpdateOrganization` |

Single file change — no database or RLS modifications needed.

