
## Goal

Prevent long unbroken strings (URLs, emails, IDs, pasted blocks) from overflowing message cards, case notes, request updates, timeline items, and comment bodies. Auto-linkify URLs/emails/phones, allow "Show more/less" for long bodies, and preserve paragraph/bullet formatting from pastes — safely.

## Scope (only these files)

Text rendering surfaces:
- `src/components/messages/MessageList.tsx`, `MessageThread.tsx`, `ComposeMessage.tsx` (display only)
- `src/components/requests/RequestMessages.tsx` (message bubbles)
- `src/components/requests/RequestTimeline.tsx` (update/comment cards)
- Case/file notes: `src/hooks/useFileNotes.ts` consumers — the note rendering in `src/pages/StudentDetail.tsx` and any `FileNotes*` component under `src/components/students/` or inline note cards
- `src/pages/Messages.tsx` (thread body layout)

Two shared additions:
- `src/lib/linkify.tsx` — safe URL/email/phone detection + React renderer
- `src/components/ui/SafeRichText.tsx` — a wrapper that: preserves whitespace, wraps long strings, linkifies, clamps with Show more/less, and exposes optional Copy action

Everything else is off-limits per the instruction.

## Design

### 1. Text wrapping baseline (CSS)
Apply to every body-text node in the scoped components:
```
break-words                    // Tailwind: overflow-wrap: break-word
[overflow-wrap:anywhere]       // hard-break long tokens (URLs/IDs)
whitespace-pre-wrap            // keep newlines/indent from pastes
min-w-0                        // let flex children shrink so wrapping engages
max-w-full
```
Parent bubbles/cards get `min-w-0` and, for chat bubbles, `max-w-[85%] sm:max-w-[75%] md:max-w-[65%]` so they can't push their row wider than the viewport.

### 2. `SafeRichText` component
Props: `text: string`, `clampLines?: number` (default 6), `showCopy?: boolean`, `className?: string`.

Behavior:
- Splits `text` on newlines to preserve paragraphs; each segment rendered as a `<p>` with `whitespace-pre-wrap` so bullet/indent characters (`- `, `* `, `1.`) that users paste keep their spacing. No markdown parsing (avoids injection risk).
- Runs each segment through `linkify` to render `<a>` for URLs, `mailto:` for emails, `tel:` for phone numbers. Links get:
  - `target="_blank" rel="noopener noreferrer nofollow"`
  - Shortened display: `hostname + first path segment + …` (max ~40 chars), full URL preserved in `href` and `title`.
  - `break-all` so the link itself wraps even inside a narrow bubble.
- Clamp: when total rendered length exceeds threshold, wraps content in a div with `line-clamp-{n}` and a "Show more"/"Show less" toggle. Uses CSS clamp, not JS truncation, so full text stays in DOM (accessible + copyable).
- Optional trailing "Copy" button (Lucide `Copy`) for note bodies. Message bubbles skip it to avoid clutter; timeline notes and case notes get it.
- All text is rendered as React text nodes — never `dangerouslySetInnerHTML`. Pasted HTML from users is not applicable because inputs are plain textareas; we sanitize by simply not interpreting HTML.

### 3. `linkify` utility
Single regex pass over each text segment producing an array of string | `{type, value}` tokens, then mapped to `<a>` or text. Regexes:
- URLs: `https?://…` and bare `www.` domains (prefix with `https://` in `href`)
- Emails: RFC-lite `[\w.+-]+@[\w.-]+\.[a-z]{2,}`
- Phones: North America pattern `(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}` — only linkify when the match length ≥ 10 digits to avoid false positives on IDs
- Skip linkification inside detected URL tokens

Return `ReactNode[]`. No external dependency.

### 4. Component wiring
For each site, replace the raw `<p>{body}</p>` (or equivalent) with `<SafeRichText text={body} clampLines={…} showCopy={…} />` and ensure the parent has `min-w-0`:

- MessageList/MessageThread bubbles: `clampLines={8}`, `showCopy={false}`, bubble gets `max-w-[85%] sm:max-w-[70%] min-w-0 break-words`.
- RequestMessages bubbles: same treatment.
- RequestTimeline note/update text: `clampLines={6}`, `showCopy={true}`.
- Case/file notes card body: `clampLines={5}`, `showCopy={true}`. Author + timestamp stay in the card header (already the case) so only the body expands.
- `Messages.tsx` thread container: add `min-w-0` to the flex/grid children that hold the transcript so long content can't force horizontal scroll.

### 5. Optional global safety net
Add a very small utility class in the shared components only (not global): the SafeRichText wrapper uses `overflow-hidden` on the clamp container to guarantee no sibling can cause horizontal scroll. We do NOT add app-wide `overflow-x: hidden` — that would be an out-of-scope change.

## Explicitly out of scope

- Rich link previews (opengraph fetch) — deferred; needs an edge function + caching, which the user's rule prohibits without permission.
- Markdown rendering or paste-HTML sanitization beyond "don't interpret HTML" — inputs are plain textareas today; introducing a sanitizer library would be an unrelated dependency change.
- Any changes to composer/input behavior, DB schema, hooks, or unrelated pages.

## Verification

- Manually paste a long URL (200+ chars), an email, a phone number, and a 20-line block into: a message thread, a request timeline reply, and a case note. Confirm on desktop (1280), tablet (768), and mobile (375) viewports:
  - No horizontal scroll on the card or page.
  - Links render, open in new tab, and show shortened text with full URL on hover.
  - "Show more" appears past the clamp and toggles correctly.
  - Copy button copies the original text (not the shortened display).
- `tsgo` typecheck clean.

## Technical notes

- `line-clamp-*` requires the Tailwind line-clamp utilities (built into Tailwind ≥3.3) — already available in this project.
- `[overflow-wrap:anywhere]` is used instead of `break-all` on prose so normal words don't get chopped mid-letter; `break-all` is applied only to the `<a>` link element.
- `min-w-0` on flex children is the critical fix for the "container won't shrink" symptom — without it, `overflow-wrap` never triggers inside flex rows.
