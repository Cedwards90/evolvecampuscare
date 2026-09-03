# Add an "All-time export" option

## What's there today

On Administration → Data export, dates are optional and an empty From/To already means
"no date filter", but nothing on the page says so. Getting a full history today means
manually clearing every filter, clicking "Select tables with data", then "Download ZIP".

## What to add

1. **One-click "Export everything (all time)"** button in a new highlighted row at the top of
   the page. It:
   - ignores the date range, organization and cohort filters (all-time, all scopes),
   - includes every table that has rows,
   - includes sensitive fields (with a confirmation dialog first, since this is the widest
     possible export),
   - downloads one ZIP with `manifest.csv` plus the two ready-made reports
     (`requests_full.csv`, `students_full.csv`) alongside the raw tables.
2. **All-time toggle for normal exports** — a "All time" switch next to the date inputs.
   When on, the date fields are disabled and greyed out and the label reads
   "All time (no date limit)". When off, the current date fields behave as they do now.
3. **Clear labelling** — the filter card shows "Leave dates empty for the full history"
   so the behaviour is obvious.
4. **Honest result reporting** — the existing per-table batching, size guard and
   "Skipped (too large)" message stay; the all-time run reports total rows, file count, and
   any tables skipped for size with the advice to narrow the range.

Org admins keep their existing scoping: "all time" removes only the date limit, never the
organization boundary they are allowed to see.

## Technical notes

- Files touched: `src/pages/admin/DataExport.tsx` (new action row, all-time switch,
  confirm dialog) and `src/hooks/useDataExport.ts` (an `all-time` run that fetches the
  manifest without dates, then batches every non-empty table plus the flat reports into one
  ZIP).
- No changes to `supabase/functions/export-data/index.ts` — it already treats
  `from: null` / `to: null` as unfiltered. No schema changes.
- Audit logging in `data_export_audit`, role checks, and sensitive-field redaction are
  unchanged.

## Verification

- Typecheck.
- Run the all-time export from the page and confirm the ZIP contains the raw tables, both
  flat reports and a manifest, with row counts matching the manifest.
