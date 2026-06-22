## Auto Clock-In Prompt for Case Managers

When a Case Manager (or Admin acting as one) signs in, show a prompt asking if they want to start tracking their shift. The resulting time entry flows into the existing Time Reports section with no schema changes.

### Behavior
- On successful login, if the user has the `case_manager` role and **no active shift** exists in `active_time_sessions`, open a modal: **"Start tracking your shift?"**
  - Fields: Service type (defaults to `case_management`), optional notes.
  - Buttons: **Clock In** (calls existing `time-clock` edge function `clock_in`), **Not now** (dismisses), **Don't ask again today** (sets a `localStorage` flag scoped to today's date).
- If an active shift **already exists** at login, show a small banner/toast instead: "You're still clocked in since {time}. [Clock Out]" — links to `/time-tracking`.
- Only fires once per browser session (per login). No prompt for Students or Org Admins. Admins see it only if they also hold the `case_manager` role.

### Where it shows
- Mounted globally inside `AppLayout` so it triggers on the first authenticated render after sign-in, regardless of landing route.
- Suppressed on `/auth`, `/accept-nda`, and onboarding routes so it doesn't interrupt gated flows.

### Time Reports integration
- No changes needed to reports. Clocking out via the existing flow (Topbar widget or `/time-tracking`) creates a `time_entries` row that already appears in:
  - `/time-tracking` (case manager's own entries)
  - `/admin/time-tracking` (admin/org-admin review + CSV export)

### Technical details
- New component: `src/components/time/ClockInPrompt.tsx` — uses `useActiveShift`, `useClockIn` hooks (already exist).
- Mount point: add `<ClockInPrompt />` once in `src/components/layouts/AppLayout.tsx`.
- Session tracking: a `sessionStorage` key `cm_clockin_prompted` prevents re-prompting on route changes; a `localStorage` key `cm_clockin_skip_YYYY-MM-DD` honors "Don't ask again today".
- No DB migration, no edge function changes, no changes to existing time-tracking pages.

### Out of scope
- Auto clock-out on logout/idle (can be a follow-up).
- Reminders to clock out after N hours.
- Changes to reporting columns or exports.
