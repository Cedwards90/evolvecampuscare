# Dashboard & Layout Consistency Overhaul

Goal: make every dashboard feel like one focused workspace with a predictable hierarchy, fewer competing cards, and role-specific prioritization. This is presentation-layer work only — no changes to queries, permissions, or backend behavior.

## Current state (verified)

- There is now only one app shell: `src/components/layouts/SidebarLayout.tsx` (plus `AuthLayout` and `MobileTabBar`). `AppLayout.tsx` was already removed in the previous UX pass, so "consolidate two shells" is already done; the remaining gap is that pages set their own widths, padding, and section patterns.
- Shared primitives exist but are thin: `PageHeader` (title/description/actions only), `SummaryCard` (gradient header, decorative `Settings` icon with no action), `StatsSummaryBar`, plus four chart/stat cards. No shared section header, grid, attention panel, or KPI card.
- `Dashboard.tsx` (832 lines) and `AdminDashboard.tsx` (758 lines) each compose their own layout; `AdminDashboard` has no tab separation between analytics and operational work.
- `GlobalFilterBar` already has active-filter chips and Reset, and is used on 16 pages. It has no compact/collapsed mode, no drawer, no result count, and no saved views.
- `RequestCard` is keyboard-accessible; hierarchy is title → description → badges, with no request ID, last-updated, next action, or explicit "Open request" affordance.

## What will be built

### 1. Shared dashboard primitives (new)
In `src/components/dashboard/`:
- `DashboardGrid` / `DashboardCol` — 12-column desktop grid, `gap-6`, single-column mobile.
- `DashboardSection` — shared section header: title, optional description, count badge, "View all" link, optional collapse.
- `AttentionPanel` — full-width strip for emergencies, overdue items, failed syncs, and required actions; renders nothing when empty.
- `KpiCard` — one message per card, fixed height, consistent typography, clear trend direction + comparison period label, optional contextual action link. Wraps `MetricValue` so definitions and "Not enough data" behavior are preserved.
- `DataTableCard` — table container with title, export slot, and row skeletons.
- `DashboardSkeletons` — KPI, chart, and table-row skeletons that preserve final layout.
Exported through `src/components/dashboard/index.ts`.

### 2. Standard page shell rules
- `PageHeader` gains optional `actions` (primary action) and `filters`/`meta` slots so every page uses the same header composition.
- Content wrapper standardized to `max-w-screen-2xl mx-auto` with the existing `SidebarLayout` padding; pages stop declaring bespoke widths.

### 3. Predictable dashboard sequence
Applied to `Dashboard.tsx` and `AdminDashboard.tsx`:
1. Page header (title, description, primary action, filters)
2. Attention strip
3. Primary task area — "What needs attention today?" actionable list
4. 3–5 KPIs max
5. Trends and breakdowns (charts, drill-down links)
6. Secondary content (supporting lists, resources, recent activity)

### 4. Role-specific first viewport
- Student: submit a request, continue an unfinished draft, complete a check-in, active request status, schedule a meeting.
- Case manager: emergency requests, unassigned/overdue, today's appointments, students needing follow-up, workload.
- Admin: unassigned requests, overdue/at-risk requests, organization health, load imbalance, data-quality exceptions.
The existing `TodayPanel` and `ActionNeededList` become the primary task area and are given role-aware content; underlying hooks and filters stay as they are.

### 5. Admin: overview vs operations
`AdminDashboard.tsx` split into tabs — **Overview** (KPIs and trends), **Work queue** (requests needing action/assignment), **People** (students and case managers), **Reports** (links to existing report and export pages). Existing routes and pages are linked, not duplicated.

### 6. Card density cleanup
`SummaryCard` and `StatsSummaryBar` refactored: drop the decorative gradient in favor of tokenized surfaces, remove the non-functional `Settings` icon, one main message per card, consistent heights, explicit trend + comparison period, and "Full Details" replaced with contextual actions such as "View requests".

### 7. Filters made subordinate
`GlobalFilterBar` gains a compact mode: a "Filters" button opening a popover on desktop and a drawer on mobile, active-filter chips kept inline, result count shown beside the control, prominent active date range, and Reset retained. Saved views (localStorage + user preferences, following the existing filter-persistence pattern) with admin presets: Emergency requests, Unassigned, My organization. Persistence across navigation is unchanged.

### 8. Loading, empty, and mobile states
- Section-level skeletons replace full-page spinners; individual sections load inline.
- Every empty state gets a next action ("No active requests. Submit a support request to get started.").
- Mobile: sticky primary action, existing bottom tab bar kept, filters in a drawer, wide tables rendered as stacked records, secondary analytics collapsed by default, urgent items pinned to the top.

### 9. Request card hierarchy
`RequestCard` reordered: emergency/overdue status first, then title, request ID and last-updated, consistently grouped category/priority/status with a single prominent status indicator, next required action, smaller secondary metadata, and an explicit "Open request" affordance. Staff view emphasizes urgency and next action; student view emphasizes progress. Keyboard and ARIA behavior preserved.

### 10. Quieter charts
Chart cards standardized: fewer colors from the token palette, minimal legends, explicit comparison period, consistent heights and axis formatting, meaningful empty states, a one-line textual summary, and a link to underlying records. The existing accessible data-table toggle stays.

## Technical notes

- Presentation-only: no schema, RLS, Edge Function, or query-shape changes. Existing hooks (`useAnalyticsData`, report hooks, global filters) keep their signatures; `MetricValue`, `ReportMetadata`, and `ChartDataTable` behavior for honest/non-derivable metrics is preserved.
- Files touched: new primitives in `src/components/dashboard/`, plus `PageHeader.tsx`, `SummaryCard.tsx`, `StatsSummaryBar.tsx`, chart cards, `RequestCard.tsx`, `GlobalFilterBar.tsx`, `Dashboard.tsx`, `AdminDashboard.tsx`.
- Other pages using `GlobalFilterBar` keep working through a backward-compatible default; migrating them to compact mode is opt-in.
- Colors and spacing use existing semantic tokens only; no hardcoded color utilities.
- Verification: TypeScript check, then Playwright screenshots of student, case-manager, and admin dashboards at mobile and desktop widths.

## Out of scope

The remaining items from the approved enterprise data-trust plan (transactional attachment staging, draft-status rollout into forms, survey persistence integration, `RequestAnalytics` truncation surfacing, Phases 2 and 3) are untouched here and remain open.
