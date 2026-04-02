## Plan: Retroactive Org Assignments + Organization Detail Page

### Overview
Two improvements: (1) make organization assignment carry through all workflows (invitations, signup triggers, and display across the site), and (2) add a dedicated Organization Detail page showing all past and present students per org.

### 1. Retroactive Org Assignment via Invitations

**Database migration:**
- Add `organization_id` column to `user_invitations` table (FK to `training_organizations`)

**Update `handle_invited_signup()` trigger:**
- When an invitation has `organization_id`, set it on the new user's profile during signup

**Files:**
- `src/hooks/useInvitations.ts` — add `organizationId` to `SendInvitationParams`, pass it to edge function
- `src/components/admin/InviteUserDialog.tsx` — wire the existing org dropdown into the `onSubmit` so it's actually sent with the invitation
- `supabase/functions/generate-invitation-token/index.ts` — accept and store `organizationId` on the invitation record

### 2. Organization Detail Page

**New file: `src/pages/admin/OrganizationDetail.tsx`**
- Route: `/admin/organizations/:id`
- Shows org info (name, description, contact, status)
- Lists ALL members (past and present) with role badges, join date, and current status
- "Past" members = users whose `organization_id` no longer matches (requires a membership history table OR simpler: show current members and label inactive ones)
- Tabs: Members, Student Requests summary, Stats
- Link from the org name in the Training Organizations table

**New hook: `src/hooks/useOrganizationDetail.ts`**
- Fetches org by ID, its members (profiles where `organization_id` matches), and aggregate request stats

### 3. Track Past Membership

**Database migration — new table: `organization_memberships`**
```sql
CREATE TABLE public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES training_organizations(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```
- RLS: admins can manage, case managers and authenticated users can view

**Update bulk-assign hook** (`useTrainingOrganizations.ts`):
- When assigning a user to an org, also insert into `organization_memberships`
- When changing orgs, set `left_at` on the previous membership record

### 4. Display Org Throughout the Site

**Files to update:**
- `src/pages/StudentDetail.tsx` — show org badge on student profile header
- `src/pages/RequestDetail.tsx` — show student's org in the request sidebar
- `src/pages/ManageRequests.tsx` — add org column/filter to the requests table

### 5. Routes & Navigation

- `src/App.tsx` — add `/admin/organizations/:id` route
- `src/pages/admin/TrainingOrganizations.tsx` — make org name a clickable link to the detail page

### File Summary

| File | Action |
|------|--------|
| Migration | Add `organization_id` to `user_invitations`, create `organization_memberships` table |
| `handle_invited_signup()` trigger | Set org on profile during signup |
| `supabase/functions/generate-invitation-token/index.ts` | Accept + store `organizationId` |
| `src/hooks/useInvitations.ts` | Add `organizationId` param |
| `src/components/admin/InviteUserDialog.tsx` | Wire org selection into submission |
| `src/pages/admin/OrganizationDetail.tsx` | Create — org detail with members list |
| `src/hooks/useOrganizationDetail.ts` | Create — fetch org + members + stats |
| `src/hooks/useTrainingOrganizations.ts` | Track membership history on assign |
| `src/pages/StudentDetail.tsx` | Show org badge |
| `src/pages/RequestDetail.tsx` | Show student org |
| `src/pages/ManageRequests.tsx` | Add org column/filter |
| `src/App.tsx` | Add org detail route |
| `src/pages/admin/TrainingOrganizations.tsx` | Link org names to detail page |
