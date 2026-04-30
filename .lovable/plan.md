
# Student Progress Reports

## Goal
Add a **new** per-student progress report alongside the existing caseload Interaction Report. For each assigned student over a daily / weekly / monthly / custom range, summarize case notes, interactions, requests, follow-ups, surveys, check-ins, and status changes — plus structured sections for Progress, Areas Needing Improvement, Risk Indicators, Unresolved Concerns, Recommended Next Steps, and Case Manager Action Items. Strict permission checks, live data, no fabricated insights.

## Scope guarantees
- **Existing caseload Interaction Report stays untouched.** No edits to `useInteractionReport`, `ReportPreview`, `reportExport.ts`, or the existing Reports page logic — we add new files alongside.
- **Frontend + one new edge function only.** No DB schema changes. No changes to RLS, auth, or unrelated pages.
- The only edits to existing files are minimal entry points (a new card / dropdown / route registration). All listed in "Touch list" below.

## Data sources (live, RLS-enforced)
Per `studentId` + range `[from, to]`:
- `support_requests` — opened in range, resolved in range, all currently unresolved
- `request_updates` — status changes in range (joined to requests where the student is `student_id`)
- `file_notes` — author = case manager, student_id = student, in range (incl. note_type breakdown)
- `appointments` — scheduled_at in range (completed vs upcoming)
- `staff_messages` — between student and case manager in range (sent / received counts, last contact)
- `survey_invitations` (+ `intake_responses` summary) — sent / completed in range
- `student_checkins` — in range AND latest 3 for trend
- `profiles` — student + case manager identity
- `student_assignments` — verify the case manager is actually assigned to this student (defense in depth on top of RLS)

## Sections in the report

### 1. Header
Student name, assigned case manager, range, generated-at timestamp, organization (if any).

### 2. Activity summary (deterministic)
Counts: requests opened/resolved/unresolved, emergency count, notes added, messages exchanged, appointments completed/upcoming, surveys sent/completed, check-ins submitted, last contact date.

### 3. Detailed activity (deterministic tables)
- Case notes (date, type, excerpt)
- Status changes (date, request title, from → to, note)
- Follow-ups / appointments (date, title, status)
- Surveys (sent → completed)
- Check-ins (date, mood, progress, wins, blockers)

### 4. Risk indicators (deterministic, rule-based — never AI)
Computed from real data. Each indicator is shown only if its rule fires; otherwise omitted with an "All clear" line.
- **Open emergency request** → any unresolved `is_emergency = true`
- **Stale unresolved request** → unresolved request older than 14 days with no `request_updates` in last 7 days
- **No contact in window** → 0 messages + 0 notes + 0 appointments in range when student has unresolved items
- **Declining mood** → latest 2 `student_checkins` show `mood_rating` decreasing AND latest ≤ 2
- **Declining progress** → same rule on `progress_rating`
- **Reported blockers** → most recent check-in has non-empty `blockers`
- **Missed survey** → survey_invitation older than 7 days with no `completed_at`

### 5. Unresolved concerns (deterministic)
Table of all currently unresolved requests for this student (independent of range), with priority, age, last update date.

### 6. Progress made / Areas needing improvement (AI-summarized, grounded)
- Calls a **new edge function** `student-progress-summary` (Lovable AI Gateway, model `google/gemini-3-flash-preview`).
- Input is **only the real data above** (notes excerpts, check-in trends, request status changes, appointment outcomes). No external context.
- Strict system prompt:
  - Use only the supplied evidence; quote/cite items by id.
  - If evidence for a section is empty or insufficient (configurable threshold: < 2 notes AND < 1 check-in AND < 1 status change AND < 1 appointment in range), return exactly `"Insufficient data for this period."` for that section. Do not infer.
  - Output via tool calling with a strict JSON schema (no free-form text outside the schema).
- The UI shows the AI text **with the underlying evidence list right below it**, plus a small "AI-generated from your data" badge so it's clearly attributed.
- The edge function checks the caller is admin OR the assigned case manager for that student before returning anything (defense in depth on top of RLS).

### 7. Recommended next steps + Case Manager action items (deterministic, derived from rules in §4–§5)
A mapping table turns each fired risk indicator into a concrete suggested action. Examples:
- Open emergency → "Contact student today; document outcome in case notes."
- Stale unresolved request → "Post a status update on request '<title>' or reassign."
- No contact in window → "Schedule a check-in meeting this week."
- Declining mood/progress → "Review with student during next 1:1; consider wellness referral."
- Missed survey → "Resend survey invitation."
- No risks → "No immediate action items." (No AI fabrication.)

## Permission model
- **RLS does the real enforcement** (case manager sees only assigned students; admin sees all).
- React hook also gates queries on `role === 'admin' || (role === 'case_manager' && student is in my assignments)`. If not permitted, hook is disabled and UI shows an "Access denied" empty state.
- Edge function re-validates with the caller's JWT via `auth.getUser()` and checks `student_assignments` (or admin role) before invoking the AI gateway. Follows the existing edge-function security pattern (`_shared/security.ts`, strict CORS, sanitized errors).

## Live data + realtime
- React Query caches per `(studentId, from, to)`. `staleTime: 60s`.
- Realtime channel invalidates the query on inserts/updates to `support_requests`, `request_updates`, `file_notes`, `appointments`, `student_checkins`, `staff_messages`, `survey_invitations` filtered to this `student_id` (mirrors the pattern in `useInteractionReport.ts`).
- AI summary is fetched on demand (not on every realtime tick) — has its own button "Refresh AI summary" and is cached with a longer staleTime; otherwise the deterministic report stays live and the AI summary stays as last generated until refreshed (with a "Generated <time ago>" label).

## Exports
- **PDF** — branded (Forest Green header, footer pagination), uses `jsPDF` + `jspdf-autotable` like existing report. All sections rendered. AI section labeled "AI summary (grounded)". Clear "No data" / "Insufficient data" lines preserved.
- **CSV** — flat sectioned CSV (same convention as `reportExport.ts`).
- **Bulk export** — admin and case manager: "Generate for all my assigned students" button on the Reports page and the CM dashboard. Iterates the assigned student list, generates each report client-side, and:
  - PDF: produces one combined multi-page PDF (one student per section, page break between students). Single download.
  - CSV: produces a single CSV with a `student_id`/`student_name` column on every row.
  - Shows a progress toast (`3 of 12 students…`) and disables the button while running. AI summary is **opt-in** for bulk (default off) to avoid heavy AI usage; user can toggle "Include AI summaries (slower)".

## Routing & entry points

```text
/reports                       (existing) Interaction Report — UNCHANGED
/reports/student               (new)      Student Progress Report (with picker)
/reports/student/:studentId    (new)      Pre-selected student
```

Entry points (new buttons / cards only — no behavior changes elsewhere):
- **Student detail page** (`src/pages/StudentDetail.tsx`): new `GenerateStudentReportCard` next to existing actions. Daily / Weekly / Monthly buttons → deep link to `/reports/student/:id?preset=...`.
- **Reports page** (`src/pages/Reports.tsx`): add a tab/segmented control "Caseload" vs "Per student" at the top. "Per student" routes to `/reports/student`. (Tiny addition; existing caseload UI untouched.)
- **Case Manager dashboard** (`src/pages/Dashboard.tsx`): add `GenerateStudentReportCard` (compact variant) below the existing `GenerateReportCard`. Links to `/reports/student` with the user's assigned-student picker.

## Touch list

### New files
- `src/hooks/useStudentProgressReport.ts` — fetch + assemble all sections, run rule engine, compute risks, expose `{ data, isLoading, isFetching, error, refetch }`.
- `src/lib/studentProgressRules.ts` — pure functions: risk evaluation + next-step mapping. Unit-testable.
- `src/lib/studentProgressExport.ts` — `exportStudentReportPdf`, `exportStudentReportCsv`, `exportBulkStudentReportsPdf`, `exportBulkStudentReportsCsv`.
- `src/components/reports/GenerateStudentReportCard.tsx` — entry-point card (preset buttons + "More options").
- `src/components/reports/StudentReportPreview.tsx` — full sectioned UI (skeleton, error, empty-period, "Insufficient data" states).
- `src/components/reports/StudentPicker.tsx` — searchable student select (assigned students for CM, all students for admin).
- `src/components/reports/AISummaryPanel.tsx` — calls the edge function, shows AI text + evidence list + "Refresh AI summary" + last-generated timestamp.
- `src/pages/StudentProgressReport.tsx` — page at `/reports/student` and `/reports/student/:studentId`.
- `supabase/functions/student-progress-summary/index.ts` — edge function (auth check, assignment check, calls Lovable AI Gateway with tool-calling schema, returns structured JSON). Strict CORS, sanitized errors.
- `supabase/functions/student-progress-summary/deno.json`

### Edited files (minimal, additive only)
- `src/App.tsx` — register two new routes.
- `src/pages/Reports.tsx` — add "Caseload / Per student" tab header. Existing report logic untouched.
- `src/pages/Dashboard.tsx` — add `GenerateStudentReportCard` under existing report card (case-manager view only).
- `src/pages/StudentDetail.tsx` — render `GenerateStudentReportCard` (admin + assigned case manager only).
- `supabase/config.toml` — register new edge function (no settings changes elsewhere).

### Explicitly NOT touched
- `useInteractionReport.ts`, `ReportPreview.tsx`, `reportExport.ts`, `GenerateReportCard.tsx`, `ReportRangePicker.tsx`, `CaseManagerDetail.tsx` — left exactly as-is.
- No DB migrations. No RLS changes. No auth changes. No notification/email logic. No changes to other pages.

## Anti-fabrication guarantees
- All counts and tables come from real DB rows (no AI in §1–§5 and §7).
- AI is used only for §6 narrative summaries and is constrained:
  - Tool-calling JSON schema (no free text outside fields).
  - System prompt forbids inferring beyond supplied evidence.
  - If evidence under threshold → exact string `"Insufficient data for this period."`.
  - UI labels the AI text and shows the source evidence inline.
- "Recommended next steps" come from a deterministic rule→action map, not from AI.

## Acceptance checklist
- Case manager sees the student picker showing only their assigned students.
- Admin sees every student in the picker and can generate for any.
- Unauthorized direct URL (`/reports/student/<not-mine>`) shows access denied, no data.
- Empty range produces a clearly empty report (no fake "Progress made" sentences).
- Real data flows through both deterministic sections and AI summary; turning Wi-Fi off mid-flow surfaces a clean error toast.
- PDF and CSV downloads contain all sections; bulk export combines all assigned students into one file.
- Realtime: adding a new note / status change updates the on-screen report within seconds without a full refresh.
- Existing `/reports` Interaction Report is unchanged and still works.

