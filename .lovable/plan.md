# Make the financial recommendation always visible on the request page

## Why it's missing

The recommendation panel lives *inside* the Actions component, so it only renders when all of these are true at once:

- you are an admin, or the case manager assigned to that request (org admins never see it);
- the request status is Submitted, In Progress, or Escalated — resolved, cancelled, and denied requests show "No further actions available" instead;
- the request is still approvable/deniable — an **Escalated** request shows the action buttons but not the panel;
- the request has monetary context (Financial Assistance category, a requested amount, or an approved amount).

So on any request that is resolved, cancelled, escalated, or not assigned to you, the panel silently disappears even though it should still be readable.

## What changes

1. Move the recommendation into its own card on the request detail page, rendered for staff (admin, case manager, org admin) whenever the request has monetary context — regardless of status or assignment.
2. On requests that can no longer be acted on, the card reads as a historical/read-only review: same balance, tier, and findings, no approval controls.
3. Keep the approve/deny flow exactly as it is: when the reviewer can still act, the rationale requirement for non-clean recommendations stays, and the Actions card no longer duplicates the panel.
4. If a request has no money involved at all, no card appears (unchanged).

Still advisory only, no student-facing change, no schema change.

## Technical notes

- Extract the evaluation from `RequestActions.tsx` into a small hook (e.g. `src/hooks/useRequestPolicyEvaluation.ts`) taking category, requested/approved amounts, purpose, title, description, requestId, studentId; it wraps `useRequestAttachments`, `useFinancialAssistanceHistory`, and `evaluateFinancialAssistance` with the existing monetary-context and legacy approved-only logic.
- `src/pages/RequestDetail.tsx`: call the hook and render `FinancialPolicyRecommendation` in its own card above the Actions card, gated on `isStaff || role === 'org_admin'` and a non-null evaluation.
- `RequestActions.tsx`: use the same hook for `requiresRationale`, and drop its own inline panel render so it isn't shown twice.
- No changes to `financialAssistancePolicy.ts`, the history hook, or existing tests.
