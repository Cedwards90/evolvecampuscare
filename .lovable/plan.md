Plan to stop pages/forms from resetting when the browser discards or reloads a tab:

1. Change draft restore behavior
- Update `useFormPersistence` so saved drafts are restored automatically on mount instead of only showing a toast that requires the user to click Restore.
- Keep a toast/indicator that says the draft was restored, with a Discard option if the user wants to clear it.
- Prevent the first empty/default render after reload from overwriting the saved draft before restoration finishes.

2. Make saving more reliable before tab discard
- Flush the latest form values immediately on `visibilitychange`, `pagehide`, and `beforeunload`.
- Clear any pending debounce timer after a successful flush so stale values do not overwrite newer values.

3. Fix incomplete app-wide coverage
- Wire the persistence hook into forms that were planned but not actually covered, especially `SubmitRequest.tsx`, onboarding forms, and other meaningful multi-field forms.
- Keep excluded auth/password/invite flows excluded for security.

4. Validate the key affected flows
- Verify that typing into the Weekly Check-In, Life Skills Survey, Intake Survey, Post-Graduation Plan, and Support Request form survives a reload/tab discard simulation.
- Confirm successful submit still clears the draft so old answers do not reappear later.