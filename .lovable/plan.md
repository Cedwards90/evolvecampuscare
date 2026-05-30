
# Impact Analytics — Phase 0: Data Layer

Scope per your answers: just the data foundation now, scoped to Admins + Org Admins, with intake-collected baseline wage + staff-entered outcomes, and admin-editable cost settings for future SROI. UI dashboards come in a later phase.

Good news: most tables already exist (`participant_outcomes`, `participant_demographics`, `impact_survey_templates/assignments/responses`, `funding_goals`, `impact_report_audit`, `donor_report_templates`). This phase fills the remaining gaps.

## What gets built

### 1. New tables (migration)
- **`program_cost_settings`** — admin-editable cost inputs for SROI.
  Columns: `id`, `organization_id` (nullable = global default), `period_start`, `period_end`, `annual_program_cost`, `cost_per_participant_override` (nullable), `avg_public_benefit_offset` (nullable, used for justice-involved / housing-insecure offsets), `currency` (default `USD`), `notes`, `created_by`, timestamps.
  RLS: Admins manage all; Org Admins manage rows where `organization_id` is their org; all staff can SELECT.
- **`participant_funnel_events`** — lightweight event log for the QR → signup → intake → first request → placement funnel.
  Columns: `id`, `user_id` (nullable for pre-signup events), `qr_session_id` (nullable), `organization_id` (nullable), `event_type` (enum-ish text: `qr_scan`, `signup_started`, `signup_completed`, `nda_accepted`, `profile_completed`, `intake_completed`, `first_request_submitted`, `first_meeting_scheduled`, `placement_recorded`), `metadata` jsonb, `created_at`.
  RLS: service role + staff SELECT scoped by org.

### 2. Intake survey extension
- Add a baseline employment block to `src/pages/IntakeSurvey.tsx`:
  - `currently_employed` (yes/no)
  - `baseline_hourly_wage` (numeric, optional)
  - `baseline_weekly_hours` (numeric, optional)
  - `baseline_employer` (text, optional)
- On submit, also upsert a `participant_outcomes` row with `baseline_wage` populated (the row already exists for retention tracking; this just seeds it).
- Store the full block in `intake_responses` as today, so historical answers are preserved.

### 3. Staff outcomes entry UI (minimal)
- New tab "Outcomes" on `StudentDetail.tsx` (staff-only) wired to `participant_outcomes`:
  - Employment status, employer, job title, placement date, hourly wage, weekly hours
  - Retention checkpoints (30/60/90/180/365) — auto-suggest dates from placement date; staff toggle "met"
  - Program completion fields
- Hook: `src/hooks/useParticipantOutcomes.ts` (read + upsert + realtime).

### 4. Cost settings admin page (minimal form, no dashboard yet)
- New section in `src/pages/Settings.tsx` → "Program Costs" card, visible to Admins (global) and Org Admins (their org).
- CRUD list of `program_cost_settings` rows by period.
- Hook: `src/hooks/useProgramCostSettings.ts`.

### 5. Funnel event emission
- Edit existing flows to fire `participant_funnel_events` writes (no UI yet):
  - `useQRSession` → `qr_scan`
  - `AuthContext.signUp` → `signup_started` / `signup_completed`
  - `AcceptNda` success → `nda_accepted`
  - `CompleteProfile` save → `profile_completed`
  - `IntakeSurvey` final submit → `intake_completed`
  - `useSubmitRequest` first-ever request for that student → `first_request_submitted`
  - `useScheduleMeeting` first appointment → `first_meeting_scheduled`
  - Outcomes upsert with `placement_date` set → `placement_recorded`
- All writes scoped by org where available; RLS allows authenticated insert of own/scoped events.

### 6. Realtime + types
- Add new tables to `src/lib/realtimeRouter.ts` and the `supabase_realtime` publication.
- No changes to `types/database.ts` (auto-regenerated from Supabase).

## What is NOT in this phase
- No dashboard pages, charts, SROI calculator UI, equity report, or PDF exports yet — those plug into this data layer in Phase 1.
- No demographics consent UI changes (table already exists).
- No changes to `impact_survey_*` tables (already in place).

## Files touched

```text
supabase/migrations/<new>.sql            (new tables, RLS, grants, realtime)
src/hooks/useParticipantOutcomes.ts      (new)
src/hooks/useProgramCostSettings.ts      (new)
src/hooks/useFunnelEvents.ts             (new — small helper)
src/pages/IntakeSurvey.tsx               (add baseline employment block + outcomes seed)
src/pages/StudentDetail.tsx              (new Outcomes tab)
src/components/outcomes/OutcomesSection.tsx (new)
src/components/admin/ProgramCostSettings.tsx (new)
src/pages/Settings.tsx                   (mount cost settings for admin/org_admin)
src/contexts/AuthContext.tsx             (signup funnel events)
src/pages/AcceptNda.tsx                  (nda_accepted event)
src/pages/CompleteProfile.tsx            (profile_completed event)
src/hooks/useQRSession.ts                (qr_scan event)
src/hooks/useSubmitRequest.ts            (first_request_submitted)
src/hooks/useScheduleMeeting.ts          (first_meeting_scheduled)
src/lib/realtimeRouter.ts                (register new tables)
mem://features/impact-analytics-data-v1  (new memory)
```

## Acceptance
- Admin can add a `program_cost_settings` row from Settings; Org Admin can do the same scoped to their org.
- Student intake captures baseline wage and seeds `participant_outcomes`.
- Staff can record placement + retention + wage on a student from the new Outcomes tab.
- Key lifecycle actions produce `participant_funnel_events` rows visible in the DB.
- No existing flows regress; everything new is permission-scoped.
