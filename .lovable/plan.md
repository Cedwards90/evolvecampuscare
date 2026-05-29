## Restore full org list in Student Folders dropdown

**Root cause**: The org dropdown on `/student-folders` is built from the list of loaded students (`students.organization_name`). Orgs with no students currently assigned (548 Foundation, Elevate) never appear, so admins can't sort/filter by them. Englewood and Jireh do appear because they have students.

(Data check: Jireh was previously suspended and is now restored. 548 Foundation and Elevate genuinely have 0 student profiles — they're empty orgs, not hidden by RLS.)

### Change

Edit only `src/pages/StudentFolders.tsx`:

1. Import `useActiveOrganizations` from `@/hooks/useTrainingOrganizations`.
2. Replace the derived `orgOptions` (built from students) with the full list of active orgs returned by that hook, sorted alphabetically.
3. Keep the existing filter logic — selecting an empty org will simply show 0 students with the existing empty state.

No backend, RLS, or other page changes.
