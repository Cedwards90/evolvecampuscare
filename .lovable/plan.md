# Batch C — Polish, A11y, Validation, and Targeted Refactors

Focused, low-risk improvements. No business-logic changes. No DB migrations.

## 1. Skeleton loaders (replace spinners on data-heavy pages)

Replace bare `<LoadingSpinner />` full-page states with content-shaped skeletons on the highest-traffic pages so perceived load time drops:

- `src/pages/Dashboard.tsx` — stats grid + request list skeleton
- `src/pages/AdminDashboard.tsx` — stats + table skeleton
- `src/pages/StudentDetail.tsx` — header + tabs skeleton
- `src/pages/RequestsList.tsx` and `src/pages/ManageRequests.tsx` — table row skeletons

Add a small reusable helper: `src/components/skeletons/TableSkeleton.tsx` and `src/components/skeletons/StatsGridSkeleton.tsx`.

## 2. Accessibility quick wins

- Add `aria-label` to all icon-only buttons across `src/pages/*` and `src/components/admin/*`, `src/components/requests/*`, `src/components/messages/*` (search, edit, delete, close, expand, etc.).
- Ensure every `<Input>` / `<Textarea>` has either a visible `<Label htmlFor>` or `aria-label` (audit forms in `Auth.tsx`, `SubmitRequest.tsx`, `Settings.tsx`, `CompleteProfile.tsx`, dialogs).
- Add `role="status"` + `aria-live="polite"` to loading/empty containers used inline.
- Ensure modal dialogs have proper `DialogTitle` (shadcn requires this for screen readers).

## 3. Zod validation expansion

Forms currently using Zod: Auth, Settings, Submit Request, Complete Profile, Offline Draft, Schedule Meeting, Invite dialogs.

Add Zod schemas + `react-hook-form` resolvers (or runtime `safeParse` for non-RHF forms) to:

- `src/pages/IntakeSurvey.tsx`
- `src/pages/ResetPassword.tsx` (confirm-match, complexity)
- `src/components/admin/BulkInviteStudentsDialog.tsx` (CSV row schema)
- `src/components/admin/DistributeSurveyDialog.tsx`
- File-note creation in `src/pages/StudentDetail.tsx` (min length)

Centralize shared shapes in `src/lib/validation.ts` (email, phone, password, UUID, non-empty trimmed string) so future forms reuse them.

## 4. Targeted code-debt cleanup (no refactor of large files)

- Consolidate duplicated `getInitials` helper (appears in multiple files) into `src/lib/utils.ts`.
- Extract repeated `COLORS` recharts palette into `src/lib/chartColors.ts`.
- Replace remaining `.single()` calls that may throw with `.maybeSingle()` where the row may legitimately be missing (audit only — surgical edits).
- Remove dead imports flagged during the pass.

## 5. Out of scope (deferred to a future batch, will ask first)

- Splitting `StudentDetail.tsx` (873 lines), `AdminDashboard.tsx` (710 lines), `Dashboard.tsx` (627 lines), `BulkInviteStudentsDialog.tsx` (638 lines) into subcomponents — high churn, needs a dedicated batch with tests.
- Any change to RLS, edge functions, or auth flow.
- Visual redesign.

## Technical notes

- No new dependencies; `zod` and `@radix-ui` skeleton primitives already present.
- All edits use `code--line_replace` against current files.
- After changes: spot-check Dashboard, StudentDetail, and one form via the preview/console for regressions.

## Suggested order

1. Shared helpers (`validation.ts`, `chartColors.ts`, `utils.ts` getInitials) — foundation
2. Skeleton components + swap on 5 pages
3. Zod expansion on 5 forms
4. Accessibility sweep (icon buttons + form labels)
5. Dead import cleanup + `.single()` audit
