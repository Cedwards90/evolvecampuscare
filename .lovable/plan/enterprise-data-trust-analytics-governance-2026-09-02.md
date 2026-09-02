# Enterprise Data Trust, Analytics & Governance

A three-phase program to make every number explainable, every record traceable, and every intake flow recoverable. No existing feature is removed; behavior changes are limited to correctness, scope, and governance.

## What is confirmed today (verified in code)

- `useAnalyticsData.ts` pulls whole tables with `select('*')` and aggregates in the browser; it does not apply the global filters shown above it in `AnalyticsDashboard.tsx`. So the filter bar on that page is currently decorative.
- `SubmitRequest.tsx` inserts the request row and fires notifications first (`useSubmitRequest.ts`), then uploads attachments afterward (line ~262). A failed upload leaves a live, notified request with missing evidence.
- `formDraftStorage.ts` flushes drafts on unload with `fetch(keepalive)` using `Bearer ${accessToken || apikey}` — when the session token is unavailable it silently falls back to the publishable key, so the write fails RLS and the draft is lost with no signal to the user.
- Survey/intake answers are stored as free-form JSON with human-readable labels and no version column, and there are no uniqueness constraints on `intake_responses`, `impact_survey_responses`, `student_checkins`, or `post_graduation_plans` — repeated submissions can create ambiguous duplicates.
- `RequestAnalytics.tsx` renders `data.breakdown.slice(0, 200)` — a silent row cap with no "showing X of Y" indicator.

Everything below builds on those findings.

---

## Phase 1 — Trust and correctness

**Server-side validation**
- Add a shared Zod schema module for requests, intake sections, career intake, life-skills responses, post-grad plans, and profile edits; use the same schemas in the forms and in new edge functions.
- Add database-level guards: length limits, date-relationship checks via triggers (DOB in the past, graduation after cohort start), non-negative amounts, normalized email/phone.

**Duplicate and ambiguity prevention**
- Unique constraints: one intake response per `(student_id, section, intake_version)`, one open check-in per period, one plan per student per version.
- Surveys move to a numbered-attempt model: `(student_id, template_id, survey_version, attempt_number)` unique. Corrections create a new attempt and retain who/when/why.

**Transactional submission**
- New `submit-support-request` edge function: validate → create the request in `draft` → attach and verify uploads → commit to `submitted`/`in_progress` → emit audit event → then notify. Notifications only fire after commit.
- Online and offline paths (`useOfflineDrafts.ts`) both call this one function so field coverage and side effects can't drift.

**Draft reliability**
- Fix the beacon auth fallback: never send a draft with the publishable key; queue it locally and retry on next load instead.
- Surface explicit draft status: Saved locally / Synced / Sync failed — retry, with failures logged.
- Cross-device conflicts are preserved (keep both, let the user choose) instead of last-write-wins.
- Add retention: drafts auto-purge after a configurable window; sensitive sections store minimized content.

**Filter and KPI honesty**
- Wire the global filters into `useAnalyticsData` so filters, exports, and AI summaries all read the same scoped dataset.
- Every report and dashboard header shows: active filters, date range, timezone, generated timestamp, row count, and the viewer's access scope.
- Each KPI gets a definition popover (numerator, denominator, population, window, exclusions, last refreshed). KPIs that can't be derived from real data show "Not enough data" instead of a number.

## Phase 2 — Scale and usability

- Move aggregation into security-definer RPCs / views that enforce role and org scope server-side, with date filtering and indexes; expose pre-aggregated daily and monthly rollups.
- Replace browser truncation with server-side pagination: cursor loading, configurable page size, stable sort, column visibility, "showing X of Y", bulk actions.
- Drill-down chain: KPI → segment → record, deep-linkable, reusing the existing `DrillDownDialog`.
- Saved views and saved filter sets per user.
- Export parity: exports run the same scoped query as the view and embed the report metadata header.
- Chart accessibility: text summary of what changed, titled/described charts, expandable data table, keyboard interaction, non-color encoding.

## Phase 3 — Governance

- Audit logging for view, export, edit, and delete of sensitive records, extending the existing audit tables.
- Consent records tied to survey and sensitive-data collection, with version.
- Retention and legal-hold policies; correction and deletion workflows that keep lineage.
- A generated data dictionary page: canonical name, type, allowed values, owner, sensitivity, retention, formula, versioning — sourced from the schemas so it can't go stale.
- De-identified aggregate analytics with small-cohort suppression (counts under a threshold shown as "<n").
- Export watermarking and access logging.

## Survey/intake data migration (approved: migrate with backfill)

Answers move from labels to stable codes.

```text
question_id:   financial_stress
answer_code:   high
answer_label:  High financial stress   (display only)
survey_version: 3
```

- Add `survey_version`, `question_id`, `answer_code` structure alongside the current JSON.
- Backfill existing responses by mapping known labels to codes; unmappable answers are flagged for review rather than guessed, and the original JSON is retained untouched as the source record.
- All reporting queries switch to codes. Labels are never the analytical source of truth.

## Technical notes

- Migrations follow the project's grant-then-RLS order; no destructive changes to data tables, consistent with the data-preservation rule.
- New edge functions validate JWTs in code, use strict CORS and `sanitizeError`, per existing conventions.
- Aggregation RPCs are `SECURITY DEFINER` with role/org scope enforced inside, matching `has_role` / `user_in_org_admin_scope_v2` patterns.
- Existing routes, permissions, MFA behavior, and report layouts stay as they are.

## Sequencing

Phase 1 lands first and is independently shippable. Phase 2 depends on Phase 1's scoped queries. Phase 3 depends on Phase 1's schemas for the dictionary. Each phase is verified with TypeScript checks and Playwright passes over the affected pages before moving on.
