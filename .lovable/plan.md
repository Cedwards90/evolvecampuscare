**Issue found**
Students can complete the visible questions, but the hard gate does not release them because the new student-facing onboarding tables only allow students to read their own career/personality records. The Career Intake and Personality Quiz pages try to upsert rows, but current policies do not allow student insert/update, so the gate never sees those steps as complete.

**Plan**
1. **Add student write policies for onboarding records**
   - Add RLS policies allowing students to insert and update their own rows in `career_intake_responses`.
   - Add RLS policies allowing students to insert and update their own rows in `student_personality_profiles`.
   - Keep staff access unchanged.

2. **Make final completion refresh reliable**
   - After the personality quiz saves, refresh the authenticated profile directly so `onboarding_completed_at` is immediately visible to `ProtectedRoute`.
   - Invalidate the exact onboarding query key so the gate re-checks with fresh data.

3. **Fix step-to-step navigation after Sensitive Intake**
   - Change the onboarding completion navigation in `IntakeSurvey` from `/dashboard` to `/onboarding/career-intake` for student onboarding, so students proceed sequentially instead of relying on a redirect bounce.
   - Remove or disable skip paths that send students to dashboard during hard-gated onboarding.

4. **Validate the flow**
   - Verify the route sequence is Profile → Sensitive Intake → Career Intake → CMF Basics → Personality Quiz → Dashboard.
   - Confirm existing non-student/staff behavior is unchanged and existing onboarded students remain bypassed.