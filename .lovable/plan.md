## Goal

Ensure every user who joins an organization (via invitation, QR code, or manual membership) is visible to that organization's Org Admins — and stays visible — by treating `organization_memberships` as the source of truth.

## Changes

### 1. Backfill `profiles.organization_id`
For any user who has an active `organization_memberships` row but a NULL `profiles.organization_id`, set the profile's `organization_id` from their most recent active membership. This immediately makes Israel Pettis, Traville Smith, and any similarly affected user visible to their Org Admin.

### 2. Auto-sync trigger on `organization_memberships`
Add an `AFTER INSERT OR UPDATE` trigger that keeps `profiles.organization_id` in sync whenever a membership is created or its `left_at` changes. New active membership → profile gets that org. Membership ended (`left_at` set) → if it was the user's current org, fall back to another active membership or NULL.

### 3. Belt-and-suspenders RLS on `profiles`
Add a second Org Admin SELECT policy that also matches via `organization_memberships`, so even if `profiles.organization_id` is briefly stale, an Org Admin can still see members of their org. Keep the existing policy intact.

### 4. Mirror RLS on related tables (read-only)
The same membership-based fallback is applied to the existing org-scoped SELECT policies on:
- `student_assignments`
- `file_notes`
- `intake_responses`
- `student_files`
- `student_checkins`
- `post_graduation_plans`
- `staff_messages`
- `appointments`
- `request_attachments`
- `request_updates`

This is done via a small helper `user_in_org_admin_scope_v2(actor, target)` that returns true if the target user shares an org with the actor through `profiles.organization_id` **OR** an active `organization_memberships` row. Policies are updated to call the new helper. No write policies are loosened.

## Out of scope
- No UI changes.
- No changes to invitation flow itself.
- No changes to admin-only or case-manager policies.

## Technical notes
- Trigger runs as `SECURITY DEFINER` with `search_path = public`, mirroring existing functions.
- "Active membership" = `left_at IS NULL`.
- Backfill picks the most recent active membership (`ORDER BY joined_at DESC LIMIT 1`) when a user has multiple.
- The new helper is `STABLE SECURITY DEFINER` and is the only function added; no recursive RLS risk because it queries `organization_memberships` and `profiles` directly without referencing policies on those tables that call back into it.
