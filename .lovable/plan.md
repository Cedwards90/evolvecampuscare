# Full Historical Data Export (CSV)

Two deliverables: a one-off export of everything as it stands today, plus a permanent admin export page you can use anytime.

## Part 1 — One-off export now

I generate a CSV per table for all operational data (~70 tables, ~3,000 rows total) plus a combined ZIP bundle, and attach them in chat for download. Includes full detail: DOB, address, phone, case note bodies, request amounts, approvals, audits.

Files: `students.csv`, `support_requests.csv`, `request_line_items.csv`, `request_updates.csv`, `file_notes.csv`, `student_checkins.csv`, `intake_responses.csv`, `impact_survey_responses.csv`, `student_certifications.csv`, `post_graduation_plans.csv`, `time_entries.csv`, `appointments.csv`, `participant_outcomes.csv`, audit/log tables, and reference tables (orgs, cohorts, catalogs).

Two extra "reporting-friendly" flattened files, since raw tables are hard to read:
- `requests_full.csv` — one row per request joined with student name, org, cohort, assigned case manager, amounts, approval status, resolution time.
- `students_full.csv` — one row per student with profile, org, cohort, assigned CM, graduation date, counts of requests/check-ins/notes/certifications.

Survey and intake answers stored as JSON get flattened into readable columns where a known mapping exists; the original JSON is kept in a final column so nothing is lost.

## Part 2 — Admin export page in the app

New route `/admin/data-export`, admin-only (org admins see only their own organizations' data).

- Table picker with select-all, grouped by area (Students, Requests, Surveys & Intake, Notes & Files, Time Tracking, Scheduling, Audit & System, Reference).
- Optional date range filter applied to each table's primary timestamp.
- Optional org / cohort filter reusing the existing global filter options.
- "Include sensitive personal fields" toggle, default ON for admins, with the choice recorded in an export audit log.
- Download options: individual CSV, all selected tables as a ZIP, or the two flattened reporting files.
- Row counts and last-updated shown per table before exporting, so you know what you're getting.
- Export runs through a new secure backend function so it isn't limited by page-size row caps, and streams results in pages for larger tables.

## Technical notes

- New edge function `export-data`: validates the caller's JWT, resolves role, and refuses non-admin callers. Admin gets all rows; org_admin is scoped to `org_admin_orgs()`. Returns CSV text or a ZIP.
- New table `data_export_audit` (who exported, which tables, filters, sensitive-fields flag, row count) with RLS restricted to admins, plus GRANTs.
- CSV writing reuses the existing `csvEscape` / `toCsvSection` conventions from `src/lib/requestAnalyticsExport.ts`; UTF-8 BOM so Excel opens it correctly.
- Nav entry added under the existing admin group in `src/lib/navigation.ts`.
- No changes to existing data, queries, or permissions — export is read-only.
