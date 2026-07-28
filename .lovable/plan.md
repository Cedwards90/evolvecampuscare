## Goal

Enhance the Reports section (Caseload report at `/reports` and Organization report at `/reports/organization`) with:
1. A **Case Notes summary panel** grouped by student, case manager, date range, and note category, gated by existing RLS.
2. **Clickable report categories** that open a **drill-down dialog** listing the underlying students/requests/notes with links back to the source record.
3. **Additional filters** (organization, program/class, case manager, student, category, status, date range) wired to the shared filter bar with real-time updates and export.

No changes outside the Reports feature. All data comes from existing tables (`file_notes`, `support_requests`, `profiles`, `student_assignments`, `training_organizations`, `cohorts`) already scoped by RLS — no new tables, no schema changes, no fabricated data.

---

## 1. Case Notes summary panel

New component `src/components/reports/CaseNotesSummaryBlock.tsx`:

- Fetches `file_notes` in the report's date range via a new hook `src/hooks/useCaseNotesSummary.ts` (RLS-scoped; case managers see only their students, org admins their orgs, admin all).
- For caseload report: filtered to `author_id = caseManagerId` OR students on that CM's caseload.
- For org report: filtered to students in the selected organization(s).
- Displays aggregate tiles + three groupings:
  - **By category** (`note_type` + `contact_type`): counts and total minutes.
  - **By student**: student name (link to `/admin/students/:id`), note count, last contact date.
  - **By case manager** (org report only): author name (link to CM detail), note count.
- Each row/tile is clickable → opens the drill-down dialog (see §2) pre-filtered.
- "View full history" per student links to existing `/admin/students/:id/submissions` and student file page.

Rendered inside `ReportPreview.tsx` (caseload) and `OrganizationReport.tsx` (org), respecting current preview/hidden loading states.

---

## 2. Clickable drill-down dialog

New component `src/components/reports/DrillDownDialog.tsx` — a shared shadcn `Dialog` reused across all categories.

Opens with a typed payload:

```ts
type DrillDown =
  | { kind: 'requests'; title: string; rows: SupportRequest[] }
  | { kind: 'notes';    title: string; rows: FileNote[] }
  | { kind: 'students'; title: string; rows: StudentAssignment[] }
  | { kind: 'appointments'; title: string; rows: Appointment[] };
```

Contents:
- Sortable table (student, date, category/type, status, amount when applicable).
- Row click → deep link to the underlying record:
  - Requests → `/requests/:id`
  - Notes → `/admin/students/:studentId` (case notes tab)
  - Students → `/admin/students/:id`
  - Appointments → `/appointments` with `?id=`
- "Export CSV (this list)" button reusing the same CSV helpers from `reportExport.ts` / `orgReportExport.ts`.

Wire clickable regions in existing report UI:
- `ReportPreview.tsx`: summary tiles (Active students, Requests opened/resolved, Unresolved, Emergency), category rows, priority rows, follow-ups list, financials tiles.
- `OrganizationReport.tsx`: summary cards (Students, Requests opened/resolved, Financials, Certifications), per-CM and per-cohort rows.
- `CaseNotesSummaryBlock` tiles/rows.

Each click computes the filtered subset from the already-loaded `InteractionReport` / `OrgReport` data — no extra network round-trip.

---

## 3. Filters + real-time + export

- Extend `GlobalFilterBar` usage on `/reports` and `/reports/organization` to include the full set already supported by `GlobalFiltersContext`: organization, cohort (class), year of study, case manager, status, plus a new **student picker** and **note category** filter local to the Reports pages (kept in page state to avoid changing the shared context).
- Apply these filters client-side in `ReportPreview` and `OrganizationReport` before rendering (mirrors current `filteredData` pattern in `Reports.tsx`).
- Real-time: the existing `useRealtimeBridge` already invalidates `support_requests`, `file_notes`, and `appointments`. Confirm `file_notes` is in the bridge; if not, add a subscription in the new `useCaseNotesSummary` hook (same pattern as `useFileNotes`).
- Export: add "Case notes summary" section to `reportExport.ts` (PDF + CSV) and `orgReportExport.ts`, using the same aggregates rendered on-screen. Drill-down dialog gets its own inline CSV export.

---

## Files to add

- `src/hooks/useCaseNotesSummary.ts`
- `src/components/reports/CaseNotesSummaryBlock.tsx`
- `src/components/reports/DrillDownDialog.tsx`
- `src/components/reports/ClickableStat.tsx` (small wrapper around the existing tile styles so we don't restyle each stat)

## Files to edit (Reports feature only)

- `src/components/reports/ReportPreview.tsx` — mount case notes block, wire clicks, add student/category filter chips.
- `src/pages/Reports.tsx` — add local student + note-category filter state; pass into preview.
- `src/pages/OrganizationReport.tsx` — mount case notes block, wire clicks, extra filter chips.
- `src/lib/reportExport.ts` and `src/lib/orgReportExport.ts` — add case notes section to PDF/CSV.
- `src/hooks/useRealtimeBridge.ts` — only if `file_notes` isn't already subscribed there (confirm before editing).

## Out of scope

- No changes to `support_requests`, `file_notes`, or profile schemas.
- No changes to non-Reports pages, sidebar, or global filter context shape.
- No AI summary changes this turn (existing AI payload is unchanged).

## Verification

- Load `/reports` as admin, case manager, org admin: confirm case notes counts match `SELECT count(*) FROM file_notes WHERE …` for the same window.
- Click each tile/row → dialog shows the exact rows; row link navigates to the correct record.
- Change global filters → all blocks (including case notes) update without a full refresh.
- Export PDF/CSV includes the new Case Notes section.
- RLS: case manager sees only their notes; org admin sees only their org's notes; student role cannot reach `/reports` (unchanged).
