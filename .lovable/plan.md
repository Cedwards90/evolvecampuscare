## Goal

Make the Impact Analytics page interactive: let admins enter the numeric inputs that drive SROI (program cost, baseline wage, public benefit offset, etc.) directly from the page, and add a **Data Coverage** summary card so they can see at a glance what's already entered vs missing across the platform.

## Scope

### 1. Manual number entry on Impact Analytics

Add two editor sections (admin / org admin only) to `src/pages/admin/ImpactDashboard.tsx`:

**A. Program Cost Settings editor** — backed by existing `program_cost_settings` table
- List existing cost periods in scope (annual cost, cost-per-participant override, avg public benefit offset, period start/end, currency, notes)
- "Add cost period" dialog with form fields: period_start, period_end, annual_program_cost, cost_per_participant_override (optional), avg_public_benefit_offset (optional), currency, organization (admin only), notes
- Inline edit + delete per row (admin: all rows; org admin: only their org rows — RLS already enforces this)
- On save, invalidate the `impact-analytics` query so SROI updates immediately

**B. Participant outcomes quick-entry** — backed by existing `participant_outcomes` table
- "Update outcomes" button per student (lives in a compact table of students in scope)
- Form fields: placement_date, employer, job_title, hourly_wage, baseline_wage, weekly_hours, employment_status, program_completed, completion_date, retention milestone checkboxes
- Reuses existing `participant_outcomes` RLS (staff-scoped)

Both editors use `react-hook-form` + `zod` + shadcn `Dialog`/`Form` for consistency.

### 2. Data Coverage summary

New section near the top of Impact Analytics ("What we have on file") that summarizes — for the current filter scope — how much of the data needed to compute impact is already entered:

| Metric | Entered / Total | % |
|---|---|---|
| Students with intake completed | n / total | % |
| Students with demographics | n / total | % |
| Students with post-grad plan | n / total | % |
| Students with outcomes record | n / total | % |
| Students with placement_date | n / placed-eligible | % |
| Students with baseline_wage | n / placed | % |
| Cost periods covering range | count | — |
| Certifications recorded | count | — |
| Funnel events (last range) | count | — |

Rendered as a coverage card with progress bars. Pulls from the same `useImpactAnalytics` query (extended to return a `coverage` object) — no new tables, no new RLS.

### Out of scope
- New tables / migrations (everything uses existing `program_cost_settings` + `participant_outcomes`)
- Editing funnel events, certifications, or check-ins from this page (those have their own existing screens)
- Case manager access — entry stays admin / org admin only

## Files

**Modified**
- `src/hooks/useImpactAnalytics.ts` — return `coverage` object + raw cost rows
- `src/pages/admin/ImpactDashboard.tsx` — add Data Coverage card, Cost Settings editor section, Outcomes editor section

**Created**
- `src/components/impact/CostSettingsEditor.tsx` — list + add/edit/delete cost periods
- `src/components/impact/OutcomesEditor.tsx` — student table + edit dialog for participant_outcomes
- `src/components/impact/DataCoverageCard.tsx` — coverage summary UI
- `src/hooks/useProgramCostSettings.ts` — CRUD hooks
- `src/hooks/useParticipantOutcomes.ts` — list + upsert hooks

**Memory**
- Update `mem://features/impact-analytics` (create if missing) noting entry + coverage capability
