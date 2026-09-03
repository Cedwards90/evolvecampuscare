# Apply the financial policy panel to all money requests

Right now the advisory policy panel only appears when a request's category is "Financial Assistance". Older requests that involve money but were filed under academic, housing, or other never show it, and the lifetime balance ignores those amounts.

## What changes

1. **Panel visibility** — show the policy panel (and require an approval rationale when it is not cleanly recommended) for any request where money is involved:
   - category is Financial Assistance, **or**
   - an amount was requested, **or**
   - an amount was already approved.

   This covers legacy requests without any data migration or edit to the request itself.

2. **Lifetime balance accuracy** — the $1,000 lifetime allocation now sums every approved amount for that participant across all categories, not just financial ones, so older miscategorized disbursements count against the cap. Denied requests stay excluded, and the current request is still excluded from its own balance.

3. **Legacy-data honesty** — when a request has an approved amount but no requested amount (common on older records), the panel uses the approved amount for cap math and notes that the request predates the structured financial fields, so the reviewer knows the guidance is based on partial data. No fabricated values.

4. **Financial details block on the request page** — the amounts/purpose/approval block currently only renders for the financial category; it will render whenever an amount exists, so legacy money requests display their amounts consistently.

Nothing becomes blocking: the panel stays advisory, students see no change, and no automatic decisions are made.

## Technical notes

- `src/components/requests/RequestActions.tsx`: replace `isFinancial` with a derived `hasMonetaryContext` (category financial OR `requestedAmount > 0` OR `approvedAmount > 0`); pass the effective amount into `evaluateFinancialAssistance`; gate the panel and rationale requirement on that flag.
- `src/pages/RequestDetail.tsx`: pass `approvedAmount` to `RequestActions`; relax the financial-details block condition to include requests with amounts.
- `src/hooks/useFinancialAssistanceHistory.ts`: drop the `category = 'financial'` filter so any request with a non-null `approved_amount` counts; keep excluding denied rows and the current request.
- `src/lib/financialAssistancePolicy.ts`: accept an optional flag for legacy/partial records and emit an informational finding when the amount came from `approved_amount` rather than `requested_amount`.
- `src/lib/financialAssistancePolicy.test.ts`: add cases for the legacy/approved-only path.
- No database migration, no schema change, no student-facing change.
