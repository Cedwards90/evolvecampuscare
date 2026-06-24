## Goal

Add a Life Skills "By module" impact view that pairs **pre vs post** results for each of the 7 modules in one report, so staff can see actual learning gains rather than viewing pre and post as separate, disconnected surveys.

## Changes

### 1. New survey option: "Life Skills — All modules (Pre vs Post)"
- Add a synthetic source value `impact:lifeskills-all` to the survey dropdown in `SurveyImpactReports.tsx`, listed first under the Life Skills group and also set as the destination of the SurveysIndex "Impact report" button when clicking the Life Skills card.
- Existing per-slug pre/post options remain (for users who want to drill into one module).

### 2. New hook branch in `useSurveyImpact.ts`
When `source === 'impact:lifeskills-all'`:
- Fetch every `impact_survey_responses` row whose template slug matches `lifeskills-m%-pre` or `lifeskills-m%-post` within the date range (single query joining `impact_survey_templates`).
- Apply the same profile/org/cohort/CM global filters already used for other sources.
- Aggregate per module:
  - `pre_n`, `post_n` (response counts)
  - `pre_avg_confidence`, `post_avg_confidence` (1–5)
  - `delta = post_avg − pre_avg`
  - `paired_n` = students with both a pre and post response
  - `paired_avg_delta` = mean of per-student (post − pre) confidence among paired
- Return data shaped to fit the existing report renderer:
  - `metrics`: totals across all modules (e.g. "Modules with post data", "Avg pre", "Avg post", "Avg gain", "Paired respondents")
  - `distributions`: two charts — **"Avg confidence by module (Pre vs Post)"** (grouped bars) and **"Confidence gain by module"** (single-bar delta)
  - `textHighlights`: per-module table rows (module name, pre avg / n, post avg / n, delta, paired n)
  - `rows`: per-response rows tagged with module + pre/post (used for CSV)

### 3. Renderer tweak in `SurveyImpactReports.tsx`
- Support a grouped bar chart for the Pre vs Post distribution (extend the distribution shape with optional `series` so the renderer knows to draw two bars). Other distributions remain single-bar — backward compatible.
- The per-module summary table renders through the existing `textHighlights` block (already a label + count list), but with a small change to allow extra columns when items carry `extra` fields. Falls back to current display otherwise.

### 4. PDF / CSV export
- `surveyImpactExport.ts`:
  - PDF: when source is `impact:lifeskills-all`, render a "Module impact summary" table (Module · Pre avg (n) · Post avg (n) · Delta · Paired n) before the generic distribution tables.
  - CSV: emit a `## Module impact` section with the same columns, then the existing raw-rows section (one row per response, tagged with module and pre/post).

### 5. Entry point
- `SurveysIndex.tsx`: the Life Skills card's "Impact report" button links to `/admin/surveys/reports?survey=impact:lifeskills-all` (per-module pre/post option). Other survey cards unchanged.

## Out of scope
- No DB schema changes, no edge function changes, no new permissions.
- Final-survey NPS report stays as its own option.
- No changes to how surveys are taken or assigned.

## Files

- `src/hooks/useSurveyImpact.ts` — add `impact:lifeskills-all` branch and aggregator
- `src/pages/admin/SurveyImpactReports.tsx` — new option, grouped-bar support, per-module table rendering
- `src/lib/surveyImpactExport.ts` — module-impact section in PDF and CSV
- `src/pages/admin/SurveysIndex.tsx` — Life Skills card button target
