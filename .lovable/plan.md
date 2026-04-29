# Fix Case Managers page overflow

The right detail pane on `/admin/case-managers` overflows the frame at typical laptop widths (~1000–1280px). The "View profile" button, stat tiles, and per-row "Reassign" buttons get clipped because the `360px + 1fr` grid leaves too little room for a 4-tile stats row and a 5-column table with two action buttons.

## Changes (UI only — `src/pages/admin/CaseManagersPage.tsx`)

1. **Raise the split-pane breakpoint and shrink the left column**
   - Change the grid from `lg:grid-cols-[360px_1fr]` to `xl:grid-cols-[300px_1fr]`.
   - Below `xl` (1280px), the CM list and detail pane stack vertically so each gets full width. This alone resolves the clipping at 1000px.

2. **Make the detail header wrap cleanly**
   - Header row already uses `flex-wrap`; ensure the avatar+name block uses `min-w-0` and the name/email truncate so long emails never push the "View profile" button off-screen.
   - Shrink the avatar from `h-14 w-14` to `h-12 w-12` to save horizontal space.

3. **Compact the stats row**
   - Keep `grid-cols-2 sm:grid-cols-4` but reduce `StatTile` padding (`p-3` → `p-2.5`) and font sizes (`text-lg` → `text-base`) so 4 tiles fit comfortably even in the narrower split-pane width at `xl`.

4. **Tighten the student table**
   - Wrap the table in `overflow-x-auto` (already present) and add `min-w-[640px]` to the `<Table>` so columns keep readable widths and scroll horizontally only if absolutely needed.
   - Combine the two row actions into a single compact control: keep the icon-only **Reassign** button (`size="icon"` with `ArrowRightLeft` and a tooltip) and turn **View** into a row-level link on the student name (already navigable) — this removes ~120px of action-column width.
   - Reduce the "Last activity" column to a shorter format using `formatDistanceToNowStrict` and add `whitespace-nowrap` so it doesn't wrap to two lines (as seen in the screenshot: "7 days / ago").

5. **Left CM card polish**
   - Cards already fit; just add `truncate` safeguards on long emails and ensure the workload meta row uses `flex-wrap` so the "1 emergency" badge wraps below instead of pushing content.

## Out of scope

- No business-logic, hook, route, or RLS changes.
- No changes to `ReassignStudentDialog`, `useReassignStudent`, sidebar, or other pages.

## Verification

- Reload `/admin/case-managers` at 1000px, 1280px, and 1440px viewports.
- Confirm: header "View profile" button is visible, all 4 stat tiles render, table action buttons are reachable without horizontal scroll at ≥1280px and scroll gracefully below that.
