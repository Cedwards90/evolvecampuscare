# A single place to create classes and assign students

Today classes (cohorts) can only be created by opening Organizations, clicking into one organization, and scrolling to the "Classes / Cohorts" card. That is why it feels like there is nowhere to do this. Right now there are 45 students, 34 of them are in no class, and only 1 class exists.

## What you'll get

A new **Classes** page in the left menu (under Administration) that works across every organization.

### 1. All classes in one list
- Every class with its organization, dates, graduation status, number of students, and assigned case managers
- Search by class or organization name, filter by organization, and a toggle to hide graduated classes
- "New class" button right at the top — pick the organization in the form, so you never have to hunt for an organization page first

### 2. Create and edit a class
The same form as today: name, organization, description, start date, end date, and a graduation date (which is what tells the system a student's later requests are alumni requests rather than in-class ones).

### 3. Assign people — new and existing
Open a class and get one screen with two tabs:

**Students**
- Left side: everyone not in this class. Right side: everyone already in it. Move people across with checkboxes, search by name or email.
- The left side now also includes students who don't belong to any organization yet (34 students currently have no class, and 2 have no organization). Assigning one of those students to a class also puts them in that class's organization, and the screen says so before you confirm.
- A count of how many students are still in no class at all, with one click to see just them — so older students don't get missed.

**Case managers**
- Add or remove case managers for the class. Adding one assigns every student in the class to them, now and as students join later. Removing keeps existing assignments, as it does today.

### 4. Still available where it is today
The Classes card inside each organization page keeps working exactly as it does now, so nothing you already use changes.

## Access
- Admins: every class in every organization
- Org admins: only classes in their own organizations
- Case managers and students: no change — they don't get this page

Nothing is deleted. Assigning or removing a student only changes which class they are linked to; the student record, requests, notes, and history all stay.

## Technical notes

- New page `src/pages/admin/ClassesPage.tsx`, route `/admin/classes` protected for `admin` and `org_admin`, plus an "Classes" entry in the Administration group of `src/lib/navigation.ts`.
- New `src/components/admin/CohortsIndex.tsx` renders the cross-organization table, reusing the existing `CohortDialog` and `CohortStudentsDialog` so create/edit/assign behaviour stays identical.
- `src/hooks/useCohorts.ts`: extend `useAllCohorts` to return organization name, student count, and case-manager count in one query; add `useUnassignedStudentsCount`. Add `useAssignableStudents(organizationId)` which returns students in that organization **plus** students with `organization_id is null`, flagged so the dialog can show the "will also join this organization" note.
- `useBulkAssignCohort` gains an optional `organizationId`: when set, students whose `organization_id` is null get it written alongside `cohort_id` (and an `organization_memberships` row inserted, matching how membership is recorded elsewhere). Existing organization values are never overwritten.
- `CohortStudentsDialog` switches from `useOrgStudents` to `useAssignableStudents` and passes the class's organization into the bulk assign call. Org-admin scoping continues to come from RLS plus the existing `useMyOrgAdminOrgs` check.
- No database migration and no changes to student-facing screens.
