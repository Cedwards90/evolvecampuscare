## Goal

Incorporate the three Anthony documents as first-class features inside each student's folder:

1. **Personality Profile** (16Personalities-style)
2. **Career Intake Form** (AVC-style)
3. **Case Management Form (CMF) fields** added to existing Case Notes + PDF export

All three are staff-managed on the student's folder. Students can view their own personality summary and intake (read-only) but cannot edit.

---

## 1. Personality Profile

**New table** `student_personality_profiles` (one row per student):
- `student_id` (unique), `type_code` (e.g. "INTJ-T"), `type_name` (e.g. "Architect")
- Trait sliders: `energy_pct`, `mind_pct`, `nature_pct`, `tactics_pct`, `identity_pct` (0–100 + label intro/extra etc.)
- `strengths text[]`, `weaknesses text[]`, `summary text`
- `assessment_source` (e.g. "16Personalities"), `assessment_url`, `assessed_on date`
- `attachment_path` (PDF in `student-files` bucket, optional)
- `created_by`, timestamps

**RLS**: staff (`can_staff_manage_student`) can read/write; student can read own row.

**UI**: New "Personality" card on `StudentDetail` / student folder with edit dialog (`PersonalityProfileDialog`) — manual type entry, trait sliders, strengths/weaknesses chips, optional PDF upload. Student dashboard gets a read-only summary tile.

**Folder Summary integration**: include personality type + top strengths in AI grounding context.

---

## 2. Career Intake Form

**New table** `career_intake_responses` (one row per student, upsert):
- `student_id` unique
- Status fields: `student_status` (prospective/continuing/alumni/new/returning), `educational_goal`, `referral_sources text[]`, `assistance_areas text[]`, `obstacles text[]`
- Open text: `accomplishment_goal`, `career_influences`, `dream_career`, `considered_majors`, `favorite_subjects`, `least_favorite_subjects`, `strengths_skills`, `work_experience`
- `prior_assessments`, `has_computer_access bool`, `internet_skill_level`
- `availability jsonb` (day → time slots array)
- `completed_at`, timestamps

**RLS**: staff manage; student reads own.

**UI**: New page `/students/:id/career-intake` (staff) with sectioned form mirroring AVC layout. Linked from student folder as a "Career Intake" card showing completion status + last updated. PDF export reusing existing PDF utilities.

---

## 3. CMF fields on Case Notes

Extend existing `file_notes` table with CMF columns:
- `contact_date date` (defaults to created_at date)
- `contact_type text` (email / phone / in-person / Evolve App / other)
- `duration_minutes int`
- `identified_needs int[]` (1–17 codes from the CMF reference list)
- `referral_agency text`, `referral_contact text`
- `next_steps text`

Seed a static reference list of the 17 CMF need categories in code (`src/lib/cmfNeeds.ts`).

**UI**:
- Update `CaseNoteDialog` (or equivalent) to expose the new fields with the needs multi-select and reference legend.
- Update Case Notes table to show date / type / duration / needs columns.
- New **"Export CMF" button** on student folder → generates the Evolve CMF PDF (header with mentor/client/case manager fields + contact log table) via a new edge function `generate-cmf-pdf` reusing `_shared` PDF helpers. Logged to existing audit (folder_summary_audit-style table or new `cmf_export_audit`).
- Folder header gets editable fields: `mentor_name`, `primary_reason_for_contact`, `received_on_caseload_date` — stored on `student_files`.

---

## Technical notes

- 3 migrations (one per area) with proper GRANTs, RLS via `can_staff_manage_student` / student self-read.
- New hooks: `useStudentPersonality`, `useCareerIntake`, extended `useFileNotes`.
- New components under `src/components/students/`: `PersonalityCard`, `PersonalityDialog`, `CareerIntakeCard`, plus update to `FileNoteDialog`.
- New page `src/pages/student/CareerIntake.tsx` (staff edit + student view via role check).
- New edge function `supabase/functions/generate-cmf-pdf/index.ts`.
- PDF for CMF mirrors uploaded layout (Evolve logo header, contact log table, "Revised" footer).

## Out of scope

- Automatic personality assessment (no 16Personalities API integration — manual entry/upload only).
- Migrating historical case notes to fill the new CMF columns (left null).
- Bulk import of past intake forms.

## Verification

1. Create personality profile for a test student → renders on folder + student dashboard read-only tile.
2. Fill career intake → see card status flip to "Complete", PDF export matches AVC layout.
3. Add case note with contact type "Phone", 2 min, need #6, referral "thresholds" → appears in table, CMF PDF export shows the row.
