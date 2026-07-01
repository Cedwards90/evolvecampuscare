## Goal
Prevent users from losing typed input when Chrome discards a tab, they accidentally navigate away, or the page reloads. Every meaningful form in the app auto-saves a draft to `localStorage` while the user is typing and restores it on next mount.

Support-request drafts already have their own offline system (IndexedDB + `offline_drafts` table) — that stays untouched. This adds a lighter, universal client-side "in-progress" cache for all other forms.

## Approach
One reusable hook, `useFormPersistence(key, values, setValues)`, that:
- Reads `localStorage["evolve:draft:<key>:<userId>"]` on mount and hydrates the form (with a "Restore draft?" toast offering **Restore** / **Discard**).
- Debounces writes (~500 ms) as fields change.
- Clears the entry on successful submit or explicit discard.
- Scopes keys per user id so shared devices don't leak drafts across accounts.
- Skips persistence for password fields and any explicitly-excluded keys.

Also add a tiny `TabVisibilityFlush` helper that forces a flush on `visibilitychange = hidden` so a discard right after typing still saves.

## Forms wired up
Priority order — highest-value first:
1. `SubmitRequest.tsx` (already partly covered by offline drafts; add the same hook as a redundant safety net for the online path)
2. `StudentCheckIn.tsx`
3. `IntakeSurvey.tsx`
4. `LifeSkillsSurvey.tsx`
5. `PostGraduationPlan.tsx`
6. `CompleteProfile.tsx`
7. Onboarding: `CareerIntakeOnboarding.tsx`, `CmfBasicsOnboarding.tsx`, `PersonalityQuizOnboarding.tsx`
8. Case notes composer inside `StudentDetail.tsx`
9. `ScheduleMeetingDialog.tsx` (notes field only)
10. `AdminNda.tsx` markdown editor

Explicitly excluded (security/no value): `Auth.tsx`, `ResetPassword.tsx`, `ForgotPassword.tsx`, invite dialogs.

## UX details
- Restore prompt uses a shadcn `toast` with two actions; auto-dismisses after 10 s and keeps the draft if ignored.
- Small "Draft saved" indicator next to submit buttons that fades in briefly after each debounce write, so users see it's working.
- A "Discard draft" link appears in the toast and inside each form's footer whenever a stored draft exists.

## Technical details
- New files:
  - `src/hooks/useFormPersistence.ts` — the hook (debounce via `setTimeout`, JSON serialize, per-user key).
  - `src/lib/formDraftStorage.ts` — thin wrapper around `localStorage` with quota-exceeded handling (drops oldest entry).
  - `src/components/forms/DraftIndicator.tsx` — the "Draft saved / Restore / Discard" UI bits.
- Storage key format: `evolve:draft:<formKey>:<userId>` with a `{ v: 1, savedAt, values }` envelope for future migrations.
- Values are stored as-is; any `File` / `Blob` fields are stripped before serialization.
- Hook signature:
  ```ts
  useFormPersistence<T>(formKey: string, values: T, setValues: (v: T) => void, opts?: {
    exclude?: (keyof T)[];
    debounceMs?: number;
    enabled?: boolean;
  })
  ```
- No database or edge-function changes.
- No changes to auth, RLS, or existing offline-drafts logic.

## Out of scope
- Cross-device sync of drafts (would need a new table + RLS).
- Rich-text editor state beyond plain string capture.
- Recovery UI listing all pending drafts across the app.
