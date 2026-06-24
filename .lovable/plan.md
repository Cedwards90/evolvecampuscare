## Goal

Right now the tour shows tooltips but rarely changes pages — only a few steps set `navigateTo`, and navigation only fires from the "Next" button (so the first step's destination is never visited, and back/jump don't navigate). Make the tour a true guided walkthrough that takes the user to each page as it describes it.

## Changes

### 1. Add a destination to every step (`src/lib/tour/steps.ts`)
Give each step a `navigateTo` so the user lands on the page being described.

- Student
  - Dashboard → `/dashboard`
  - Submit a Support Request → `/submit-request`
  - Track Your Requests → `/track-requests`
  - Messages → `/messages`
  - Weekly Check-Ins → `/check-in`
  - Privacy → `/settings`
- Case Manager
  - Dashboard → `/dashboard`
  - Manage Requests → `/manage-requests`
  - Student Folders → `/students`
  - Messages → `/messages`
  - Reports & Surveys → `/reports`
  - Time Tracking → `/time-tracking`
  - MFA → `/settings`
- Admin / Org Admin
  - Dashboard → `/dashboard`
  - People Management → `/admin/users` (admin) or `/admin/case-managers` (org admin)
  - Surveys & Engagement → `/admin/surveys`
  - QR Codes → `/admin/qr-codes`
  - Impact Analytics → `/admin/impact`
  - Time Tracking Approvals → `/admin/time-tracking`
  - Security → `/admin/nda`
- `helpStep` → `/support`

I'll verify each path against `src/App.tsx` before writing so we don't navigate to a 404.

### 2. Navigate on every step transition (`src/hooks/useProductTour.ts`)
Replace the current "only on Next" logic with handlers that fire for Next, Previous, and the initial render so navigation always matches the current step:

- `onHighlightStarted` (or `onPopoverRender`): if the active step has a `navigateTo` and `location.pathname !== navigateTo`, call `navigate(navigateTo)` and wait briefly for the route to mount before driver.js positions the popover.
- Keep handlers for `onNextClick` / `onPrevClick` that compute the *target* step's path and navigate before `moveNext` / `movePrevious`.
- Because routes mount asynchronously, wrap navigation with a short `setTimeout` (≈150 ms) before `d.refresh()` so the tooltip re-anchors after the new page renders.

### 3. Make the tour resilient to route changes
- The driver instance is created once per `startTour`. After navigation, call `d.refresh()` so it recalculates the highlighted element on the new page.
- Steps without an `element` will continue to render as centered modals — that's fine for intro/closing steps.

### 4. No other behavior changes
- Auto-trigger on first login, login-count tracking, "Got it" persistence, and `resetTour` all stay the same.
- No new dependencies, no styling changes, no backend changes.

## Technical notes

- `driver.js` exposes per-step `onHighlightStarted`, `onNextClick`, `onPrevClick`, and an instance `refresh()` method — all already available in the version installed.
- We must read the *target* step (`steps[idx + 1]` for Next, `steps[idx - 1]` for Prev) and navigate before advancing so the popover anchors on the right page.
- Centered/no-`element` steps don't need DOM presence, so they work on any route.

## Out of scope

- No changes to onboarding cards, `HelpButton`, `GettingStartedSection`, or `HowItWorks`.
- No new tour content beyond updating `navigateTo` values.
