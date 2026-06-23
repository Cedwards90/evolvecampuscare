
## Goal

Turn `/admin/surveys` into a single index that lists **every** survey incorporated into the platform. Each row exposes two actions: **Preview** (see the questions students answer) and **Review Answers** (jump to that survey's responses).

## Surveys to include

| # | Survey | Source table | Preview today? | Review answers today? |
|---|--------|--------------|----------------|----------------------|
| 1 | 3-Week Check-In | `student_checkins` | yes | yes (current Check-Ins tab) |
| 2 | 12-Month Post-Graduation Plan | `post_graduation_plans` | yes | yes (current Post-Grad tab) |
| 3 | Student Intake Survey (sensitive intake) | `intake_responses` | no | partial (per-student folder only) |
| 4 | Career Intake Survey | `career_intake_responses` | no | per-student only |
| 5 | Life Skills — 7 modules × Pre + Post (14 templates) | `impact_survey_templates` (slug `lifeskills-N-pre/post`) | no | aggregate on `/admin/lifeskills` |
| 6 | Life Skills — Final Wrap-Up | `impact_survey_templates` (slug `lifeskills-final`) | no | aggregate on `/admin/lifeskills` |
| 7 | Any other Impact Survey templates (non-lifeskills) | `impact_survey_templates` | no | no |

Two pages survive: `/admin/surveys` (new index) and `/admin/lifeskills` (kept as the Life Skills detail view, linked from the index).

## New index page: `/admin/surveys`

A grouped list (three sections: Core student surveys / Intake / Life Skills & Impact). Each row:

```text
[ Icon ]  Title                           [ submitted/assigned ]
          One-line description            [ Preview ] [ Review Answers ]
```

- **Preview** opens `SurveyPreviewDialog` (extended; see below).
- **Review Answers**:
  - Check-In → `/admin/surveys/responses?type=checkins`
  - Post-Grad Plan → `/admin/surveys/responses?type=plans`
  - Intake / Career Intake → `/admin/surveys/responses?type=intake|career_intake` (new table views, read-only, with per-student drill-in)
  - Life Skills templates → `/admin/lifeskills` (existing detail/send page) and `/admin/surveys/responses?type=impact&template=<slug>` for response list
  - Other Impact templates → same impact responses view

`SurveyViewSwitcher` is removed; the index *is* the switcher.

## Response browser page: `/admin/surveys/responses`

A single page that swaps the table based on `?type=`:

- `checkins` → existing CheckInRow table (moved out of current page)
- `plans` → existing PlanCard list
- `intake` → new read-only table of `intake_responses` (student, organization, submitted_at, click row → opens existing student folder intake panel in a dialog)
- `career_intake` → same shape for `career_intake_responses`
- `impact` (+ optional `template=<slug>`) → table of `impact_survey_responses` joined to template, with row drill-in dialog rendering the answer JSON via a generic `ImpactResponseViewer`

Filters (global org/cohort/year + free-text student search) and CSV export carry over from current page.

## Preview dialog extension

`SurveyPreviewDialog` gets new variants driven by `surveyType`:

- `checkin`, `post_grad` (existing)
- `intake` — render the same questions used in `IntakeSurvey.tsx` in a disabled-fields read-only layout
- `career_intake` — same approach using `CareerIntakeForm` field list
- `impact:<slug>` — fetch the template's `questions` JSON and render each question (scale / multi / text) disabled

A small `<SurveyPreviewButton survey={...} />` wrapper centralizes the open logic so the index, the responses page, and `/admin/lifeskills` all share it.

## Sidebar & routes

- Sidebar "Surveys" entry (staff) keeps pointing at `/admin/surveys`.
- `App.tsx`: add `/admin/surveys/responses` route; keep `/admin/lifeskills`; redirect old direct response URLs there.
- Students: `/surveys` page unchanged (out of scope — request was about the staff Surveys page).

## Files touched

- **New**: `src/pages/admin/SurveysIndex.tsx`, `src/pages/admin/SurveyResponsesBrowser.tsx`, `src/components/admin/SurveyPreviewButton.tsx`, `src/components/admin/ImpactResponseViewer.tsx`
- **Edit**: `src/components/admin/SurveyPreviewDialog.tsx` (add intake / career / impact variants), `src/pages/admin/LifeSkillsSurveys.tsx` (use shared preview button, link to responses browser), `src/App.tsx` (routes), `src/components/layouts/SidebarLayout.tsx` (no-op verify), remove `SurveyViewSwitcher` usages
- **Remove**: `src/components/SurveyViewSwitcher.tsx` (replaced by the index)
- Reuses existing hooks: `useSurveyResponses`, `useLifeSkillsSurveys`, `useIntakeSurvey`, `useCareerIntake`, `useMyImpactResponses` (read paths only)

## Out of scope

- No DB migrations; everything reads existing tables.
- Student-facing `/surveys` is not restructured.
- No new survey types created.
