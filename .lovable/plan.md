

## Plan: Bulk-Assign Users to Orgs + Toggle Org Status

### Overview
Add two features to the Training Organizations page:
1. A "Bulk Assign" dialog that lets admins select multiple existing users and assign them to an organization in one action.
2. A status toggle button directly in the table row (currently status can only be changed from the edit dialog's switch — make it more accessible).

### Changes

#### 1. Bulk Assign Users Hook
**File:** `src/hooks/useTrainingOrganizations.ts`
- Add `useBulkAssignOrganization` mutation that takes `{ organizationId, userIds }` and updates `profiles.organization_id` for all selected users in a loop (Supabase JS doesn't support `IN` filter on update, so iterate).
- Invalidates both `training-organizations` and `users-with-roles` queries on success.

#### 2. Bulk Assign Dialog Component
**New file:** `src/components/admin/BulkAssignOrgDialog.tsx`
- Receives the target org as a prop.
- Fetches all users via `useUsers()`, shows them in a searchable checkbox list.
- Users already in the org are pre-checked (disabled or removable).
- Filter by role (student/case_manager/admin) and search by name/email.
- "Assign Selected" button calls the bulk mutation.
- Shows count of selected users and a loading state.

#### 3. Organizations Page Updates
**File:** `src/pages/admin/TrainingOrganizations.tsx`
- Add a "Users" icon button in each table row that opens the Bulk Assign dialog for that org.
- Add a clickable status badge or toggle button directly in the Status column so admins can activate/deactivate without opening the edit dialog.
- Wire up state for `bulkAssignOrg` (which org is being bulk-assigned).

### File Summary

| File | Action |
|------|--------|
| `src/hooks/useTrainingOrganizations.ts` | Add `useBulkAssignOrganization` mutation |
| `src/components/admin/BulkAssignOrgDialog.tsx` | Create — searchable user list with checkboxes, role filter |
| `src/pages/admin/TrainingOrganizations.tsx` | Add bulk-assign button per row, inline status toggle |

