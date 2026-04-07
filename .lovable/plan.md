
## Plan: 3-Week Student Check-In System

### Overview
Create a recurring check-in survey that prompts students every 3 weeks to share their progress and wellbeing. Students get an in-app dashboard banner plus an email reminder. Responses are visible to students, their assigned case manager, and admins.

### 1. Database Migration

**New table: `student_checkins`**
- `id` (uuid, PK)
- `student_id` (uuid, NOT NULL)
- `mood_rating` (integer 1-5) — how they're feeling
- `progress_rating` (integer 1-5) — self-assessed progress
- `blockers` (text, nullable) — anything holding them back
- `wins` (text, nullable) — what's going well
- `additional_notes` (text, nullable)
- `created_at` (timestamptz, default now())

**RLS policies:**
- Students can INSERT their own + SELECT their own
- Case managers can SELECT for assigned students (via `student_assignments`)
- Admins can SELECT all

### 2. Check-In Page — `src/pages/StudentCheckIn.tsx`

Route: `/check-in`

A short, friendly 1-page form with:
- Mood slider (1-5 with emoji labels: 😔 → 😊)
- Progress slider (1-5: "Struggling" → "Thriving")
- "What's going well?" textarea
- "Any blockers or challenges?" textarea
- Optional additional notes
- Submit button → inserts into `student_checkins`

### 3. Dashboard Banner — `src/pages/Dashboard.tsx`

For students only: query `student_checkins` for the latest entry. If none exists OR the latest is older than 21 days, show a prominent card:
> "Time for your 3-week check-in! Let us know how you're doing."
> [Complete Check-In] button → navigates to `/check-in`

### 4. Email Reminder (Scheduled Edge Function)

**New edge function: `supabase/functions/send-checkin-reminders/index.ts`**
- Runs via pg_cron daily
- Queries students whose latest check-in is older than 21 days (or who have never checked in, with account age > 21 days)
- Sends a reminder email to each eligible student using the existing Resend integration
- Skips students who already have a check-in within the last 21 days

### 5. Check-In History in Student Detail — `src/pages/StudentDetail.tsx`

Add a "Check-Ins" tab showing a timeline of past check-in responses with mood/progress indicators, so case managers and admins can track trends over time.

### 6. Hook — `src/hooks/useStudentCheckIns.ts`

- `useStudentCheckIns(studentId?)` — fetch check-ins for a student
- `useSubmitCheckIn()` — mutation to submit a new check-in
- `useLatestCheckIn()` — fetch only the most recent one (for dashboard banner logic)

### 7. Routes & Navigation

- `src/App.tsx` — add `/check-in` route (student only)
- Sidebar: no permanent link needed; students reach it via the dashboard banner

### File Summary

| File | Action |
|------|--------|
| Migration | Create `student_checkins` table with RLS |
| `src/pages/StudentCheckIn.tsx` | Create — check-in form |
| `src/hooks/useStudentCheckIns.ts` | Create — data hooks |
| `src/pages/Dashboard.tsx` | Add check-in banner for students |
| `src/pages/StudentDetail.tsx` | Add check-in history tab |
| `supabase/functions/send-checkin-reminders/index.ts` | Create — scheduled email reminders |
| `src/App.tsx` | Add route |
