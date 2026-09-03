# Repair full historical data export

## Confirmed issue

The all-time workflow requests every nonempty table separately, but each table must currently fit inside one 4 MB function response. If any table exceeds that limit or returns a read error, the client throws immediately and abandons the entire ZIP. The function logs show the recent burst of export calls but no actionable error detail, and the UI only reports the final generic failure.

## Changes

1. **Chunk large tables safely**
   - Add bounded, ordered pagination to the export function so one table can be returned in multiple response-size-safe CSV chunks.
   - Return continuation metadata (`nextOffset` / completion state) and preserve headers when the client combines chunks.
   - Keep all existing date, organization, cohort, role, and sensitive-field rules on every chunk.

2. **Make all-time export resilient**
   - Update the export hook to keep requesting chunks until each table is complete, then place one combined CSV per table in the ZIP.
   - Continue collecting other tables if one table fails, rather than discarding completed work.
   - Include a ZIP manifest listing row counts, completed tables, and any failed tables so partial output is never presented as complete.

3. **Improve feedback and recovery**
   - Show current table/progress while the export runs and prevent duplicate starts.
   - Replace the generic toast with the specific table/error and clear guidance when an export is partial or fails.
   - Preserve the existing sensitive-data confirmation and export audit trail.

4. **Verify**
   - Test normal CSV, filtered ZIP, and full all-time ZIP flows.
   - Confirm large-table pagination has no duplicated or missing rows and that organization-admin scope remains enforced.
   - Run TypeScript checks and authenticated end-to-end export verification without exposing downloaded sensitive data.

## Technical scope

Only the historical export function, export hook, and Data Export page will change. No platform records, report calculations, permissions, or unrelated pages will be modified.