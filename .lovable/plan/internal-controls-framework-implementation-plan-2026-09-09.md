# Internal controls framework — implementation plan

Builds the nine controls from Irv's framework into the Hub's normal workflow, in the phases the document sets out.

## Phase 1 — immediate

### 1. No more permanent delete
- Requests get an **Archive** action instead of Delete: the record stays, is marked archived with who/when/why, and drops out of active lists, dashboards and queues while staying in history, reports and student folders.
- Timeline entries can no longer be deleted. Staff can retract an entry, which keeps the original text visible as "retracted by … on …".
- A true delete stays available to a single named platform administrator only, requires a typed reason, and is written to a permanent audit log.
- Everyone else (case managers, org admins) loses the delete action entirely.

### 2. Named logins
- Every staff member already has an individual account with role-based access and required two-factor sign-in; nothing shared is needed to use the Hub.
- We add an **Access review** screen for admins: every active account, its role, last sign-in, and two-factor status, exportable for a reviewer. This is the evidence Irv would ask for.
- Mental Health requests get an extra restriction: the participant's own words are hidden from list views and only shown inside the request to the assigned case manager and admins.

### 3. Second approver above $500
- Any request with an approved amount above $500 requires a second approval from a different admin. The system blocks the same person approving twice.
- The request cannot be marked as paid until that second approval is recorded, and the person recording the payment cannot be either approver.
- The request page shows a clear approval chain: recommended by, approved by, second approval by, paid by — each with name, date and time.

## Phase 2 — transaction documentation and coding

### 4. Amount approved and amount paid
- Requests carry Amount requested, Amount approved, and a separate **Payment record**: amount paid, date paid, method (Zelle, check, other), and reference/confirmation number.
- Reports and exports show all three amounts so the Hub can be tied to the bank and QuickBooks. Any difference between approved and paid is flagged for follow-up.

### 5. Purpose of funds required
- Purpose of funds becomes required on every financial request; the form cannot be submitted without it.
- Existing requests without a purpose are flagged for staff to complete rather than changed automatically.

### 6. Cohort and funding source on every request
- Every request records the participant's class/cohort and a **funding source** chosen from an admin-managed list.
- The payment reference field prompts staff to use the same cohort/funding wording in the Zelle description.
- Test records get a "test record" mark so they can be excluded from live lists and all reporting.

### 7. Participant confirmation of receipt
- After payment is recorded, the participant sees a confirmation step in their portal: they confirm the amount received and the date.
- A request cannot be marked resolved until that confirmation exists, or an admin overrides with a written reason (recorded).

### 8. Categories mapped to grant budget lines
- New admin screen for grant budget lines, left empty for you to fill in.
- Each of the five categories (and each funding source) maps to a budget line, so a report by grant line comes straight from the system.

## Phase 3 — retention and backup

### 9. Retention rule and scheduled export
- A monthly automatic export of requests, amounts, approvals, payments, confirmations and attachment lists, stored in the Hub and downloadable as a single package for your Google Drive.
- A retention setting that prevents removal of records inside the retention window, regardless of role.
- Receipts collected in person are uploaded to the request they belong to; requests with a payment but no receipt appear in a "missing receipt" list.

## Operating note — analytics dashboard
The spending figures on the analytics dashboard get a visible "last reconciled" date and a banner stating they are not for external reporting until reconciled. Admins mark them reconciled once checked.

## Technical notes

- Migration adds to `support_requests`: `archived_at/archived_by/archive_reason`, `amount_paid`, `paid_at`, `paid_by`, `payment_method`, `payment_reference`, `funding_source_id`, `cohort_id`, `is_test_record`, `second_approval_by/at`, `participant_confirmed_at/amount`, and makes `funding_purpose` required for financial requests via a validation trigger (not a CHECK).
- New tables: `funding_sources`, `grant_budget_lines`, `request_category_budget_map`, `request_delete_audit`, `retention_settings`, `scheduled_exports`. Each with GRANTs then RLS: staff read, admin write; students only read their own confirmation row.
- Separation of duties enforced in a `BEFORE UPDATE` trigger on `support_requests` (approver ≠ second approver ≠ payer; no paid without required approvals; no resolve without confirmation or override), so the rule holds regardless of UI.
- `useDeleteRequest` becomes `useArchiveRequest`; hard delete moves to an edge function restricted to the named admin and logged. `RequestTimeline` delete replaced by retract (`retracted_at/by` on `request_updates`).
- Reports, analytics, CRM and export hooks gain `archived_at IS NULL AND is_test_record = false` filters for active views, with an "include archived" toggle in reports.
- Monthly export reuses the existing `export-data` function on a cron schedule writing to the `participant-exports` bucket.
- Phases can ship independently; Phase 1 first with Irv testing before Phase 2 starts.
