# UX Consistency, Clarity and Polish — Three Passes

Confirmed against the current code before planning:
- Student folders run both a global filter bar and its own organization/cohort/case-manager dropdowns, and both sets are applied together (`StudentFolders.tsx:60-127`).
- The caseload report only narrows the unresolved list for the preview; PDF and CSV exports use the unfiltered data (`Reports.tsx:83-135`).
- The staff request queue defaults to all statuses and only reads a `priority` link parameter, so dashboard links carrying `status=escalated` are ignored (`ManageRequests.tsx:51-91`).
- Request category examples still say academic probation, change your major, tuition, and dorm (`SubmitRequest.tsx:45-49`).
- Category tiles are plain clickable `div`s with no keyboard role or focus state (`SubmitRequest.tsx:373-380`).
- Draft persistence of text and current step exists and will be preserved; attachments live in separate component state, so they are genuinely not restored.

## Pass 1 — Filters, counts and exports agree

1. **One filter bar in student folders.** Remove the duplicate local organization/cohort controls and drive the page from a single bar ordered Organization -> Class -> Case manager, with visible selected-filter chips and Clear all. Keep search and the status control.
2. **Reports use one scope everywhere.** Apply the same filtered dataset to the preview, the metric tiles, the AI summary payload and both downloads, and print the active scope (date range, organization, class, case manager) in a line directly above the report and inside each export.
3. **Queue defaults to Active.** Add Active / Resolved / All views to the staff queue, defaulting to Active (submitted, in progress, escalated, unassigned) while resolved, closed and cancelled stay reachable under Resolved and All, plus in history, folders and reports.
4. **Every metric link lands on the matching list.** The queue reads `status`, `priority`, `is_emergency` and `category` from the URL, shows them as removable chips, and dashboard tiles and alerts link with the parameters that reproduce their own number.
5. **Request examples rewritten for Evolve.** Replace campus wording with workforce participant wording: transportation, work gear and tools, childcare, training attendance, housing stability, employment and career support. Category labels and descriptions get the same treatment. Stored category values are unchanged, so existing requests and reports keep working.

## Pass 2 — Simpler dashboards and navigation

6. **One summary row.** Students see next steps, request updates and the three actions Get help, Track my request, Message my case manager above everything else. Staff see urgent work and upcoming follow-ups first. Duplicate request counts are removed; analytics move below into a collapsed section.
7. **Navigation grouped by role.**

```text
Student        Home · My requests · My progress · Messages · Resources
Case manager   Today · Request queue · Students · Appointments · Reports
Admin          Overview · Requests · People · Reports · Administration
```

Submit a request stays prominent for students; My hours stays one tap away for case managers; drafts move inside My requests; analytics, impact and exports consolidate under Reports. Existing URLs keep working through the redirects already in place.

## Pass 3 — Mobile, accessibility and visual polish

8. **Student folders get the mobile card list** already used by the request queue: name, class, case manager, pending requests, Open folder.
9. **Category selection becomes an accessible radio group** with arrow-key selection, a visible focus ring and an unmistakable selected state. Same treatment for priority tiles.
10. **Visual standardisation** within the existing forest green, sage and off-white palette: forest green for primary actions and the selected nav item, alert colours reserved for things needing attention, Submitted visually separated from Resolved, and consistent page titles, card padding, button placement and section spacing.
11. **Overflow handled per component** — scroll containers on wide tables and dialogs — so the global horizontal-overflow rule is no longer what hides content.
12. **Draft return message.** When a saved draft is reopened, state plainly that any files need to be attached again.

## Technical notes

- Presentation, filter and routing work only. No database migrations, no permission changes, no changes to how requests, funds or approvals are calculated.
- Report scope is applied once and shared by preview, metrics, AI payload and exports so numbers cannot diverge.
- Category, status and priority enum values in the database are untouched; only labels, descriptions and examples change.
- Existing draft persistence, resolved-request exclusions from urgent queues and legacy route redirects are preserved.
