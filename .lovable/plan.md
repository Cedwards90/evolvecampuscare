

The user says mobile is still not right after my last pass. I should investigate concrete issues rather than guess. Let me check the current state of key pages on a mobile viewport via session replay context — they're on `/requests/:id`. The last pass only updated RequestDetail header + Messages + dialog. I deferred a deeper pass on tables, dashboards, forms, and the sidebar.

Without seeing a screenshot, I'll plan a focused mobile audit + fixes based on the deferred items. I'll keep it tight and ask one clarifying question to make sure I focus on the right pain points.

## Plan: Mobile Responsiveness — Round 2

### Audit targets (≤640px)
1. **`SidebarLayout` top header** — too many items in the header row push content off-screen on phones. Hide search input on `<md`, shrink avatar/notification spacing, ensure hamburger is always tappable.
2. **`RequestDetail`** — 3-col grid still feels cramped at narrow widths; convert to single column under `lg`, make Quick Actions/Attachments stack first, ensure no horizontal overflow from long titles or AI badge row.
3. **`SubmitRequest` wizard** — step indicators wrap awkwardly, footer Next/Back buttons need to be sticky and full-width on mobile.
4. **`ManageRequests` / `RequestsList` / `TrackRequests`** — filter bars wrap into too many rows; collapse filters into a Sheet/drawer on mobile, switch table rows to stacked cards under `sm`.
5. **`StudentFolders` / `UserManagement` / `StudentAssignmentsTable`** — replace horizontal-scroll tables with stacked cards under `sm` (per memory `responsive-admin-layout` we currently scroll, but cards are easier to read).
6. **`Dashboard` / `AdminDashboard` / `AnalyticsDashboard`** — stat grids → 1 col mobile, 2 `sm`, 4 `lg`; charts get fixed `h-64` and `min-w-0` to prevent overflow.
7. **`Messages`** — add a "Back to conversations" button in `MessageThread` header on mobile.
8. **Dialogs** (`ScheduleMeetingDialog`, `InviteUserDialog`, `SurveyPreviewDialog`, `ComposeMessage`) — ensure full-width on mobile, sticky footer actions, body scrolls.
9. **Typography & touch targets** — global pass: `text-2xl sm:text-3xl` on H1s, ensure buttons hit 44px min height, increase tap targets on icon-only buttons.

### Files to edit
| File | Change |
|---|---|
| `src/components/layouts/SidebarLayout.tsx` | Header simplification on mobile, hide search, tighter spacing |
| `src/pages/RequestDetail.tsx` | Single-col under `lg`, reorder cards, prevent overflow |
| `src/pages/SubmitRequest.tsx` | Sticky footer, full-width inputs, wizard steps wrap cleanly |
| `src/pages/ManageRequests.tsx` | Filter Sheet on mobile, stacked cards |
| `src/pages/RequestsList.tsx`, `src/pages/TrackRequests.tsx` | Stacked cards under `sm` |
| `src/pages/StudentFolders.tsx`, `src/components/admin/UserManagement.tsx`, `src/components/admin/StudentAssignmentsTable.tsx` | Card fallback under `sm` |
| `src/pages/Dashboard.tsx`, `src/pages/AdminDashboard.tsx`, `src/pages/admin/AnalyticsDashboard.tsx` | Responsive stat grids, chart `min-w-0` |
| `src/components/messages/MessageThread.tsx` | Back button on mobile |
| Dialogs (4 files) | Sticky footer, scrollable body |
| `src/index.css` | Optional small utility for 44px tap targets |

### Notes
- No backend changes.
- I'll test by mentally walking through each page at 375px width during implementation.
- Will preserve existing brand styling (Forest Green primary, pill UI).

