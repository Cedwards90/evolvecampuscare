## Goal
Add stricter CSV parsing and a detailed pre-submit error report to the Bulk Invite Students dialog. Frontend-only change to `BulkInviteStudentsDialog.tsx`.

## Changes

### 1. Stricter CSV parser
Replace naive `split(',')` with a quoted-field parser:
- Handle `"a,b"` quoted cells, `""` escaped quote, embedded newlines inside quoted cells.
- Strip BOM (`\uFEFF`) from start of file.
- Comma delimiter only.
- Track **source line number** (1-indexed) for every row so errors point at exact lines.
- Header detection: case-insensitive match for `email` (required column), optional `full_name | fullname | name`. If no `email` header **and** first cell of row 1 is not an email → reject file with a clear error ("CSV must include an `email` column or one email per row").
- Empty lines reported as `empty_row` issue (not silently dropped).
- Rows with header but missing email cell → `missing_email` issue.

### 2. Stricter validation
Per-row issues with typed reason codes:

| Code | Trigger | Severity |
|---|---|---|
| `empty_row` | Line blank after trim | warn (skip) |
| `missing_email` | Header present, email cell empty | **hard error** |
| `invalid_format` | Fails regex, contains spaces, > 254 chars total, or local-part > 64 chars | **hard error** |
| `duplicate_in_batch` | Email already seen earlier — show "first seen on line N" | warn (skip) |
| `over_limit` | Beyond MAX (100) — flag rows 101+ | warn (skip) |
| `valid` | Passes all checks | — |

Normalization: trim, lowercase, strip surrounding quotes. `fullName` trimmed and capped at 100 chars.

### 3. Detailed error report UI (pre-submit)
Replaces the small 32-row scroll list with a structured report card whenever any non-valid row exists:
- **Summary chips** grouped by issue type (e.g. `2 invalid · 1 missing email · 3 duplicates · 1 empty`).
- **Grouped report list** in a `ScrollArea` (~240px): one section per issue type, each entry shows `Line {n} — {email or "(empty)"} — {reason}`. Duplicates also show "first seen on line N".
- **Download error report (.csv)** button — exports `line,email,issue,detail` columns for every non-valid row via a client-side blob.

### 4. Submit gate (block only on hard errors)
- Send button **disabled** if any `invalid_format` or `missing_email` row exists. Tooltip / inline message: "Fix invalid emails in your file, then re-upload."
- `empty_row`, `duplicate_in_batch`, `over_limit` rows are auto-skipped silently (still listed in the report) — Send stays enabled.
- Existing 100-cap message kept for `over_limit`.

### 5. Paste tab parity
Apply the same per-line tracking and issue codes to the paste tab (lines numbered from the textarea). Reuse the same report UI.

### 6. UX polish
- Use existing `Alert`, `Badge`, `Collapsible`, `ScrollArea` primitives — no new deps.
- Keep existing layout, Forest Green/Sage tokens, pill UI.
- Existing post-submit progress flow is unchanged.

## Files
**Edited (frontend only)**
- `src/components/admin/BulkInviteStudentsDialog.tsx` — rewrite `parseCsv` + `parsePasted` + `validate`, add issue-code types, replace error list with grouped report + CSV download + hard-error submit gate.

**Untouched**
- `src/hooks/useBulkInvite.ts`
- `supabase/functions/bulk-invite-students/index.ts`
- All other dialogs, hooks, edge functions, DB schema.

## Out of scope
- Server-side parsing changes (edge function still receives only validated `valid` rows).
- Cross-batch duplicate check vs existing `user_invitations` (already handled server-side as `skipped`).
- File-size / line limits (no caps before parsing).
- New parser dependencies (e.g. papaparse) — kept inline.
