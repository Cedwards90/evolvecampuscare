

## Plan: Sensitive Intake Survey for Student Files

### Design Philosophy
The intake form uses a **strengths-based, conversational tone** — framing questions around "how we can best support you" rather than clinical assessments. Questions use scale sliders and soft language to feel like a check-in, not an interrogation.

---

### 1. Database Migration

Create two tables:

**`student_files`** — auto-created on signup via trigger update
```sql
CREATE TABLE public.student_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE,
  intake_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: students see own, case managers see assigned, admins see all
```

**`intake_responses`** — stores each section's answers as JSONB
```sql
CREATE TABLE public.intake_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  section text NOT NULL,
  responses jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: same pattern as student_files
```

**`file_notes`** — case manager/admin progress notes
```sql
CREATE TABLE public.file_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  note_type text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: case managers (assigned) and admins can read/write; students can read own
```

Update `handle_new_user()` trigger to also insert into `student_files`.

---

### 2. Intake Survey Page (`/intake-survey`) — 4 Gentle Steps

**Step 1 — "About You"** (warm-up, low sensitivity)
- What best describes your current living situation? (On campus / Off campus with family / Off campus independently / Transitional/temporary)
- Are you currently working? (Not working / Part-time / Full-time)
- How would you describe your support network? (Strong / Some support / Limited / Prefer not to say)

**Step 2 — "Day-to-Day Needs"** (financial/basic needs, soft framing)
- "How comfortable do you feel meeting your basic needs right now?" (5-point slider: Very comfortable → Struggling)
- Check any that apply: Food security concerns / Transportation challenges / Childcare needs / Technology/internet access / None of these
- "Is there anything making it harder to focus on your studies?" (optional free text)

**Step 3 — "Your Wellbeing"** (mental health, normalized language)
- "Over the past few weeks, how would you rate your overall stress level?" (5-point slider: Very low → Very high)
- "How often do you feel you have someone to talk to when things get tough?" (Always / Sometimes / Rarely / Prefer not to say)
- "Would you be interested in connecting with any of these resources?" (Counseling / Peer mentoring / Wellness workshops / Crisis support / Not right now)

**Step 4 — "Your Goals"** (forward-looking, empowering)
- "What's the main reason you're reaching out for support?" (Academic challenges / Financial hardship / Personal/emotional wellbeing / Housing concerns / Just exploring resources / Other)
- "What does a successful semester look like for you?" (optional free text)
- "Anything else you'd like us to know?" (optional free text)

Every step has a **"Prefer not to answer"** or **"Skip this section"** option. A small note at the top: *"This helps us understand how to best support you. All responses are confidential and you can skip any question."*

---

### 3. Onboarding Flow Update

**`CompleteProfile.tsx`** — Change redirect from `/dashboard` to `/intake-survey` after profile save.

**`IntakeSurvey.tsx`** — New page with:
- Progress stepper (Step 1 of 4)
- Each section saves to `intake_responses` independently
- "Skip for Now" button on every step (goes to dashboard)
- On final submit, marks `student_files.intake_completed_at`

---

### 4. Dashboard Banner

**`Dashboard.tsx`** — Show a gentle reminder card if `intake_completed_at` is null: *"Complete your wellness check-in to help us support you better"* with a link to `/intake-survey`.

---

### 5. Student File View (Admin/Case Manager)

**`StudentDetail.tsx`** — Add a "Student File" tab showing:
- Intake summary (rendered from `intake_responses` in readable card format)
- Progress notes timeline with "Add Note" form
- Quick indicators (barriers flagged, resources requested)

---

### File Changes

| File | Action |
|------|--------|
| SQL Migration | Create `student_files`, `intake_responses`, `file_notes` + RLS + trigger update |
| `src/pages/IntakeSurvey.tsx` | Create — multi-step sensitive intake form |
| `src/hooks/useIntakeSurvey.ts` | Create — save/load intake responses |
| `src/hooks/useFileNotes.ts` | Create — CRUD for progress notes |
| `src/pages/CompleteProfile.tsx` | Edit — redirect to `/intake-survey` |
| `src/pages/Dashboard.tsx` | Edit — add intake reminder banner |
| `src/pages/StudentDetail.tsx` | Edit — add Student File tab |
| `src/App.tsx` | Edit — add `/intake-survey` route |

