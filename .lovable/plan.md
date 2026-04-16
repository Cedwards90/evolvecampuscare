

User confirms multiple pages overflow horizontally on mobile (390px viewport, on /dashboard). Need a global pass that prevents any element from forcing the page wider than the viewport.

Root causes I've identified from inspecting the code:

1. **Cards/grids with fixed `min-w-` widths** force pages wider than the screen.
2. **`whitespace-nowrap` text** in badges/buttons/table cells extends past viewport.
3. **`Table` component wraps in `overflow-auto` div but its parent Card doesn't constrain width** — long rows push the page itself wide on a few pages that don't use the mobile card fallback.
4. **Long unbroken strings** (emails, request titles, URLs) without `break-words`/`truncate`.
5. **Some Selects/filter rows use fixed widths** (e.g. `w-[130px]` x several side-by-side) that overflow at 360–390px.
6. **`Dialog`/`Toast`/`DropdownMenu` content** occasionally renders wider than viewport.
7. The main `<main>` already has `overflow-x-hidden`, but its **child container** does not, and the body itself can still scroll if a child has explicit width > viewport on some routes (e.g. `RequestDetail` activity timeline, dashboard chart cards, admin tables).

## Plan: Global Mobile Overflow Fix

### Approach
Apply a layered fix — global guardrails + targeted page fixes.

### 1. Global guardrails (one-time CSS)
In `src/index.css`:
- `html, body { overflow-x: hidden; max-width: 100vw; }`
- Add a `.no-x-overflow` utility and apply to root layout
- Add `* { min-width: 0; }` inside main content area scope so flex/grid children can shrink
- Force long words to break: utility for `word-break: break-word` on cards and message bodies

### 2. Layout shell (`SidebarLayout`)
- Add `overflow-x-hidden` and `max-w-full` to the outer wrapper and the flex-1 main column
- Ensure the header row doesn't overflow: shrink gaps, ensure each child has `flex-shrink-0` or `min-w-0`

### 3. Pages to harden
For each, audit grids, replace fixed widths with responsive ones, add `min-w-0` to grid/flex children, `truncate`/`break-words` on text, and convert horizontal-scroll tables to mobile card lists where missing:

| Page | Fix |
|---|---|
| `Dashboard` | Stat grid → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, add `min-w-0` to all cards, truncate long names |
| `AdminDashboard` | Same stat grid pattern, chart cards get `min-w-0` and `w-full` |
| `AnalyticsDashboard` | Charts wrapped in `min-w-0 overflow-hidden`, recharts container `w-full` |
| `RequestDetail` | Already partly done; add `min-w-0` to Activity Timeline, ensure attachment filenames truncate |
| `RequestsList`, `TrackRequests` | Add mobile card list (same pattern as ManageRequests) |
| `StudentFolders`, `UserManagementPage`, `StudentAssignmentsTable` | Add mobile card list under `sm`, hide table |
| `SurveyResponses`, `OrganizationDetail`, `TrainingOrganizations`, `CaseManagerDetail`, `StudentDetail` | Constrain tables, mobile cards where needed |
| `Messages` | Already single-pane; add `min-w-0` to thread |
| `Settings`, `CompleteProfile`, `IntakeSurvey`, `SubmitRequest`, `StudentCheckIn`, `PostGraduationPlan` | Forms full-width, no fixed input widths |
| Filter rows (ManageRequests etc.) | Selects switch from `w-[130px]` to `flex-1 sm:w-[130px]` |
| Dialogs | Already `max-h-[90vh] overflow-y-auto`; add `w-[calc(100vw-2rem)] sm:w-auto` so they never exceed viewport |

### 4. Component-level
- `Card`: add `min-w-0` to default classes? No — too invasive. Instead apply per-use.
- `Table` wrapper: keep `overflow-auto`, but parent Card always gets `overflow-hidden` so it clips visually.
- `Badge`: keep `whitespace-nowrap` but ensure parents allow wrap.
- `Avatar` + name rows: wrap name in `truncate` + parent `min-w-0`.

### Files to touch (~15)
`src/index.css`, `src/components/layouts/SidebarLayout.tsx`, `src/pages/Dashboard.tsx`, `src/pages/AdminDashboard.tsx`, `src/pages/admin/AnalyticsDashboard.tsx`, `src/pages/RequestDetail.tsx`, `src/pages/RequestsList.tsx`, `src/pages/TrackRequests.tsx`, `src/pages/StudentFolders.tsx`, `src/pages/admin/UserManagementPage.tsx`, `src/components/admin/StudentAssignmentsTable.tsx`, `src/pages/admin/SurveyResponses.tsx`, `src/pages/admin/OrganizationDetail.tsx`, `src/pages/admin/TrainingOrganizations.tsx`, `src/pages/CaseManagerDetail.tsx`, `src/pages/StudentDetail.tsx`, `src/pages/Messages.tsx`, `src/pages/Settings.tsx`, `src/pages/SubmitRequest.tsx`, plus minor dialog tweak in `src/components/ui/dialog.tsx`.

### Verification
After implementation I'll mentally walk through Dashboard → Manage Requests → Request Detail → Student Folders → Admin Analytics at 360px and 390px viewports to confirm zero horizontal scroll. The global CSS guardrails are the safety net — even if a future component overflows, the page itself won't scroll horizontally.

### Notes
- No backend changes
- No new dependencies
- Brand colors and pill-shaped UI preserved

