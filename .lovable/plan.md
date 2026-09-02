# Advisory Financial Assistance Policy Recommendations

Adds a reviewer-facing advisory panel that checks each financial request against the Program Operations Manual (Module 1 Supplemental: Financial Control Protocol) and requires a written rationale when a reviewer approves against the recommendation. Advisory only — it never blocks or auto-decides, and no student data changes.

## Policy rules encoded (from the uploaded manual)

- Lifetime cap: $1,000 per fund per participant (Barrier Mitigation for active enrollment, Alumni Support post-placement). The panel sums prior approved amounts for that student's financial requests and flags when this request would exceed the remaining balance.
- Emergency single-disbursement cap: single transactions over $500 need Executive Leadership approval regardless of remaining balance.
- Approval tier: $0.01–$500 = Program Director; $501–$1,000 = Program Director review + Executive Leadership.
- Eligible / strictly ineligible expense guidance by keyword match against title, description, and funding purpose (e.g. IDs, work tools/boots, transit passes, expungement fees, uniforms vs. cash loans, tickets/fines, bail/bond, legal defense, recurring monthly bills, gift cards without itemized receipts).
- Documentation & justification warnings: no third-party documentation attached, missing operational justification (funding purpose), and no fund type indicated (Barrier Mitigation vs. Alumni Support cannot be inferred from the current data, so this is a "confirm fund type" warning, not a hard failure).
- Direct cash payments to participants are prohibited — flagged as a critical warning when detected in the text.

Every finding carries a severity (blocker-style critical, warning, or info) and a plain-English reason quoting the policy, so reviewers see why.

## What reviewers see

On a financial request detail page, above the action buttons: a recommendation panel showing overall recommendation (Recommended / Recommend with conditions / Not recommended per policy), remaining lifetime balance for that student, required approval tier, and the list of findings.

In the approve dialog: when the recommendation is anything other than clean, an "Approval rationale" textarea appears and is required before the approve button enables. The rationale is written into the request timeline as a visible update note alongside the existing approval note, so the override is auditable.

## Technical notes

- `src/lib/financialAssistancePolicy.ts` — pure, dependency-free evaluation function plus policy constants and keyword lists. Takes request fields, attachment count, and prior approved total; returns findings, tier, remaining balance, and recommendation. No network calls.
- `src/lib/financialAssistancePolicy.test.ts` — vitest coverage for cap math, tier boundaries ($500/$500.01/$1,000), ineligible keyword hits, and missing-justification/documentation warnings.
- `src/hooks/useFinancialAssistanceHistory.ts` — new read-only query summing `approved_amount` on the student's prior financial `support_requests` (excluding the current one) to compute the used lifetime total. Reuses existing RLS; no new tables or migration.
- `src/components/requests/FinancialPolicyRecommendation.tsx` — presentation of the evaluation using existing tokens/shadcn components (no hardcoded colors).
- `src/components/requests/RequestActions.tsx` — render the panel for `category === 'financial'`, add the required rationale field in the approve dialog when the recommendation is not clean, and pass the rationale to the approve mutation.
- `src/pages/RequestDetail.tsx` — supply attachment count and student id to `RequestActions` so the panel has what it needs.
- `src/hooks/useRequest.ts` — `useApproveRequest` accepts an optional `policyRationale` and appends it to the `request_updates` note it already inserts. Existing behavior (status change, approved amount, approval status, notifications) is unchanged.

No database migration, no changes to submission flow or student-facing UI, and no other parts of the app touched.
