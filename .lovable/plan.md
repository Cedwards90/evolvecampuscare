# Student Support Hub — Visual & UX Review

Review only. No code, data, or publishing changes. No student personal data is reproduced here.

## How this was verified

- **Visually verified** (signed-in admin session, desktop 1280px and phone 390px screenshots of Home): first-screen layout, sidebar, mobile tab bar, onboarding tour behavior, no horizontal overflow on Home (measured 0px both widths).
- **Source-based** (file/line evidence): routes, navigation config, dashboard composition, request/draft handling, folders, reports, time tracking, styling and accessibility patterns.
- **Could not inspect**: staff-only and student-only screens in the browser — with the tour overlay active every navigation attempt landed back on Home, so Requests, Students, Reports, Time tracking, Classes and Settings were not visually confirmed. Contrast ratios were not measured. No screen-reader pass was run.

## Already implemented — do not re-recommend

- **Draft safety on tab switch / navigate away / offline**: `useFormPersistence.ts:290-323` flushes on `visibilitychange`, `pagehide`, `beforeunload` with a `keepalive` beacon; retry outbox in `formDraftStorage.ts:281-339`; cross-device conflict choice at `useFormPersistence.ts:240`. Case-note drafts too (`StudentDetail.tsx:853`).
- **Resolved/cancelled excluded from urgent queues**: `AdminDashboard.tsx:110-113`, `Dashboard.tsx:117,295`; archived/test records filtered in `useRequests.ts:28-34`; `useStudentFolders.ts:151` counts only open statuses.
- **Legacy URLs redirect** to short routes (`navigation.ts:63-71`, `App.tsx:142`).
- **Filters** already have URL sync, chips, reset (`GlobalFilterBar.tsx`, `GlobalFiltersContext.tsx`) and a result count in `ReportFilters.tsx:226`.
- **Focus-visible rings** are consistent across all shadcn primitives.

## Prioritized findings

### P0 — Onboarding tour hijacks the app (visually verified)
A 9-step "Welcome to Evolve" modal opened over Home on both widths and, while active, every route I opened returned to Home. Its title also renders a broken glyph (a box instead of an emoji). A first-run tour that traps navigation is the single biggest usability risk.
Fix: make the tour non-blocking and dismissible in one click, never auto-navigate, drop the emoji, and only auto-start once per account.

### P0 — Fabricated numbers on dashboards
`Dashboard.tsx:519,529,539` show trend badges of 28%, 34%, 42% that are literal constants; `AdminDashboard.tsx:246` shows a permanent "+15% from last week"; `AdminDashboard.tsx:349` assumes a fixed capacity of 20 cases to compute "High Load".
Fix: compute trends from the same series that feeds the sparkline or remove the badge; make capacity an admin setting; show "Not enough data" when a period is missing.

### P1 — First screen answers too many questions at once
Home already leads with `TodayPanel` and `ActionNeededList` (good, keep). Below that, 8 filter pills, an Overview KPI row, an area chart, a stats bar, a summary card, 3 sparkline cards, and Case Manager Workloads all compete equally — verified on screen and in `Dashboard.tsx:397-758` (837 lines).
Fix: keep action panels plus one urgency KPI row above the fold; move charts/sparklines/workloads into a collapsed "Analytics" section or onto `/admin/analytics`; move filter pills into a collapsible control that shows the active count.

### P1 — Navigation reads as a feature list
Admin and org admin see **20 sidebar items across 8 groups** plus 2 footer items (`navigation.ts:94-186`). "Surveys" appears twice with different destinations (`:116` → `/surveys`, `:155` → `/admin/surveys`); "Resources" is duplicated (`:119`, `:129`); "Reports", "Request analytics", "Impact", "Time reports" read as four separate report homes. The mobile "More" drawer re-renders the whole sidebar (`SidebarLayout.tsx:274-309`) rather than a curated subset. `/admin/lifeskills` (`App.tsx:438`) has no menu entry at all. Fallback mobile tab "Language" navigates to Settings (`navigation.ts:246`).
Fix: 5 top-level groups per role, rename duplicates ("My surveys" vs "Survey management"), make `/reports` the single reporting home with tabs for analytics/impact/time, curate the More drawer, and either link or retire `/admin/lifeskills`.

### P1 — AdminDashboard ignores the shared design system
`AdminDashboard.tsx` (758 lines) uses legacy `StatsCard` and raw `Card` markup and imports none of the primitives in `src/components/dashboard/`. `DashboardSection`, `DataTableCard`, `DashboardGrid`, `AttentionPanel`, `SectionEmptyState` and the skeletons currently have zero consumers outside their own folder — built but unadopted.
Fix: adopt the primitives on AdminDashboard first (it's the densest page), then AnalyticsDashboard and ImpactDashboard, and delete `StatsCard` once unused.

### P2 — Status colors sit outside the token system
`index.css:173-209` defines `.status-*`/`.priority-*` with raw palette classes that never reference `--success`/`--warning`/`--destructive`. Feature code then re-invents palettes: `SurveyResponses.tsx` (16 hardcoded color utilities), `SparklineCard.tsx` (12), `FractionStatsCard.tsx` (12), `CategoryBadge.tsx` (12), `UserManagementPage.tsx` (8), `PendingInvitationsSection.tsx` (8).
Fix: add semantic status tokens, rewrite those helpers to use them, then convert the top offenders. Dark mode and any future brand tuning depend on this.

### P2 — Accessibility gaps
- ~46 icon-only buttons without `aria-label`, including `RequestQuickActions.tsx`, `AdminDashboard.tsx`, `TimeTrackingAdmin.tsx`, `Auth.tsx` (some files already do this correctly).
- Of 30 files rendering tables, only `ChartDataTable.tsx` uses a caption; `scope` appears once in the whole tree.
- Only 2 `aria-live` regions app-wide (`OfflineIndicator.tsx:21`, `RequestAttachments.tsx:182`) — saves, errors and filter changes are announced nowhere.
- 11 files render charts; only `AnalyticsDashboard.tsx` provides the `ChartDataTable` equivalent.
Fix: label every icon button, add captions plus `scope="col"` in the `Table` primitive, add one polite live region for save/error/result-count messages, and reuse `ChartDataTable` under every chart.

### P2 — Mobile and print-first overflow risks
Home measured no overflow, but the global `overflow-x: hidden; max-width: 100vw` on `html, body, #root` (`index.css:129-145`) is a clipping safety net, so real overflow hides content instead of scrolling. Highest-risk files: `DrillDownDialog.tsx` (4 `whitespace-nowrap`), `StudentReportPreview.tsx` (3), `ReportPreview.tsx` (3), plus fixed `min-w-[Npx]` in `CaseManagersPage.tsx`, `CohortsIndex.tsx`, `InternalControls.tsx`, `TimeTracking.tsx`, `StudentFolders.tsx`, `StudentDetail.tsx`.
Fix: verify these at 390px, replace nowrap with wrapping plus truncation, and give wide tables their own scroll container instead of relying on the global guard.

### P2 — Loading and empty states are inconsistent
Home uses three ad-hoc pulse blocks (`Dashboard.tsx:381-395`); AdminDashboard, StudentFolders and StudentDetail use a single full-page spinner; inline "No requests yet" text appears instead of `SectionEmptyState` (`Dashboard.tsx:670,751`).
Fix: skeletons that match final layout, and `SectionEmptyState` everywhere with a suggested next step.

### P3 — Two parallel draft systems
`useFormPersistence` + `form_drafts` is the modern path; `useOfflineDrafts` + IndexedDB + `offline_drafts` + `/pages/OfflineDraft.tsx` is the older one. Both live. Fix: pick one, migrate, retire the other.

### P3 — Time tracking review friction
`TimeTrackingAdmin.tsx:117` initializes filters as status/billable only — no date range or case-manager/organization narrowing was found in the inspected range, and there is no "currently clocked in" view for supervisors. No saved/named views exist anywhere in the app.

## Suggested role-based navigation

```text
Student (5)      Home · Get help · My progress · Messages · Help
Case manager (5) Home · Queue · Students · Reports · Messages
Admin / org (6)  Home · Requests · Students · Reports · People · Admin
```

Each top item owns tabs instead of new sidebar rows: Reports → Overview / Analytics / Impact / Time; Admin → Classes · Organizations · QR · NDA · Data export · Internal controls · Login activity. Mobile keeps 4 role tabs plus More, and More lists only that role's secondary items.

## Phased sequence

1. **Trust and truth** — fix the tour, remove fabricated trends, make capacity configurable.
2. **Hierarchy** — Home above-the-fold cleanup, collapsible filters, Analytics section split.
3. **Navigation** — regroup, rename duplicates, tabbed Reports and Admin, curated More drawer.
4. **Consistency** — adopt dashboard primitives on AdminDashboard/Analytics/Impact; skeletons and empty states.
5. **Tokens and accessibility** — semantic status tokens, top color offenders, aria labels, captions, live region, chart data tables.
6. **Mobile and cleanup** — 390px pass on report/dialog components, single draft system, time-tracking filters and saved views.

## Technical notes

Highest-leverage files: `src/lib/navigation.ts`, `src/components/layouts/SidebarLayout.tsx`, `src/pages/Dashboard.tsx`, `src/pages/AdminDashboard.tsx`, `src/components/dashboard/*`, `src/index.css`, `src/components/ui/table.tsx`, `src/components/reports/*`. No database, permission, or query changes are implied by any item above except making case-manager capacity a stored setting (phase 1).
