

## Plan: Survey Trigger Controls for Admins and Case Managers

### Overview
Add a `survey_invitations` table and UI controls so admins and case managers can send survey requests (3-week check-in or post-graduation plan) to individual students. Students see a banner on their dashboard linking them to the appropriate survey.

### Database

**New table: `survey_invitations`**
- `id` (uuid, PK, default gen_random_uuid())
- `survey_type` (text, not null) — `'checkin'` or `'post_graduation_plan'`
- `student_id` (uuid, not null)
- `sent_by` (uuid, not null)
- `completed_at` (timestamptz, nullable)
- `notes` (text, nullable)
- `created_at` (timestamptz, default now())

**RLS policies:**
- Admins: full access (ALL)
- Case managers: INSERT/SELECT for assigned students only
- Students: SELECT own invitations, UPDATE own (to mark completed)

### Changes

**1. `src/hooks/useSurveyInvitations.ts`** — New hook
- `useSendSurvey` — inserts into `survey_invitations` + creates in-app notification for the student
- `usePendingSurveys` — student query for uncompleted invitations
- `useStudentSurveyHistory` — staff query for a specific student's survey history

**2. `src/components/admin/SendSurveyDialog.tsx`** — New dialog component
- Props: `studentId`, `studentName`
- Survey type selector (Check-In / Post-Graduation Plan)
- Optional notes field
- Calls `useSendSurvey` on submit

**3. `src/pages/StudentDetail.tsx`** — Add "Send Survey" button
- Next to existing "Send Message" and "Schedule Meeting" buttons in the profile header
- Opens `SendSurveyDialog`

**4. `src/pages/Dashboard.tsx`** — Add pending survey banner for students
- Query `usePendingSurveys`; if any exist, show alert card with link to `/check-in` or `/post-graduation-plan`

**5. `src/pages/StudentCheckIn.tsx` and `src/pages/PostGraduationPlan.tsx`** — Mark survey complete
- After successful submission, update `survey_invitations` to set `completed_at`

### File Summary

| File | Action |
|------|--------|
| Migration | Create `survey_invitations` table + RLS |
| `src/hooks/useSurveyInvitations.ts` | Create — survey hooks |
| `src/components/admin/SendSurveyDialog.tsx` | Create — trigger dialog |
| `src/pages/StudentDetail.tsx` | Add Send Survey button |
| `src/pages/Dashboard.tsx` | Add pending survey banner |
| `src/pages/StudentCheckIn.tsx` | Mark checkin survey complete |
| `src/pages/PostGraduationPlan.tsx` | Mark plan survey complete |

