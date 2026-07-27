## Goal
Surface financial totals on the caseload report (`/reports`) and organization report (`/reports/organization`), and include them in downloaded PDF/CSV exports. The Request Analytics page already shows these — Reports do not.

## What "disbursed" means here
Sourced from existing `support_requests` fields — no schema changes:
- **Total requested** — sum of `requested_amount` across requests in the report's scope/date range.
- **Total approved (disbursed)** — sum of `approved_amount` (the operational proxy for money dispersed; approvals set this via existing `useRequest` flow).
- **Pending** — sum of `requested_amount` where `approval_status = 'pending'`.
- Counts: financial requests total, approved count, partially approved count, denied count.

Grounded only in existing data — no fabricated values. If no financial requests fall in range, tiles show `$0.00` and the block notes "No financial requests in this period."

## Changes

### 1. Caseload report (`/reports`)
- `src/hooks/useInteractionReport.ts`: extend the query to also select `requested_amount`, `approved_amount`, `approval_status`, `category` for requests in the date range for the selected case manager, and return a `financials` object on the report data (totals + counts, scoped to the same window).
- `src/components/reports/ReportPreview.tsx`: add a "Financial assistance" block (4 small stat tiles + a one-line breakdown by approval status). Only render when `financials.count > 0` or always render with zeros — pick "always render, zeros allowed" for consistency.
- `src/lib/reportExport.ts`:
  - PDF: add a "Financial assistance" section between the existing summary and unresolved-requests sections with the totals and status breakdown.
  - CSV: add rows for Total requested, Total approved (disbursed), Pending, and financial request count in the summary block.
- `src/lib/reportAiSummary.ts` (`buildCaseloadAiPayload`): include the new financial totals in the AI payload so the generated summary can reference them.

### 2. Organization report (`/reports/organization`)
- `src/hooks/useOrganizationReport.ts`: aggregate `requested_amount` / `approved_amount` / pending across the org (respecting existing global filters + date range) and per-cohort / per-case-manager breakdowns already computed there.
- `src/pages/OrganizationReport.tsx`: add a "Financial assistance" card row (Requested, Approved/Disbursed, Pending, # financial requests) and extend the existing per-CM and per-cohort tables with a "Approved $" column.
- `src/lib/orgReportExport.ts`:
  - PDF: new "Financial assistance" section with totals and per-CM / per-cohort approved-amount columns.
  - CSV: append financial totals to summary and per-group rows.

### 3. Formatting
- Reuse a single `money(n)` helper (already in `RequestAnalytics.tsx`) — extract to `src/lib/utils.ts` as `formatCurrency` and import in both exports and both report pages. USD, 2 decimals, `$0.00` for null/0.

## Out of scope
- No DB schema changes, no RLS changes, no new tables.
- No changes to how approvals are recorded (existing `RequestActions` flow already writes `approved_amount`).
- Student portal reports unchanged.
- Request Analytics page unchanged (already has this data).

## Files touched
- `src/hooks/useInteractionReport.ts`
- `src/hooks/useOrganizationReport.ts`
- `src/components/reports/ReportPreview.tsx`
- `src/pages/OrganizationReport.tsx`
- `src/lib/reportExport.ts`
- `src/lib/orgReportExport.ts`
- `src/lib/reportAiSummary.ts`
- `src/lib/utils.ts` (add `formatCurrency` helper)

## Verification
- Load `/reports` for a CM with financial requests in the window → see totals, export PDF + CSV, confirm the new section is populated.
- Load `/reports/organization` → same, plus per-CM and per-cohort approved-$ columns.
- Case with no financial requests in range → tiles show `$0.00`, exports include the section with zeros and no fabricated rows.
