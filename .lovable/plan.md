# Fix: "Share as PDF" crashes with reference error

## Root cause

The Edge Function logs for `generate-request-pdf` and `share-request-pdf` both show the same error:

```
WinAnsi cannot encode "→" (0x2192)
  at wrap (functions/_shared/request-pdf.ts:97)
  at text (functions/_shared/request-pdf.ts:110)
  at buildRequestPdf (functions/_shared/request-pdf.ts:282)
```

`pdf-lib`'s built-in `StandardFonts.Helvetica` uses the **WinAnsi** encoding, which only supports a limited Latin-1 character set. The timeline section renders status transitions like `submitted → in_progress` using the Unicode arrow `→` (U+2192), which WinAnsi cannot encode — so the entire PDF build throws and the user sees the generic `Reference: 0f1c9af4` error.

The same crash will also happen for any other non-WinAnsi character that ends up in request data — em dashes (`—`), curly quotes (`'` `"`), bullets (`•`), accented names outside Latin-1, emojis, etc. — so a one-off fix for `→` is not enough.

## Fix (scoped to the PDF generation only)

Single file change: `supabase/functions/_shared/request-pdf.ts`

1. Replace the hard-coded `→` arrow with the ASCII `->` in the timeline rendering.
2. Add a small `sanitizeForWinAnsi(text)` helper that:
   - Maps common typographic characters to ASCII equivalents
     (`→`/`←` → `->` / `<-`, `—`/`–` → `-`, `'`/`'` → `'`,
     `"`/`"` → `"`, `•` → `*`, `…` → `...`, non-breaking space → space).
   - Strips any remaining characters outside the WinAnsi range
     (replaces them with `?`) so unexpected input (emoji, CJK, etc.)
     can never crash the build.
3. Pipe every dynamic string through `sanitizeForWinAnsi` at the single
   `text(...)` / `wrap(...)` choke point in the renderer (titles, descriptions,
   notes, names, emails, status labels, attachment filenames, org name).

No other files, no schema changes, no edge-function signature changes.

## Verification

After the edit:
- Redeploy `generate-request-pdf` and `share-request-pdf`.
- Trigger "Share as PDF" → Download from `RequestDetail` on a request that has a timeline entry (the failing case).
- Confirm a PDF is returned (HTTP 200, `application/pdf` body) and the timeline reads `submitted -> in_progress`.
- Re-check `supabase--edge_function_logs` for `generate-request-pdf` to confirm the `WinAnsi cannot encode` error is gone.

## Out of scope

- Switching to a Unicode-capable font (e.g. embedding a TrueType font via `pdf-lib` + `fontkit`). That would preserve the original glyphs but adds ~300 KB of font bytes per render and requires `registerFontkit`. Happy to do it as a follow-up if you want true Unicode rendering instead of ASCII fallback — just say the word.
- Any change to the share dialog, link/email flow, RLS, or audit logging.
