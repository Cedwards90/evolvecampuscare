## Goal

Add Life Skills module surveys (pre + post per module, plus a final wrap-up) that students complete in the portal, and let staff send them in bulk to a cohort/class before and after each lesson.

## What changes for users

### Students
- New **"Life Skills Surveys"** section on the dashboard (and `/surveys` page) listing any assigned module survey: pending pre-module, pending post-module, and the final wrap-up.
- Each survey opens in a clean form (1–5 scales rendered as radio pills, open-ended as textareas). Submitting it stores responses and marks the assignment complete.
- The post-module survey can't be opened until the matching pre-module is submitted (so impact deltas are valid).

### Staff (Case Manager / Org Admin / Admin)
- New **"Life Skills"** page under Admin → **`/admin/lifeskills`**.
- Lists the 7 modules + final wrap-up. For each module, "Send Pre-Survey" and "Send Post-Survey" buttons.
- Bulk-send dialog: pick a **cohort**, **organization**, or **manually select students**, then confirm. The system creates one assignment per student and queues an email.
- A small results panel shows submission counts (e.g. "Module 04 Pre: 18/22 submitted") and links to per-module response breakdown.

### Impact reporting
- `/admin/impact` gets a new **"Life Skills Module Impact"** card: average pre vs post confidence per module across all responses (within active global filters), plus the wrap-up NPS.

## How it works

### Survey templates (seeded once)
Use the existing `impact_survey_templates` table with `is_builtin = true`. Add 15 templates:
- 7 × pre-module (`slug: lifeskills-m01-pre` … `m07-pre`)
- 7 × post-module (`slug: lifeskills-m01-post` … `m07-post`)
- 1 × final wrap-up (`slug: lifeskills-final`)

Each template's `questions` JSON encodes the questions from the spec (confidence 1–5, habit 1–5, open-ended goal for pre; knowledge 1–5, action commitment open, resource likelihood 1–5 for post; the full wrap-up question set for final).

Module metadata (name, topic phrase) is embedded in each template so the dashboard renders "Module 04: Financial Literacy — Pre" etc.

### Assignments + responses
Reuse `impact_survey_assignments` (student_id, template_id, next_due_at) and `impact_survey_responses` (responses jsonb, score_summary jsonb). No new tables required — only one new optional column on `impact_survey_assignments`:
- `assigned_by uuid` — who triggered the bulk send (nullable, for staff audit).
- `cohort_id uuid` — to group bulk sends and power per-cohort reporting (nullable).

Score summary stored on submit:
- pre/post: `{ confidence: n, habit_or_resource: n }`
- wrap-up: `{ self_efficacy: {m01..m07}, future_outlook: n, nps: n }`

### Bulk send flow
1. Staff opens `/admin/lifeskills`, picks a template, clicks "Send to…".
2. Dialog: choose recipients (Cohort dropdown / Organization dropdown / pick students). Preview the count.
3. On confirm, the frontend calls a new edge function `send-lifeskills-survey`:
   - Validates staff role + scope (admin / org_admin in scope / case_manager with assignment).
   - Inserts one `impact_survey_assignments` row per recipient (idempotent: upsert on `(student_id, template_id)` when no completed response exists).
   - Inserts one `survey_invitations` row per recipient with `survey_type = 'lifeskills'` so it shows up in existing student notification surfaces.
   - Records a `scheduled_survey_distributions` row for audit + counts.
   - Calls the existing Resend gateway to email each student with a link to `/surveys/<slug>`.

### Student survey UI
- New route `/surveys` lists all pending assignments + links to the relevant form.
- New route `/surveys/:slug` renders the questions from the template JSON dynamically (radio for `scale_1_5`, textarea for `open`, radio group for the 5-point future-outlook scale, 0–10 slider for NPS).
- On submit, writes to `impact_survey_responses` and marks the assignment `last_completed_at = now()`. If the post-survey requires its pre-survey, the loader checks for a completed pre-response and otherwise shows "Complete the pre-module survey first".

### Reporting
- `/admin/impact` adds a "Life Skills Module Impact" card that queries `impact_survey_responses` grouped by template slug, averaging the numeric fields from `score_summary` and computing pre→post deltas per module.

## Technical details

- **Migration**:
  - Add columns `assigned_by uuid`, `cohort_id uuid` to `impact_survey_assignments`.
  - Add `INSERT … ON CONFLICT (student_id, template_id) DO NOTHING` requires a unique index — add `UNIQUE (student_id, template_id)` on assignments (only one open assignment per template at a time; reset by `last_completed_at`).
  - Seed the 15 templates via `INSERT` (data, not schema — uses `supabase--insert`).
  - Extend the `survey_type` allowed values check (if any) to include `'lifeskills'`.
- **New edge function** `supabase/functions/send-lifeskills-survey/index.ts` — input validated with zod (`template_slug`, recipients shape, optional `cohort_id`), staff auth check via JWT, batched inserts + email, returns counts. Uses the Resend connector pattern already established in `send-checkin-reminders`.
- **New files**:
  - `src/pages/admin/LifeSkillsSurveys.tsx` — staff dashboard listing modules with send buttons + completion stats.
  - `src/components/admin/SendLifeSkillsDialog.tsx` — recipient picker (cohort / org / student multi-select).
  - `src/pages/Surveys.tsx` — student list of pending Life Skills surveys.
  - `src/pages/LifeSkillsSurvey.tsx` — dynamic survey renderer (one component handles all 15 slugs).
  - `src/hooks/useLifeSkillsSurveys.ts` — template fetch, assignments, response mutations.
  - `src/lib/lifeskillsTemplates.ts` — module metadata (id → name → topic phrase) for display + seed script reference.
  - `src/components/admin/LifeSkillsImpactCard.tsx` — reporting card on `/admin/impact`.
- **Edits**:
  - `src/App.tsx` — register routes.
  - `src/components/layouts/SidebarLayout.tsx` — "Life Skills" link under Workspace (staff) and "My Surveys" (student).
  - `src/pages/Dashboard.tsx` — show "Pending Life Skills surveys" banner when student has open assignments.
  - `src/pages/admin/ImpactAnalytics.tsx` — mount the new module-impact card.
- **Security**:
  - Existing RLS on `impact_survey_*` already restricts student visibility to own rows; staff scope handled by edge function inserting on their behalf.
  - All inputs zod-validated; staff role + org scope verified server-side; email body uses `encodeURIComponent` for the slug in survey URLs.

```text
Staff → /admin/lifeskills → pick template + cohort → send-lifeskills-survey edge
     → impact_survey_assignments (one per student)
     → survey_invitations (banner in student app)
     → Resend email with link to /surveys/<slug>
Student → /surveys/<slug> → impact_survey_responses (+ score_summary)
     → /admin/impact aggregates pre vs post per module
```

## Open questions

1. **Cohorts**: do you want bulk-send recipients restricted to **cohorts you already use**, or should "by organization" and "manually pick students" also be supported? (I've included all three; happy to trim.)
2. **Pre/Post pairing**: should the student be hard-blocked from submitting the post-survey if they never completed the pre, or should we allow it and just note "no baseline" in reporting? Current plan: hard-block — let me know if you'd prefer soft.
