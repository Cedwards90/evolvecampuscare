## Plan to restore Student Folders sitewide

1. **Fix the folder visibility regression in the backend**
   - Replace direct policy subqueries that read `student_assignments` from other table policies with the existing secure helper `cm_has_assignment(...)`.
   - Apply this to folder-related data tables used across the student folder views, including profiles, student files, file notes, intake responses, check-ins, post-graduation plans, support requests, appointments, certifications, and related folder/analytics records where case-manager access depends on assigned students.
   - Keep the existing rule: case managers only see students assigned to them; org admins remain org-scoped; admins keep full access.

2. **Restore reliable folder list behavior**
   - Update the Student Folders query so it does not silently look like “no folders” when a backend query fails.
   - Make the page show a real error message if access breaks again, instead of the same empty state used for no assigned students.
   - Ensure global organization filters do not hide all folders due to stale saved filters.

3. **Address the scan findings from the same pass**
   - Fix the `organization_memberships` policy that currently lets case managers read all memberships; scope it to their assigned students only.
   - Remove sensitive share-link token exposure risk from Realtime by excluding `request_share_links` from the realtime publication, while preserving normal app access through existing RLS.

4. **Validate after implementation**
   - Re-run targeted policy/grant checks for the folder tables.
   - Re-run the security scan and mark fixed findings once the scanner confirms them.
   - Verify the folder hook can load assigned student IDs, profiles, and folder metadata without returning a misleading empty state.

## Technical notes

- This will be done with a database migration plus a small frontend error-state change.
- No broad access will be added; the fix keeps assignment-based isolation intact.
- I will not make `profiles` or student folder data publicly readable.