# Fix the historical data export

## What's wrong

Two problems in the export backend at `supabase/functions/export-data/index.ts`.

**1. The "ready-made reports" downloads can never work (confirmed).**
The function normalizes the requested action with:

```text
action = body.action === "export" ? "export" : "manifest"
```

So when the page asks for `flat` (the `requests_full.csv` / `students_full.csv` reports), the
function silently answers with the *manifest* instead. The browser then reads `files` off a
response that has no `files`, and the download dies with a JavaScript error instead of a file.
The `flat` code further down the file is unreachable today.

**2. Large exports are likely to fail even when the action is right.**
Every selected table is fully loaded into memory, converted to CSV, and returned inside one JSON
response. Selecting "all tables with data" produces a payload in the megabytes, which is the kind
of request that hits edge-function memory/response limits and surfaces as a generic
"Export failed" toast with nothing useful in it.

## The fix

1. Accept `flat` as a valid action (allow-list `manifest`, `export`, `flat`) so the flattened
   reports actually run.
2. Guard the client: if a response comes back without `files`, show a clear error instead of
   crashing.
3. Make big exports safe:
   - Export table-by-table instead of all-at-once — the page requests each selected table in its
     own call and assembles the ZIP in the browser (it already uses JSZip).
   - Cap the payload per call and return a clear, explicit message when a table is too large,
     telling the user to narrow the date range.
4. Surface real error text: return the failing table name and reason instead of a silent
   `console.error` + empty file, and show it in the toast.

## Technical notes

- Files touched: `supabase/functions/export-data/index.ts`, `src/hooks/useDataExport.ts`,
  `src/pages/admin/DataExport.tsx`.
- No schema changes. Auth, role checks, org-admin scoping, sensitive-field redaction and
  `data_export_audit` logging stay exactly as they are (audit still records one row per export
  run, including the per-table batching).
- No changes to any other page or to student-facing behaviour.

## Verification

- Typecheck.
- Call the deployed function with each action and confirm `manifest`, `export` and `flat` all
  return `files` (or a clear error), and that an unauthenticated call still returns 401.
