# Fix remaining-balance math, add a final decision, and track cohort graduation

Three changes to the financial assistance advisory panel and cohort setup.

## 1. Fix the remaining-balance math and wording

Today the panel shows one "Remaining balance" number that ignores the request being reviewed, so reviewers cannot tell what is left after approving it. The near-cap note also fires off a partly wrong comparison.

- Show three explicit figures: already approved (before this request), this request, and balance after approval.
- Clamp the after-approval balance at $0 and, when the request goes over the cap, state the exact overage amount.
- Progress bar shows approved-to-date as a filled segment plus this request as a distinct pending segment, capped at 100%.
- "Nearly exhausts the allocation" only fires when the request stays within the cap, using the corrected after-approval balance.
- Add the maximum amount that is within policy: the smaller of the fund's remaining balance and the $500 single-transaction limit (labeled as the limit before Executive Leadership approval).

## 2. Add a clear final recommended decision

A single prominent decision line at the top of the panel, derived from the same findings:

- Approve as requested — within caps, documented, eligible.
- Approve a reduced amount of $X — over the remaining balance or over the $500 single-transaction limit, where a smaller amount would comply.
- Approve only with Executive Leadership sign-off — above $500 but within the lifetime balance.
- Do not approve — ineligible expense, direct cash payment, or no balance left.

Each decision shows a one-line reason plus the blocking items to resolve. It stays advisory: the reviewer still decides, and a rationale is still required whenever the decision is not a clean approval.

## 3. Cohort graduation toggle and fund routing

Barrier Mitigation applies while a participant is in class; Alumni Support applies after graduation and career start. The system will determine this instead of guessing from wording.

- Cohorts get a graduation date plus a "Mark cohort graduated" toggle in the cohort editor, with the graduation date recorded when toggled on and cleared when toggled off.
- Cohort roster and cohort list show a "Graduated" badge and the date.
- Per-student override: the existing student graduation date on the profile takes precedence over the cohort date, editable from the student profile.
- Fund type for a request is derived: request created on/after the effective graduation date -> Alumni Support Fund; before it -> Barrier Mitigation Fund. If no graduation date exists anywhere, the request is treated as Barrier Mitigation and the panel notes the graduation date is unconfirmed.
- The panel displays the derived fund type instead of the current keyword-matching "fund type not indicated" warning.

## 4. Separate lifetime balance per fund

Per your decision, the $1,000 lifetime cap is tracked per fund: $1,000 of Barrier Mitigation while enrolled and a separate $1,000 of Alumni Support after graduation. Prior approved requests are classified by the same graduation-date rule, and only same-fund history counts toward the balance for the request under review. The panel labels which fund's balance it is showing.

## Technical notes

- Migration: add `graduated_at date` (nullable) to `public.cohorts`; no data is changed or removed. `profiles.graduation_date` and `profiles.cohort_start_date` already exist and are reused for the per-student override.
- `src/lib/financialAssistancePolicy.ts`: corrected balance math (`remainingAfter`, `overageAmount`, `maxPolicyCompliantAmount`), new `decision` result (`approve` | `approve_reduced` | `approve_with_executive` | `deny`) with `decisionAmount`/`decisionReason`, a `fundType` input replacing the keyword fund-type finding. Stays pure and advisory.
- `src/hooks/useFinancialAssistanceHistory.ts`: return per-request dates so history can be split into barrier vs alumni totals by the effective graduation date.
- `src/hooks/useRequestPolicyEvaluation.ts`: resolve the effective graduation date (student override, else cohort) and derive the fund type for the request and for each prior disbursement.
- `src/components/requests/FinancialPolicyRecommendation.tsx`: decision banner, three-figure balance block, two-segment progress bar, fund label.
- `src/hooks/useCohorts.ts` + `src/components/admin/CohortDialog.tsx` / `CohortManager.tsx`: graduation toggle and badge.
- Extend `src/lib/financialAssistancePolicy.test.ts` for the corrected math, each decision branch, and per-fund balances.
- No changes to approval permissions, request submission, or any other feature area.
