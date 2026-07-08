## Goal
In the Impact Reports UI, each Life Skills module currently shows up as two separate entries (`M01 — Pre`, `M01 — Post`, etc.). Replace those with **one report per module** that compares before vs after in a single view. Sending pre/post surveys stays a two-step flow (they happen at different times), and the underlying pre/post templates and stored responses are unchanged — this is a reporting-layer consolidation only.

## Changes (scoped, no unrelated edits)

### 1. `src/hooks/useSurveyCompletions.ts`
Add handling for a new virtual source `impact:lifeskills-module:<mXX>`:
- Look up both `preSlug(mXX)` and `postSlug(mXX)` templates.
- Return the union of responses from both (used only for completion counts / respondent lists on the report page).

### 2. `src/hooks/useSurveyImpact.ts`
- In `fetchSource`, add a branch for `impact:lifeskills-module:<mXX>` that fetches responses for both pre and post templates of that module and tags each row with `_slug` and `_kind` ('pre' | 'post').
- In `computeSourceMetrics`, add a branch for the same source that produces a **single-module before/after report**:
  - Top metrics: `Pre avg (1–5)`, `Post avg (1–5)`, `Gain (Post − Pre)`, `Pre n`, `Post n`, `Paired students (both pre + post)`, `Avg paired Δ`.
  - Distributions:
    - Grouped bar "Confidence distribution — Pre vs Post" (buckets 1..5, series pre/post).
    - Single bar "Paired gain per student" bucketed by Δ (−4..−1, 0, +1..+4) when paired data exists.
  - Text highlights:
    - "Top goals set (pre)" from the pre `goal` open field (top 10 by frequency, verbatim).
    - "Action commitments (post)" from the post `action_commitment` open field (top 10).
  - All values are deterministic; when a side has zero responses the metric shows `—` and no fabricated values are produced.

### 3. `src/pages/admin/SurveyImpactReports.tsx`
Replace `lifeskillsOptions()` so each module contributes **one** option instead of two:
- Keep `impact:lifeskills-all` ("All modules — Pre vs Post summary").
- For each `LIFESKILLS_MODULES` entry, emit a single option: label `M0X · <Title> — Before vs After`, value `impact:lifeskills-module:<mXX>`.
- Keep the final wrap-up option (`impact:lifeskills-final`) as-is.
- Remove the individual `— Pre` and `— Post` entries.

### 4. `src/pages/admin/SurveysIndex.tsx`
On the Surveys index, collapse the two per-module rows into one row per module:
- Row title: `Module 0X · <Title>`, description mentions pre + post.
- Two "Send" buttons on that row (Send Pre-Survey / Send Post-Survey) — sending remains a two-step flow.
- "Review responses" link goes to `/admin/surveys/reports?survey=impact:lifeskills-module:<mXX>` (the new combined report).
- The Final Wrap-Up row is unchanged.

### 5. Backward compatibility
The old `impact:lifeskills-mXX-pre` / `-post` sources remain functional in both hooks (still used by `LIFESKILLS_MODULES` iteration paths and any deep links). We only remove them from the dropdown menus; anyone with a bookmarked deep link still gets a valid single-side report.

## Out of scope (untouched)
- `src/lib/lifeskillsTemplates.ts` (templates, slugs, questions).
- `impact_survey_templates` / `impact_survey_responses` tables and stored data.
- `send-lifeskills-survey` edge function and the send dialog.
- `LifeSkillsProgressBlock` and the org/student progress reports (they already show one row per module).
- Report AI summary, exports, and any other unrelated feature.

## Files touched
- `src/hooks/useSurveyCompletions.ts` (add branch)
- `src/hooks/useSurveyImpact.ts` (add fetch + metrics branch)
- `src/pages/admin/SurveyImpactReports.tsx` (dropdown options)
- `src/pages/admin/SurveysIndex.tsx` (collapse rows)
