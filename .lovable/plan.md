## Goal
Guarantee that **platform admins** (`role = 'admin'`) can see every organization's data — including requests, appointments, and notes for suspended orgs — across all list views, with a clear visual badge showing which rows belong to a suspended org.

## What's already correct (verified)
Database RLS already grants admins full read access to suspended-org data:
- `support_requests` → "Admins can view all requests" (no suspension check)
- `appointments` → "Admins can view all appointments" (no suspension check)
- `file_notes` → "Admins can manage all file notes" (no suspension check)
- `profiles`, `student_assignments`, `intake_responses`, `post_graduation_plans`, `student_checkins`, `student_files`, `request_attachments`, `ai_insights` all have admin-bypass policies untouched by the suspension migration.

The suspension gate (`NOT is_user_org_suspended(...)`) only applies to `case_manager` and `org_admin` policies.

## Likely gaps causing the "missing data" feeling

1. **Organization filter dropdown hides suspended orgs.** `useFilterOptions` queries `training_organizations` with `.eq('is_active', true)`. If a suspended org was also marked inactive, admins can't filter to it and it feels "gone."
2. **No visual indication** on admin list rows that a request/appointment/note belongs to a suspended org.
3. **Some list hooks may join `training_organizations` with implicit `is_active` filters** that exclude suspended-org students for everyone, including admins.

## Changes

### 1. Filter dropdown — include suspended orgs for admins
`src/hooks/useFilterOptions.ts`
- Detect admin via `useAuth` and skip the `is_active=true` filter for admins.
- Also fetch `suspended_at` and append "(suspended)" to the org label when set, so admins can filter explicitly.

### 2. Suspended-org badge on list rows
- New `src/components/SuspendedOrgBadge.tsx` (destructive pill).
- New `src/hooks/useSuspendedOrgIds.ts` → returns `Set<string>` of suspended org IDs (cached).
- Render the badge in:
  - `RequestsList.tsx` and `ManageRequests.tsx` rows
  - `AdminDashboard.tsx` critical + recent request rows
  - Student folder list rows (`StudentFolders` / `useStudentFolders` consumer)
  - Appointment list rows

### 3. Audit list hooks for admin-hiding filters
Review and adjust if they silently drop suspended-org rows for admins:
- `useRequests`, `useMyStudents`, `useStudentFolders`, `useAppointments`, `useCaseManagerStats`, `useInteractionReport`.
- Remove any `.eq('is_active', true)` joins on `training_organizations` for admins, or make them opt-in.

### 4. Admin short-circuit on suspension banner/guards
`SidebarLayout.tsx` — ensure the `OrgSuspendedBanner` never renders for users with the admin role (even if their profile happens to belong to a suspended org). Same for any future `useWriteGuard`.

## Out of scope
- No RLS changes (DB is already correct for admins).
- No changes to case-manager or org-admin behavior.
- No new write capabilities — admin writes are already unrestricted.

## Verification
After implementation, as a platform admin with one org suspended:
1. `Requests` / `Manage Requests` / `Admin Dashboard` → suspended-org requests still listed with the "Suspended org" badge.
2. Org filter dropdown → suspended orgs listed with "(suspended)" suffix and selectable.
3. Suspended-org student folder → notes, appointments, intake, plans, check-ins all visible.
4. No suspension banner appears for the admin account.
