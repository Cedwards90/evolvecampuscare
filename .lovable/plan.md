## Goal
Rename the "3-Week Check-In" survey to "Weekly Check-In" everywhere it's user-visible.

## Changes (label-only, no DB or logic)
- `src/pages/admin/SurveysIndex.tsx` (line 131) — card title
- `src/pages/StudentCheckIn.tsx` (line 111) — page header
- `src/components/admin/SurveyPreviewDialog.tsx` (line 256) — preview title map
- `src/components/admin/SendSurveyDialog.tsx` (line 78) — select option label

Dashboard already says "weekly check-in," so no change there.

## Out of scope
No changes to the check-in cadence, scheduling, reminder timing, DB tables, or routes — purely a display rename.