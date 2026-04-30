
## Goal
Give Case Managers (and Admins on their behalf) a one-click way to generate, preview, and export an "Interaction Report" summarizing all platform activity for their assigned caseload over Daily / Weekly / Monthly / custom date ranges.

## UX

### 1. Dashboard quick-action (Case Manager view only)
On the existing Case Manager Dashboard, add a compact **"Generate Report"** card with:
- Three pill buttons: `Daily` · `Weekly` · `Monthly`
- A `More options →` link that navigates to `/reports`

Clicking a preset opens the report preview modal directly with that range pre-selected.

### 2. Dedicated `/reports` page (new)
Sidebar entry "Reports" visible to `case_manager` and `admin`. Page contains:
- **Range selector**: preset chips (Daily/Weekly/Monthly) + custom date range picker (shadcn Calendar in popover, `pointer-events-auto`)
- **Admin-only**: case manager dropdown (defaults to "All my CMs" disabled / picks one CM). For Case Managers this control is hidden — they always see their own data.
- **Generate** button → loads data and renders the live preview below
- **Export** split-button: `Download PDF` · `Download CSV`
- Live preview card with all sections (see below). Loading skeleton + error states.

## Report Contents
All metrics scoped to the selected case manager + date range:

1. **Header** — CM name, range, generated-at timestamp, Evolve Foundation branding
2. **Summary tiles** — Active students, requests opened, requests resolved, avg resolution hrs, unresolved count, emergency count
3. **Student contacts** — count of `staff_messages` sent/received, distinct students contacted
4. **Notes added** — count of `file_notes` authored, grouped by `note_type`
5. **Surveys** — `survey_invitations` sent and completed
6. **Requests** — opened / in-progress / resolved / escalated, broken down by category and priority
7. **Status changes** — `request_updates` rows authored by the CM (timeline-style table)
8. **Follow-ups (meetings)** — `appointments` scheduled / completed / upcoming
9. **Unresolved items** — table of currently open requests older than range start, with age and priority
10. **Footer** — page numbers, confidentiality notice

## Data Layer

### New hook: `src/hooks/useInteractionReport.ts`
`useInteractionReport({ caseManagerId, from, to })` — single React Query call that returns a typed `InteractionReport` object with all sections above. RLS already enforces:
- Case Managers see only their assigned data
- Admins see everything

Permission guard inside the hook: if the caller is a CM and `caseManagerId` ≠ `auth.uid()`, return error (defense-in-depth on top of RLS).

The hook fans out parallel queries (Promise.all) against existing tables: `support_requests`, `request_updates`, `file_notes`, `staff_messages`, `survey_invitations`, `appointments`, `student_assignments` — filtered by `case_manager_id`/`assigned_case_manager_id`/`author_id`/`sender_id` and date range. No new tables or migrations needed.

### Live updates
Subscribe to Postgres realtime on `support_requests`, `request_updates`, `file_notes`, `appointments` (already enabled for messages/requests in earlier work). On any change touching the selected CM's rows, invalidate `['interaction-report', cmId, from, to]`. Reuse the existing realtime subscription pattern (`useRealtimeMessages`, `useInvitationsRealtime`).

## Export Layer (client-side only)

### CSV
Build CSV in-browser from the `InteractionReport` object — one section per "table block" separated by blank rows, downloaded via Blob + `a[download]`. No new dependency.

### PDF
Use **`jspdf` + `jspdf-autotable`** (small, client-side, no server cost). Generate a branded multi-page PDF mirroring the on-screen preview: header with Evolve logo (existing asset), summary tiles as a styled grid, then each section as an autoTable. Pagination + footer added automatically.

Both downloads filename pattern: `evolve-report_<cm-slug>_<from>_<to>.pdf|csv`.

## Permissions & Security
- Route protected via `ProtectedRoute allowedRoles={['case_manager', 'admin']}`
- All queries go through Supabase client → RLS enforced server-side
- Hook double-checks the caller's role via `useAuth()` and refuses to query for another CM unless `role === 'admin'`
- No service role / no edge function needed — keeps blast radius small

## States
- **Loading**: skeleton tiles + skeleton tables in preview; export buttons disabled
- **Error**: inline alert with retry; toast on export failure
- **Empty range**: "No activity in this period" empty state, export buttons disabled
- **Stale-while-realtime**: subtle "Updated just now" indicator when a realtime invalidation refetches

## Files to add (new only — no edits to existing files outside the listed touchpoints)

**New:**
- `src/hooks/useInteractionReport.ts`
- `src/lib/reportExport.ts` (CSV + PDF builders)
- `src/components/reports/ReportRangePicker.tsx`
- `src/components/reports/ReportPreview.tsx`
- `src/components/reports/GenerateReportCard.tsx` (dashboard quick-action)
- `src/pages/Reports.tsx`

**Touched (with permission — minimal additions only):**
- `src/App.tsx` — register `/reports` route
- `src/components/layouts/SidebarLayout.tsx` — add "Reports" nav item for CM/Admin
- `src/pages/Dashboard.tsx` — render `<GenerateReportCard />` inside the existing Case Manager dashboard branch

**Dependency added:** `jspdf`, `jspdf-autotable`

## Out of scope (per "no other changes without permission")
- No edits to existing hooks, tables, RLS, or other pages
- No scheduled/emailed reports (could be a follow-up)
- No new edge functions

## Acceptance
- CM clicks Daily on dashboard → preview opens with last-24h data in <2s on warm cache
- CM exports PDF and CSV; both contain identical figures to the preview
- Admin on `/reports` selects another CM → sees that CM's report
- A new `request_update` written by the CM during the session triggers a live refresh of the preview and updates the export the next time it's clicked
- CM cannot fetch another CM's data (verified by RLS + hook guard)
