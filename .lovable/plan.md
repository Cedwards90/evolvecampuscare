## Root cause

A recent security migration restricted `impact_survey_templates` SELECT to staff only (admin / case_manager / org_admin). Students can no longer read template rows.

The student-facing survey code all depends on reading templates:

- `useMyLifeSkillsAssignments` — joins `impact_survey_templates!inner(...)`. With RLS blocking the join, PostgREST returns **0 rows**, so `/surveys` shows "No pending surveys" even when assignments exist.
- `useMyLifeSkillsResponses` — same inner-join pattern, so the "Completed" section also disappears.
- `useLifeSkillsTemplate(slug)` — direct `.select(...).eq('slug', ...)` returns `null`, so opening `/surveys/<slug>` can't render the questions.
- `useLifeSkillsTemplates` — dropdowns/pickers that reference templates return empty.

DB confirms invitations and assignments exist for the class, so data is fine — students just can't see the joined template.

## Fix

Add a narrow, safe SELECT policy to `impact_survey_templates`:

- Allow any authenticated user to SELECT rows where `is_active = true`.
- Keep the existing "Admins manage templates" (ALL) and "Staff view templates" (SELECT) policies unchanged so staff can still see inactive/archived templates and manage them.

Templates contain only the survey title/description/questions schema — no PII, no responses — so authenticated read of active templates is the correct scope. This restores the `!inner` joins for students without loosening anything sensitive.

## Verification

1. Confirm `/surveys` on a student account now lists Pending assignments with the template title.
2. Confirm `/surveys/lifeskills-m02-pre` renders the questions.
3. Confirm staff-only pages (SurveysIndex, Impact reports) still work.
4. Re-run security linter — no new findings on `impact_survey_templates`.

## Technical

Migration:

```sql
CREATE POLICY "Authenticated view active templates"
  ON public.impact_survey_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true);
```

No other RLS changes needed. `impact_survey_assignments` and `impact_survey_responses` already have student-scoped SELECT policies.
