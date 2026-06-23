## Goal
One "Surveys" entry in the sidebar instead of three. Inside, a dropdown lets staff (and students) switch between the different survey surfaces without leaving the page.

## Sidebar changes (`SidebarLayout.tsx`)
Collapse three nav items into one per role:
- Staff (admin / case_manager / org_admin): single **"Surveys"** → `/admin/surveys`
- Students: single **"Surveys"** → `/surveys`

Remove the separate `Surveys`, `Life Skills`, `My Surveys` entries.

## Staff hub: `/admin/surveys` (refactor `SurveyResponses.tsx` into `SurveysHub.tsx`)
- Page header: title "Surveys", with a `Select` dropdown labeled "View" at the top-right.
- Dropdown options (URL-synced via `?view=`):
  - **Check-in & post-grad responses** (`view=responses`, default) — current `SurveyResponses` contents.
  - **Life Skills surveys** (`view=lifeskills`) — current `LifeSkillsSurveys` contents (send dialogs, completion stats).
  - **Intake responses** (`view=intake`) — list of student intake submissions (reuses existing intake response hooks already used elsewhere; falls back to "no submissions yet" if none).
- Each view's existing component is extracted into a sub-component (`<ResponsesView />`, `<LifeSkillsView />`, `<IntakeView />`) and rendered conditionally so we keep all the current functionality intact.
- `GlobalFilterBar` stays at top of the hub (already present on responses page) and applies to whichever view is active where it makes sense.

## Student hub: `/surveys` (light refactor of `Surveys.tsx`)
- Add the same dropdown pattern for consistency, with options:
  - **My pending surveys** (default) — current pending/completed list.
  - **Past responses** — same data filtered to completed only.
- Even though there's only one stream today, the dropdown matches the staff UI and gives us a place to add new student survey types later.

## Routing (`App.tsx`)
- Keep `/admin/surveys` (now `SurveysHub`) and `/surveys` (now `SurveysHub` student variant).
- Redirect old paths so existing links/emails keep working:
  - `/admin/lifeskills` → `/admin/surveys?view=lifeskills`
- `/surveys/:slug` (LifeSkillsSurvey renderer) unchanged.
- `/intake-survey` (student intake form) unchanged.

## Files touched
- `src/components/layouts/SidebarLayout.tsx` — collapse nav items.
- `src/pages/admin/SurveysHub.tsx` *(new)* — wraps the three views with a dropdown.
- `src/pages/admin/SurveyResponses.tsx` — export its body as `ResponsesView` (keep page as thin wrapper for backward compat, or delete and route via hub only).
- `src/pages/admin/LifeSkillsSurveys.tsx` — export body as `LifeSkillsView`.
- `src/pages/Surveys.tsx` — add view dropdown.
- `src/App.tsx` — point `/admin/surveys` at `SurveysHub`, add redirect from `/admin/lifeskills`.

## Out of scope
- No changes to survey templates, RLS, edge functions, email flows, or the underlying data.
- No changes to the per-survey response detail dialogs.
