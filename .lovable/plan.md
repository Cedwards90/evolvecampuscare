# Restore Student Folder Visibility + Add Data-Loss Safeguards

## What I found

- The Englewood shared Renewables organization still exists in the database.
- Its student data is still present:
  - 22 student profiles
  - 22 student folder rows
  - 88 intake responses
  - 15 check-ins
  - 14 post-graduation plans
  - 23 support requests
- The preview is showing “No student folders found” because profile reads are failing with:
  - `infinite recursion detected in policy for relation "profiles"`
- This is an RLS/access-policy problem hiding data from the app, not evidence that the data was deleted.

## Scope control

I will only touch the data-access path needed to make student folders visible again and add safeguards around that path. I will not redesign pages, change unrelated features, or change student folder content without permission.

## 1. Repair the recursive profile access policy

Create a database migration that removes the recursive `profiles` policy pattern causing the failure:

- Replace direct subqueries against `profiles` inside `profiles` RLS policies with existing security-definer helper functions.
- Specifically fix the org-admin “profiles via membership” policy so it uses `public.user_in_org_admin_scope_v2(auth.uid(), profiles.user_id)` instead of querying `organization_memberships`, `org_admins`, and `training_organizations` inline from the `profiles` policy.
- Keep existing role boundaries:
  - Admins see all profiles.
  - Org Admins see only users in their organization scope.
  - Case Managers see assigned students.
  - Students see only permitted staff/profile data already allowed by the existing rules.

This should restore `/student-folders` visibility without changing the actual student records.

## 2. Validate Englewood folder recovery after the fix

After the migration runs, verify with read-only checks:

- Englewood shared Renewables still has 22 student profiles.
- `student_files`, intake, check-in, plan, and request records still join to those students.
- The frontend query path used by `useStudentFolders` can read profiles again.

If any specific records are truly absent after RLS is fixed, I will stop and ask before restoring or inserting data.

## 3. Add non-destructive migration safeguards

Add a database-side safety function/view for future update checks:

- A read-only `student_data_health` view or function summarizing counts by organization:
  - organization
  - students
  - student folders
  - intake responses
  - check-ins
  - post-graduation plans
  - support requests
  - certifications
- Admin-only visibility.

This gives a quick “before/after” health snapshot before future deployments without exposing student details.

## 4. Add protected-table guardrails for student folder data

Review and tighten only the existing student-folder-related access rules if needed:

- `profiles`
- `student_files`
- `file_notes`
- `student_assignments`
- `intake_responses`
- `student_checkins`
- `post_graduation_plans`
- `student_certifications`
- `support_requests`
- storage buckets used by attachments/certifications

Changes will be limited to fixing unsafe or broken access policies. I will not widen public access and will not make sensitive tables public.

## 5. Keep user data separate from frontend updates

Confirm the app uses database/storage sources for student folders:

- `useStudentFolders` reads from database tables.
- Student detail/folder pages read from database tables.
- Attachments and certifications use storage buckets.

If I find any hardcoded student data in frontend files, I will report it and ask before migrating it.

## 6. Optional recovery paths if records are actually missing

If a later check proves records were deleted rather than hidden, recovery options are:

- Lovable History restore for code-only regressions.
- Database backup / point-in-time restore support from Lovable Cloud if available.
- Reconstruct from existing related tables (for example profiles + roles + membership + intake responses) only after you approve the exact rows to recreate.
- Storage bucket verification for uploaded files; no storage files will be deleted or overwritten.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

## Files / areas likely touched

- Database migration for `profiles` RLS policy repair.
- Possibly a new admin-only health view/function.
- Read-only verification queries.
- No frontend changes unless the fixed RLS reveals an additional page-level bug.

## Out of scope unless you approve separately

- Rewriting Student Folders UI.
- Bulk data edits or deletes.
- Moving data between organizations.
- Restoring from version history by reverting unrelated code.
- Adding external S3 backup automation.

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>