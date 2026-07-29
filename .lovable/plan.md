## Goals
1. Fix the "error page" when clicking case notes drill-down rows on the Reports page.
2. Add an AI-generated caseload summary on `/reports` (Caseload Report), and include case notes from the selected time period in AI summaries for both the caseload and organization reports.

## 1. Fix drill-down error

**Cause:** `DrillDownDialog` links notes rows to `/admin/students/{id}`, but the only student detail route is `/students/:id` (see `src/App.tsx`). Non-admins hit NotFound; admins hit NotFound too because `/admin/students/:id` (without `/submissions`) isn't registered.

**Change:** In `src/components/reports/DrillDownDialog.tsx`, update the notes row `<Link to=...>` to `/students/{student_id}`.

## 2. AI caseload summary + case notes in AI payloads

**Files to touch (report surface only):**

- `src/lib/reportAiSummary.ts`
  - Extend `ReportAISummaryPayload` with an optional `caseNotes` block: `{ total, totalMinutes, byCategory: [{label, count, totalMinutes}], byContactType: [...], byStudent/topStudents: [{label, count}], byAuthor?: [...], recentSamples: [{date, student, author, category, contact_type, duration_minutes, title, snippet}] }`. Snippets are truncated (~240 chars), no PII beyond what staff can already see.
  - Add helpers `buildCaseNotesForAi(summary)` that trims to the top N groups (e.g., top 10) and up to ~15 recent notes to keep the prompt bounded.
  - Update `buildOrgAiPayload` and `buildCaseloadAiPayload` to accept an optional `caseNotesSummary` and attach it.

- `src/components/reports/ReportAISummary.tsx`
  - Extend the local `ReportAISummaryPayload` interface to match (caseNotes optional). No UI changes.

- `src/pages/OrganizationReport.tsx`
  - Pass `caseNotesSummary` (already fetched via `CaseNotesSummaryBlock`'s hook — expose the same query by calling `useCaseNotesSummary` at page level or lifting the data) into `buildOrgAiPayload` and the `<ReportAISummary buildPayload={...}>` payload. The block itself keeps working; we just also read the data at the page level (single query, cached).
  - Include case notes in both the on-page AI summary and the PDF/CSV exports (`tryFetchAiSummary` call sites).

- `src/components/reports/ReportPreview.tsx` (Caseload)
  - Add `<ReportAISummary>` under the existing summary blocks (mirrors org report placement).
  - Fetch case notes summary at this level (or accept it via prop from the report page) and pass it into `buildCaseloadAiPayload`.

- `supabase/functions/report-ai-summary/index.ts`
  - Extend the input schema/prompt to accept `caseNotes` and, when present, ground the "Trends / Improvements / Risk areas / Next steps" sections in category mix, contact-type mix, top themes from `recentSamples`, and total contact minutes. Preserve the "no fabricated data" rule: if `caseNotes` is missing/empty, the response must say so instead of inventing themes.

- Caseload export path (`src/lib/reportExport.ts`)
  - Where it calls `tryFetchAiSummary(buildCaseloadAiPayload(...))`, thread the case notes summary through so the downloaded PDF/CSV AI section reflects notes as well. No other export logic changes.

## Out of scope
- No schema changes, no RLS changes, no changes to unrelated pages, no design-system changes.
- No new AI models — reuses the existing `report-ai-summary` edge function and its default model.

## Verification
- Click a category/student tile in the case notes block on `/reports` → drill-down opens; row link navigates to `/students/:id` successfully for admin, org_admin, and case_manager.
- On `/reports`, click **Generate AI summary** → returns a narrative that references the current period's case note volume, top categories, and contact minutes; when there are 0 notes it explicitly says so.
- Same behavior on `/admin/reports/organization`.
- Downloaded PDF/CSV for both reports contains the AI summary reflecting case notes.
