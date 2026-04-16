

## Plan: Track Cohort Start, Graduation, and Placement Dates

### Overview
Add three date fields to the `profiles` table — `cohort_start_date`, `graduation_date`, and `placement_date` — so staff can track key student milestones. These dates are editable by admins and case managers from the Student Detail page.

### Database

**Migration: Add columns to `profiles`**
- `cohort_start_date` (date, nullable)
- `graduation_date` (date, nullable)
- `placement_date` (date, nullable)

No new RLS needed — existing profile policies already allow admin updates and staff reads.

### Changes

**1. `src/pages/StudentDetail.tsx`** — Display and edit milestone dates
- Show the three dates in the profile header section (below email/phone)
- Add an "Edit Dates" button (for admins and case managers) that opens a dialog with three date pickers
- Save updates via a direct `supabase.from('profiles').update(...)` call

**2. `src/pages/CompleteProfile.tsx`** — Optionally let students set their cohort start and expected graduation dates during onboarding

**3. `src/hooks/useStudentDetail.ts`** — No changes needed; already fetches `select('*')` from profiles, so new columns are included automatically

**4. `src/pages/StudentFolders.tsx`** — Add graduation date column to the student folders table for at-a-glance visibility

### File Summary

| File | Action |
|------|--------|
| Migration | Add 3 date columns to `profiles` |
| `src/pages/StudentDetail.tsx` | Show dates + edit dialog |
| `src/pages/CompleteProfile.tsx` | Add cohort start / graduation fields |
| `src/pages/StudentFolders.tsx` | Show graduation date in table |

