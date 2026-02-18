

## Improvement Plan: UX/UI Polish and Production Readiness

This plan addresses the 10 categories of improvements identified during the review. Changes are grouped by priority.

---

### 1. Remove Mock/Seed Data from Track Requests Page (Critical)

**Problem:** The TrackRequests page (`/student-tracking-request-status-scheduling-meeting`) imports and displays hardcoded mock data from `mock-data.ts` instead of fetching real data from the database. New users see fake 2024-era requests.

**Fix:**
- Rewrite `src/pages/TrackRequests.tsx` to use the existing `useRequests` hook (already used elsewhere) to fetch real `support_requests` from the database
- Fetch real appointments from the `appointments` table using a new `useMyAppointments` hook
- Create `src/hooks/useMyAppointments.ts` to query the `appointments` table for the current user
- New users will correctly see "You haven't submitted any support requests yet"

---

### 2. Fix Submit Request Step Validation (Critical)

**Problem:** On step 2, clicking "Next" does not validate the title/description fields before advancing to step 3 (attachments). The user can reach the review step with empty required fields, and clicking "Submit" may confuse users since validation errors are shown only after submit attempt.

**Fix:**
- Add per-step field validation in the `nextStep` function:
  - Step 2: Trigger validation on `title`, `description`, and `priority` before advancing
  - Use `form.trigger(['title', 'description'])` to show inline errors immediately
- On step 4 (review), change the button label from generic "Submit Request" to make it more prominent
- This ensures errors surface at the right step, not at the end

---

### 3. Terms of Service Checkbox on Sign-Up (High)

**Problem:** No required terms/privacy acceptance during registration, which is needed for GDPR/CCPA compliance.

**Fix:**
- Add a `termsAccepted` boolean field to the signup form schema with validation requiring `true`
- Add a checkbox below the confirm password field with text: "I agree to the Terms of Service and Privacy Policy" with linked placeholders
- The checkbox must be checked to enable the "Create Account" button

---

### 4. Show Password Requirements Before Typing (High)

**Problem:** Password requirements are only surfaced through the strength meter after the user starts typing. Users don't know requirements upfront.

**Fix:**
- Add a static requirements list below the password field in the signup form, showing:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
- Each requirement gets a checkmark or X icon that updates in real-time as the user types
- This replaces the vague strength meter with actionable feedback

---

### 5. Phone Number Validation (High)

**Problem:** Phone field in Settings has no validation -- users can enter any string.

**Fix:**
- Update the profile schema in `src/pages/Settings.tsx` to validate phone using a regex pattern: `/^\+?[\d\s\-()]{7,20}$/`
- Add an error message: "Please enter a valid phone number"
- Add `inputMode="tel"` attribute for mobile keyboard optimization

---

### 6. Schedule Meeting Confirmation Step (Medium)

**Problem:** On the TrackRequests page, the "Schedule a Meeting" dialog lets users click time slots but there's no confirmation -- clicking a time button does nothing. The dialog uses hardcoded static time slots and has no submit action.

**Fix:**
- Replace the dummy scheduling dialog in `TrackRequests.tsx` with the existing `ScheduleMeetingDialog` component (which already has proper form validation, confirmation, and calendar event creation)
- The existing component already handles date/time selection, duration, and a "Schedule Meeting" submit button with loading state

---

### 7. Account Deletion / Data Management (Medium)

**Problem:** No self-service account deletion option, which is required by GDPR (right to erasure) and CCPA.

**Fix:**
- Add a "Danger Zone" card at the bottom of the Settings profile tab
- Include a "Delete My Account" button with a confirmation dialog requiring the user to type "DELETE"
- Create a new edge function `delete-own-account` that:
  - Verifies the requesting user is deleting their own account
  - Performs the same data cleanup as the admin `delete-user` function
  - Calls the Supabase Admin API to delete the auth user
- After deletion, sign the user out and redirect to the landing page

---

### 8. Dynamic Breadcrumb Navigation (Low)

**Problem:** The breadcrumb in the top header is hardcoded to "Dashboard / Home" regardless of current route.

**Fix:**
- Update `SidebarLayout.tsx` to derive breadcrumb text from the current route using `useLocation`
- Create a route-to-label mapping from the existing `navItems` array
- Display the matched label dynamically (e.g., "Settings", "Manage Requests", etc.)

---

### 9. Offline Indicator in Global Layout (Low)

**Problem:** The offline status is only shown on the Offline Drafts page badge. There's no global feedback when network is lost on other pages.

**Fix:**
- The `OfflineIndicator` component already exists and is rendered in `SidebarLayout.tsx` (line 287), but only when `!isOnline`. It renders as a fixed-position toast at bottom-left.
- The component is already global. Verify it actually renders by checking the `OfflineContext` is properly provided in the app tree. The `OfflineProvider` wraps the app in `main.tsx` so this should work. No code changes needed -- this is already implemented correctly.

---

### 10. Spanish Translation Coverage (Low)

**Problem:** Spanish is available in the language dropdown but translations only cover navigation and common strings -- page-specific content (form labels, headings, descriptions) is still hardcoded in English.

**Fix:**
- This is a large localization effort. For this iteration, add translation keys for the most visible strings:
  - Submit Request page headings and labels
  - Track Requests page headings
  - Settings page tab labels and descriptions
- Expand the `translations` object in `src/lib/i18n.ts` with these new keys
- Replace hardcoded strings in those pages with `t()` calls

---

### Summary of Files to Create/Modify

| File | Action | Issue |
|------|--------|-------|
| `src/pages/TrackRequests.tsx` | Rewrite to use real data | #1, #6 |
| `src/hooks/useMyAppointments.ts` | Create | #1 |
| `src/pages/SubmitRequest.tsx` | Add step validation | #2 |
| `src/pages/Auth.tsx` | Add TOS checkbox, password requirements | #3, #4 |
| `src/pages/Settings.tsx` | Phone validation, account deletion | #5, #7 |
| `supabase/functions/delete-own-account/index.ts` | Create | #7 |
| `src/components/layouts/SidebarLayout.tsx` | Dynamic breadcrumb | #8 |
| `src/lib/i18n.ts` | Add translation keys | #10 |

