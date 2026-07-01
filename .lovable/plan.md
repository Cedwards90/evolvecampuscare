## Fix: Guided tour not progressing after login

Three defects combine in `src/hooks/useProductTour.ts` (with a small assist from `src/lib/tour/steps.ts`).

### 1. Stop marking the tour "complete" on every destroy
`onDestroyed` currently writes `evolve:tour-completed:<uid>` unconditionally. Any interruption — a route change tearing down the highlighted element, Esc key, overlay click — permanently locks the tour off.

- Track whether the user reached the last step. Set a `completedRef` to true only inside a new `onDoneClick` on the last step, or when `d.getActiveIndex() === steps.length - 1` at destroy time.
- In `onDestroyed`, write the storage key only if `completedRef.current` is true. Otherwise leave storage untouched so the tour can retry next session (or via the Help button).
- Also stop writing under the `anon` key: bail out if `user?.id` is missing.

### 2. Navigate first, then let driver.js advance normally
Replace the current custom `onNextClick`/`onPrevClick` handlers that call `setTimeout → moveNext`. Instead:

- Change the step model so navigation happens in `driver.js`'s `onHighlightStarted` hook (which fires when driver is about to show a step). If the current pathname !== `step.navigateTo`, call `navigate(step.navigateTo)` and return; then, once the route mounts, call `d.refresh()`.
- For steps that just render a centered modal (no `element`), also swap to `popover: { side: 'over', align: 'center' }` only when no element is provided; otherwise let driver auto-position.
- Remove the `setTimeout(…, 250)` gate — replace with a small `requestAnimationFrame` retry loop that resolves as soon as the target element (or `document.body` for centered steps) is in the DOM. Cap at 20 frames (~330 ms) then continue anyway.

### 3. Gate auto-start on a stable, post-redirect state
- Wait for `user?.id && role && profile` (not just `user + role`) before scheduling the auto-start timer.
- Skip auto-start when `window.location.pathname` starts with `/auth`, `/reset-password`, `/complete-profile`, `/accept-nda`, or `/onboarding`. Recheck at fire time and bail if the user has navigated to one of those.
- Bump the delay from 800 ms to 1500 ms to give React Router + AuthContext one more paint to settle.
- Cancel the timer on unmount (already done) and also on `user?.id` change.

### 4. Small hygiene
- Add `allowClose: false` while the tour is running to prevent accidental Esc/overlay dismissals; users can still exit via the "Skip" button in the popover footer (add `showButtons: ['next', 'previous', 'close']`).
- On `resetTour`, also destroy any live driver instance so a manual re-run from Help doesn't stack popovers.
- If `localStorage` throws (private-mode Safari), fall back to an in-memory `Set` scoped to the session so the tour still auto-fires once.

### 5. Recover users who already got locked out
- On first load, if the app detects the completed flag but `getLoginCount() < 2`, treat the flag as stale and remove it once. This unblocks everyone whose tour aborted before this fix landed. Guard with a one-time migration key `evolve:tour-flag-migrated:v1` so we don't wipe legitimately-completed users repeatedly.

### Files touched
- `src/hooks/useProductTour.ts` — all logic above.
- `src/lib/tour/steps.ts` — add optional `element` fallbacks (`#dashboard-root` etc.) where they exist, no behavior change if the selector is absent.

### Verification
- Log in fresh (clear localStorage) → tour starts on `/dashboard`, Next advances through every route without stalling.
- Log in on `/auth` → auto-start waits until redirect completes, then runs.
- Press Esc mid-tour → tour closes but re-login re-triggers it.
- Reach last step + click "Got it" → tour does not re-launch on next login.
- Existing users with the stale flag see the tour once more (via the migration), then it respects Done.
