## My Submissions — student view + edit

Add a student-facing portal area where students can view and edit everything they've submitted: Check-ins, 12-Month Post-Graduation Plan, Intake Survey, and Impact Surveys. Edits are always allowed.

### 1. Database (migration)

Add student UPDATE policies (and where missing, DELETE-restricted append model preserved). Edits are timestamped and audited via `updated_at`.

- `student_checkins`
  - Add `updated_at timestamptz` column (if missing) + trigger `update_updated_at_column`.
  - Policy: `Students can update own checkins` — `USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id)`.
- `post_graduation_plans`
  - Already has `updated_at`. Add policy: `Students can update own plans`.
- `intake_responses`
  - Currently append-only. Add policy: `Students can update own intake responses` so they can revise per-section answers. Keep no-delete.
- `impact_survey_responses`
  - Already has student `ALL` policy — no change.

All policies are `FOR UPDATE TO authenticated` scoped to `auth.uid() = student_id`. No grants needed (existing).

### 2. Hooks (frontend, additive)

- `useStudentCheckIns.ts` — add `useUpdateCheckIn(id)` mutation.
- `usePostGraduationPlan.ts` — add `useUpdatePlan()` mutation + `useMyPlan()` reader (if not present).
- `useIntakeSurvey.ts` — add `useUpdateIntakeSection(id, responses)`.
- `useMyImpactResponses.ts` (new) — list student's own `impact_survey_responses` joined to template title.

### 3. UI

New route `/my-submissions` (in student sidebar under existing nav, labeled "My Submissions") with tabs:

1. **Check-ins** — list by date, each row expands to inline edit form (mood/progress sliders, blockers, wins, notes). Save → mutation. Read-only view first, "Edit" toggles.
2. **Post-Graduation Plan** — shows current plan; "Edit Plan" reuses the existing 4-step `PostGraduationPlan` form pre-populated with current values and switched to update mode.
3. **Intake Survey** — list completed sections; "Edit" opens a section editor (reuse intake field renderers).
4. **Impact Surveys** — list of completed assignments; "Edit Response" opens the response form pre-filled.

Dashboard additions (student view only): a compact "Recent Submissions" card showing the 3 most recent items across types with a "View all" link to `/my-submissions`.

### 4. Routing & Nav

- Add route in `src/App.tsx` (ProtectedRoute, student role).
- Add nav link in `SidebarLayout.tsx` for students only.

### 5. Out of scope

- No changes to staff views, request attachments, or notification routing.
- No edit-history table (relies on `updated_at`).
- No time-window restrictions (per user: always editable).

### Technical notes

- All mutations invalidate the related query keys to keep staff dashboards in sync via the existing realtime router where applicable.
- `PostGraduationPlan.tsx` will accept an optional `mode: 'create' | 'edit'` + initial values prop to avoid duplicating the wizard.
- Intake editing updates `intake_responses.responses` jsonb in place; `intake_completed_at` is preserved.