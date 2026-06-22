## Goal
Make Career Intake, CMF Basics, and a new MBTI-style Personality Quiz part of a hard-gated onboarding flow that every new student must complete before reaching the dashboard.

## Onboarding flow (hard gate)
After signup, students are routed sequentially and cannot reach `/dashboard` until all steps are done:

```text
Signup → 1. Profile Completion (existing)
       → 2. Intake Survey (existing sensitive intake)
       → 3. Career Intake (new student-facing form)
       → 4. CMF Basics (new short student form)
       → 5. Personality Quiz (new 28-question MBTI-style)
       → Dashboard
```

A new `OnboardingGate` wrapper (used in `App.tsx` for student routes) checks completion status of all 5 steps via a single `useStudentOnboardingStatus` hook and redirects to the first incomplete step. A persistent progress header (Step X of 5) is shown on every onboarding page with Back/Continue buttons. Staff/admin/org_admin roles bypass the gate entirely.

## New pages
- `/onboarding/career-intake` — student-facing version of the existing Career Intake form (writes to `career_intake_responses`, marks `completed_at`).
- `/onboarding/cmf-basics` — short form: `primary_reason_for_contact` (textarea), `identified_needs` multi-select (the 17 CMF needs from `src/lib/cmfNeeds.ts`), `preferred_contact_type` (in-person / phone / video / email). Saved to `student_files` header fields + a new `cmf_preferred_contact_type` column.
- `/onboarding/personality-quiz` — 28 forced-choice questions, scored into a 4-letter MBTI type + Turbulent/Assertive suffix, plus four trait percentages (Energy, Mind, Nature, Tactics, Identity). Writes to existing `student_personality_profiles` with `assessment_source = 'self_quiz'`.

## Personality quiz design
- 28 questions, 4 axes × 7 questions each, plus 4 Identity (T/A) questions = 32 total, 5-point Likert ("Strongly disagree" → "Strongly agree").
- Static question bank in `src/lib/personalityQuiz.ts` (no DB table needed — questions are versioned in code).
- Scoring done client-side, producing: `type_code` (e.g. "INTJ-T"), `type_name`, `energy_pct` / `mind_pct` / `nature_pct` / `tactics_pct` / `identity_pct`, plus `strengths[]` and `weaknesses[]` looked up from a static 16-type description map.
- One question per screen with progress bar; "Back" allowed; answers held in local state until final submit.
- Results screen shows type, trait bars, strengths, and growth areas, with "Continue to dashboard" button. Student can retake later from their profile.

## Existing surfaces updated
- `Dashboard.tsx` student banner: remove the standalone "Intake Survey" CTA — onboarding gate handles it.
- Student profile page: add "Retake Personality Quiz" and "Update Career Intake" links (post-onboarding edits remain available).
- Staff `PersonalityCard` and `CareerIntakeCard` on student folder: unchanged read/write surface; just now usually pre-populated by the student.
- `useStudentOnboardingStatus` returns `{ profileDone, intakeDone, careerDone, cmfDone, personalityDone, nextStep }` driven by a single batched query.

## Database
One migration adds:
- `profiles.cmf_preferred_contact_type text` (nullable).
- `profiles.onboarding_completed_at timestamptz` (set when personality quiz is submitted; used as a fast-path check by the gate).
- No new tables — reuses `career_intake_responses`, `student_files`, `student_personality_profiles`.

## Out of scope
- Backfilling existing students through the new gate (existing students keep current access; only users who signed up after this change are gated).
- Admin-configurable question bank for the personality quiz (questions live in code for now).
- Localization of the new quiz copy (English only this pass; existing Spanish toggle untouched).

## Technical notes
- `OnboardingGate` lives at `src/components/onboarding/OnboardingGate.tsx` and wraps the existing student route group in `App.tsx`. It uses React Query so transitions feel instant.
- Step pages share a `<OnboardingShell>` layout (logo, step indicator, card, nav buttons) for consistency.
- Personality scoring helper + 16-type descriptions: `src/lib/personalityQuiz.ts` (pure functions, unit-test friendly).
- CMF basics form reuses the `cmfNeeds.ts` constants already in the codebase.
- Existing students (created before `onboarding_completed_at` exists) are treated as completed via a one-time data update in the same migration to avoid locking them out.
