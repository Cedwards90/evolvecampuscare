
# Staff Appointment Scheduling

Extend the existing `ScheduleMeetingDialog` / `appointments` foundation into a full scheduling feature for Case Managers, Org Admins, and Admins.

## 1. Dedicated Appointments page (`/appointments`)

New page for all staff roles (sidebar entry "Appointments", calendar icon):

- **Views:** Toggle between List (upcoming / past tabs) and Month calendar (react-day-picker with dots on booked days).
- **Row/card content:** student name + org, date/time, duration, status pill, meeting link, quick actions (Reschedule, Cancel, Join).
- **Filters:** date range, status, student search. Respects `GlobalFilters` (org/cohort/CM) — admins see all, org_admins scoped to their org, case_managers scoped to their assigned students.
- **"New appointment" button** opens an enhanced `ScheduleMeetingDialog` with a student picker (see §3).

Files: `src/pages/Appointments.tsx`, `src/hooks/useStaffAppointments.ts`, route added in `App.tsx`, sidebar entry in `SidebarLayout.tsx`.

## 2. Quick "Schedule" button on student lists

Add a small calendar-icon button (using existing `ScheduleMeetingDialog`) inline on:

- `MyStudentsSection` rows
- `StudentFolders` table rows
- `ManageRequests` request rows (prefills `requestId`)

No behavior change to the existing dialog on student detail pages.

## 3. Staff-selectable student in the dialog

When opened without a preset `studentId` (e.g. from the Appointments page), the dialog renders a searchable student picker:

- Case managers: only their assigned students.
- Org admins: students in orgs where they are org admin.
- Admins: all students (searchable, paginated).

Reuse the existing `StudentPicker` component.

## 4. Availability slots

Case managers (and org admins/admins for themselves) define weekly recurring availability. Students only see these slots when scheduling.

**New table `case_manager_availability`:**
- `case_manager_id`, `day_of_week` (0-6), `start_time`, `end_time`, `slot_minutes` (default 30), `timezone`, `is_active`.
- RLS: owner + admins manage; authenticated users can read active rows (students need this to see slots).

**New table `appointment_blackouts`** (one-off exceptions / time off): `case_manager_id`, `start_at`, `end_at`, `reason`. Same RLS shape.

**UI:**
- Settings → new "Availability" tab (for staff): weekly grid editor + blackout list.
- `ScheduleMeetingDialog` for students: replace the free time-select with slots computed from the assigned CM's availability minus existing appointments and blackouts.
- For staff scheduling on behalf: keep free time-select but warn if outside availability.

New hooks: `useAvailability`, `useAvailableSlots(caseManagerId, date)`.

## 5. Reschedule & cancel with notifications

- **Reschedule:** dialog opens the existing form prefilled; on save, updates `scheduled_at`/`duration_minutes` and calls `create-calendar-event` edge function in "update" mode (patch Google Calendar event, resend invite).
- **Cancel:** confirm dialog; sets `status='cancelled'`, cancels the calendar event, and triggers a new `notify-appointment-change` transactional email (queued via existing app-email infrastructure) to both parties. In-app notification also inserted.
- Edge function updates:
  - Extend `supabase/functions/create-calendar-event/index.ts` to accept `mode: 'create' | 'update' | 'cancel'`.
  - New template `appointment-changed.tsx` (Reschedule + Cancel variants driven by `templateData.action`).

## 6. Technical notes

- Migration adds two tables with `GRANT`s and RLS as noted above; no changes to existing `appointments` schema.
- `useMyAppointments` unchanged; new `useStaffAppointments` mirrors it for staff role scope.
- All new UI uses existing pill/rounded-full Evolve tokens; no color hardcoding.
- Sidebar count badge for today's appointments (optional, cheap query).

## Out of scope

- External calendar imports (only Google Meet link generation, already present).
- Group/multi-student appointments.
- Public booking links for non-students.
