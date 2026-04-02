

## Plan: Training Organizations with Role Assignments

### Overview
Build a training organizations system where admins can manage partner orgs, assign students to them, AND assign staff roles (admin, case_manager) to orgs. This lets you track which staff belong to which partner organization, not just students.

### 1. Database Migration

**New table: `training_organizations`**
```sql
CREATE TABLE public.training_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  contact_name text,
  contact_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: all authenticated can view, admins can manage
```

**Add `organization_id` to `profiles` table**
```sql
ALTER TABLE public.profiles ADD COLUMN organization_id uuid
  REFERENCES public.training_organizations(id);
```

This applies to ALL users (students, case managers, admins) — any role can be associated with an org.

### 2. Admin: Training Organizations Page
**New file: `src/pages/admin/TrainingOrganizations.tsx`**

CRUD page showing:
- Table of all orgs with name, description, contact info, active status
- Member count per org (broken down by role: e.g. "12 students, 2 case managers, 1 admin")
- Add/edit/deactivate orgs
- Click an org row to see its members

**New hook: `src/hooks/useTrainingOrganizations.ts`**

### 3. Assign Any Role to an Org

**InviteUserDialog** (`src/components/admin/InviteUserDialog.tsx`)
- Add org dropdown for ALL invited roles (student, case_manager, admin)
- When invitation is accepted, the org is set on their profile

**UserManagementPage** (`src/pages/admin/UserManagementPage.tsx`)
- Show org column for all users (not just students)
- Allow admins to change a user's org assignment inline
- Add org filter dropdown

### 4. Student Onboarding
**CompleteProfile** (`src/pages/CompleteProfile.tsx`)
- Add org dropdown so students can self-select their org during onboarding

### 5. Student Folders — Filter by Org
**StudentFolders** (`src/pages/StudentFolders.tsx`) + hook
- Add org filter dropdown and org badge on each student card

### 6. Routes & Navigation
- Add `/admin/organizations` route in `App.tsx`
- Add "Organizations" link in admin sidebar (`SidebarLayout.tsx`)

### File Summary

| File | Action |
|------|--------|
| Migration | Create `training_organizations`, add `organization_id` to `profiles` |
| `src/pages/admin/TrainingOrganizations.tsx` | Create — admin CRUD for orgs with member breakdown by role |
| `src/hooks/useTrainingOrganizations.ts` | Create — data hook |
| `src/components/admin/InviteUserDialog.tsx` | Add org dropdown for all roles |
| `src/pages/admin/UserManagementPage.tsx` | Add org column + filter for all users |
| `src/pages/CompleteProfile.tsx` | Add org dropdown |
| `src/pages/StudentFolders.tsx` | Add org filter + badge |
| `src/hooks/useStudentFolders.ts` | Join org data |
| `src/App.tsx` | Add route |
| `src/components/layouts/SidebarLayout.tsx` | Add nav link |

