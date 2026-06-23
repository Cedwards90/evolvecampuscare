Diagnosis:
- Dominic’s account is now accepted, active, has the student role, is assigned to Englewood shared Renewables, and has a student file.
- The current Users page URL is filtered to Cohort 3. Dominic’s profile has no cohort assigned, so the global cohort filter hides him from `/admin/users` and `/student-folders` even though the signup data exists.
- The systemic gap is that invitations currently capture organization and role, but not cohort, so students invited for a cohort can sign up without being placed into that cohort.

Plan:
1. Add cohort support to the invitation flow
   - Add a Cohort selector to the Invite User dialog, scoped to the selected organization.
   - Send the selected cohort with the invitation request.
   - Store the cohort on the invitation record.

2. Apply cohort during invited signup
   - Update the invited-signup database function so accepted invitees get `profiles.cohort_id` from the invitation.
   - Keep existing behavior for role, organization membership, student file creation, and case-manager auto-assignment.
   - If the cohort has assigned case managers, preserve the existing auto-assignment trigger behavior so newly cohorted students are routed correctly.

3. Repair current affected data
   - Assign Dominic Heath to Cohort 3 in Englewood shared Renewables so he appears in the currently filtered Users section and Student Folders.
   - Add a safe one-time repair for accepted invitations that already have a stored cohort after this change, without altering unrelated student/org data.

4. Make the UI less misleading when filters hide valid users
   - On Users and Student Folders, ensure the active global filter state is visible and easy to clear so accepted users are not mistaken as missing when they are only filtered out.

Technical details:
- Database migration: add `cohort_id` to `user_invitations`, with validation that the cohort belongs to the selected organization when both are present.
- Edge function: update `generate-invitation-token` to accept and validate `cohortId`.
- Frontend: update `InviteUserDialog` and `useSendInvitation` types/payloads.
- Data repair: set Dominic’s `profiles.cohort_id` to Cohort 3 only; no destructive updates and no active/deactivated filtering changes.