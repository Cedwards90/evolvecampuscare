## Problem

On `/students/:id` the action-button row (Send Message, Schedule Meeting, Send Survey, Manage/View Submissions, Edit Profile, Profile History) is a single non-wrapping flex row (`src/pages/StudentDetail.tsx` line 317: `<div className="flex gap-2">`). On narrower widths (≈1000px and below with the sidebar open) the buttons push past the card edge and "Profile History" gets clipped, forcing horizontal scroll.

The cohort `SelectTrigger` above it also has a fixed `w-[240px]` which can contribute to overflow in tight containers.

## Fix (scoped to layout only — no logic changes)

**File:** `src/pages/StudentDetail.tsx`

1. Line 317 button row — allow wrapping and consistent gap:
   - `<div className="flex gap-2">` → `<div className="flex flex-wrap items-center gap-2 min-w-0">`

2. Line 298 cohort select trigger — remove the hard 240px width so it shrinks on narrow screens:
   - `className="h-8 w-[240px] rounded-full"` → `className="h-8 w-full sm:w-[240px] max-w-full rounded-full"`

3. Add `min-w-0` to the profile info column wrapping these rows (the flex child at ~line 240-ish that contains the name, meta, cohort, and buttons) so a long full name / email can shrink instead of pushing width. Confirmed by re-reading the surrounding container before editing; only add `min-w-0` if the current class list doesn't already include it.

4. Quick audit pass in the same file for `whitespace-nowrap`, `w-[...px]`, and unwrapped flex rows in the header/profile card area. Apply the same `flex-wrap` + `min-w-0` treatment only to rows that currently overflow. No changes elsewhere in the app.

## Verification

- Typecheck.
- Manually verify at 1002px (current viewport), ~768px, and ~375px via preview that all six action buttons remain visible, wrap onto 2–3 rows as needed, and no horizontal scrollbar appears on the page or card.

## Out of scope

No changes to `EditProfileDialog`, `ProfileAuditDialog`, business logic, permissions, or any other page.
