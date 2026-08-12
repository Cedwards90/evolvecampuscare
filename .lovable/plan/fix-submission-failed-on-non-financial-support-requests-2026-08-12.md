# Fix: "Submission failed" on non-financial support requests

## What's happening

The submit form sends an empty approval status for any request that isn't Financial Assistance. The database column `approval_status` does not allow empty values (it is required, defaulting to "pending"), so the insert is rejected and the student sees the generic "Submission failed. Please try again later." toast.

This affects every non-financial category (Academic, Mental Health, Housing, Other) — matching the screenshot (Category: Other).

## The fix

1. In the request submission logic, stop sending an empty approval status for non-financial requests: only include the approval field when the category is Financial Assistance, otherwise omit it so the database default applies.
2. Surface the real error text in the failure toast (instead of only the generic message) so future submission problems are diagnosable by the user and by us.

## Technical details

- `src/hooks/useSubmitRequest.ts`: currently inserts `approval_status: category === 'financial' ? 'pending' : null`. Change to build the insert payload conditionally and omit the key when not financial (column is `NOT NULL DEFAULT 'pending'`).
- `src/pages/SubmitRequest.tsx`: include the error message from the mutation in the destructive toast description.
- No schema/migration change and no other behavior changes.

## Verification

Submit a request as a student with category "Other" and confirm it saves and appears in Track Requests; repeat with a Financial Assistance request including an amount to confirm the approval workflow still starts as pending.
