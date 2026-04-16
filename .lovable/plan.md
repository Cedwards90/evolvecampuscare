

## Plan: 12-Month Post-Graduation Plan for Students

### Overview
Add a multi-section form where students create a 12-month post-graduation plan covering career, education, housing, finances, health, and personal development. Admins and case managers can view submitted plans from the student detail page.

### Database

**New table: `post_graduation_plans`**
- `id` (uuid, PK)
- `student_id` (uuid, not null)
- `graduation_date` (date, nullable)
- `career_goals` (text)
- `education_goals` (text)
- `housing_plan` (text)
- `financial_plan` (text)
- `health_wellness` (text)
- `support_needed` (text)
- `month_1_3_actions` (text) — first quarter milestones
- `month_4_6_actions` (text) — second quarter milestones
- `month_7_9_actions` (text) — third quarter milestones
- `month_10_12_actions` (text) — fourth quarter milestones
- `additional_notes` (text, nullable)
- `created_at` (timestamptz, default now)
- `updated_at` (timestamptz, default now)

**RLS**: Students insert/view own; case managers view assigned students'; admins view all.

### Changes

**1. Database migration** — Create `post_graduation_plans` table with RLS policies

**2. `src/hooks/usePostGraduationPlan.ts`** — New hook
- `useSubmitPlan` mutation (insert)
- `useMyPlans` query (student's own plans)
- `useStudentPlans` query (staff viewing a student's plans)

**3. `src/pages/PostGraduationPlan.tsx`** — New multi-step form page
- Step 1: Graduation date + career goals + education goals
- Step 2: Housing plan + financial plan + health/wellness
- Step 3: Quarterly milestones (months 1-3, 4-6, 7-9, 10-12)
- Step 4: Support needed + additional notes + review/submit
- Progress bar, back/next navigation (same pattern as IntakeSurvey)
- Success screen after submission

**4. `src/App.tsx`** — Add `/post-graduation-plan` route (student only)

**5. `src/pages/Dashboard.tsx`** — Add card/link for students to access the plan

**6. `src/pages/StudentDetail.tsx`** — Add "Post-Graduation Plan" tab for staff to view submitted plans

### File Summary

| File | Action |
|------|--------|
| Migration | Create `post_graduation_plans` table + RLS |
| `src/hooks/usePostGraduationPlan.ts` | Create — data hooks |
| `src/pages/PostGraduationPlan.tsx` | Create — multi-step form |
| `src/App.tsx` | Add route |
| `src/pages/Dashboard.tsx` | Add plan link for students |
| `src/pages/StudentDetail.tsx` | Add plan view tab for staff |

