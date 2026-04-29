# Batch C — Completed

## Done
- **Foundation helpers**
  - `src/lib/utils.ts` — added shared `getInitials(name, email?)`.
  - `src/lib/chartColors.ts` — shared recharts palette.
  - `src/lib/validation.ts` — Zod primitives (email, phone, password, UUID, bounded strings).
- **Skeleton loaders**
  - New: `StatsGridSkeleton`, `TableSkeleton`, `RequestListSkeleton`.
  - Replaced full-page spinners on `Dashboard`, `AdminDashboard`, `StudentDetail`, `RequestsList`, `ManageRequests`.
- **Code-debt cleanup**
  - Removed 17 duplicate local `getInitials` definitions; all now import from `@/lib/utils`.
- **Zod expansion**
  - `IntakeSurvey` — per-step section schemas with bounded text.
  - `StudentDetail` file-note creation — min/max length validation with toast errors.
  - `BulkInviteStudentsDialog` and `DistributeSurveyDialog` already had thorough custom validation; left as-is to avoid regressions.
- **Accessibility**
  - Added `aria-label` to 20 icon-only buttons across Auth, layouts, admin pages, dialogs, and notifications.
  - All new skeleton wrappers use `role="status"` + `aria-live="polite"`.

## Out of scope (future batch, will ask first)
- Splitting large pages (`StudentDetail` 884 lines, `AdminDashboard` 710, `Dashboard` 627, `BulkInviteStudentsDialog` 638).
- ResetPassword Zod migration (already has stronger checklist-based validation).
