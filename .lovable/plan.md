# Impact Analytics Dashboard

A single dashboard that rolls up the data layer we just shipped (funnel events, outcomes, program costs, demographics, surveys) into a logic-model view: **Inputs → Activities → Outputs → Outcomes → Impact**. Scoped automatically: Admins see the whole platform, Org Admins see only their org(s).

## Route & Navigation

- New page: `/admin/impact` → `src/pages/admin/ImpactDashboard.tsx`
- Sidebar entry "Impact Analytics" for Admins and Org Admins (under Reports section)
- Uses existing `PageNav` and `GlobalFilterBar` patterns

## Filter Bar (top of page)

Powered by a new `useImpactFilters` hook + URL params for deep-linking:

- **Date range** (preset: 30/90/180/365/All, or custom) — `ReportRangePicker`
- **Organization** — multi-select (Admin: all orgs; Org Admin: locked to their orgs)
- **Cohort / Class year** — from existing `useFilterOptions`
- **Case Manager** — multi-select (Admin only)
- **Demographics** — gender, age range, veteran, justice-involved, disability (uses `participant_demographics`)
- **Reset / Save view** button

All downstream queries derive from a single `ImpactFiltersContext` so cards, charts, and exports stay in sync.

## Dashboard Sections (logic model)

```text
┌─────────────────────────────────────────────────────────┐
│ 1. INPUTS         Program cost, staff capacity, $/seat   │
│ 2. ACTIVITIES     Requests handled, meetings, check-ins  │
│ 3. OUTPUTS        Certifications earned, plans completed │
│ 4. OUTCOMES       Placement, wage lift, retention curves │
│ 5. IMPACT         SROI, equity gaps, lifetime value      │
└─────────────────────────────────────────────────────────┘
```

### 1. Inputs (from `program_cost_settings`, `user_roles`)
- Total program cost (period)
- Cost per active participant
- Active case managers / org admins
- Caseload distribution sparkline

### 2. Activities (from `participant_funnel_events`, `support_requests`, `appointments`, `messages`, `student_check_ins`)
- Funnel: QR scan → Signup → NDA → Intake → First request → Meeting (conversion % between stages)
- Requests submitted vs resolved (area chart)
- Meetings scheduled / completed
- Check-ins submitted, average mood trend

### 3. Outputs (from `student_certifications`, `post_graduation_plans`, `participant_record_exports`)
- Certifications earned (count + by category)
- Post-grad plans completed
- Records transferred / handoffs completed

### 4. Outcomes (from `participant_outcomes`)
- Placement rate (% with `placement_date`)
- Average wage lift = `hourly_wage − baseline_wage`
- Retention curve: 30 / 60 / 90 / 180 / 365 day % (line chart)
- Time-to-placement distribution
- Program completion rate

### 5. Impact (computed)
- **SROI ratio** = (wage lift × annualized hours × placed count + public-benefit offsets) ÷ program cost
- **Equity panel**: outcome parity gap by gender / ethnicity / veteran / justice-involved (bar comparison vs overall)
- **Lifetime earnings lift** (projected) per cohort
- **Goal progress**: pulls active `funding_goals`, shows actual vs target with progress bar

## Data Layer

New hook file `src/hooks/useImpactAnalytics.ts` with composed queries (React Query, 5-min stale):
- `useImpactInputs(filters)`
- `useImpactActivities(filters)`
- `useImpactOutputs(filters)`
- `useImpactOutcomes(filters)`
- `useImpactSROI(filters)` — derives from outcomes + costs
- `useImpactEquity(filters)` — joins outcomes with demographics

All queries respect existing RLS — no new policies needed. Org Admins automatically see only their org because every table is already scoped through `user_in_org_admin_scope_v2` / `is_org_admin_of`.

Realtime: register the analytics query keys in `src/lib/realtimeRouter.ts` so cards refresh when new outcomes/funnel events arrive.

## Components

```text
src/components/impact/
├── ImpactFilterBar.tsx
├── InputsSection.tsx
├── ActivitiesSection.tsx
├── FunnelChart.tsx          (custom Recharts funnel)
├── OutputsSection.tsx
├── OutcomesSection.tsx
├── RetentionCurve.tsx       (line chart)
├── ImpactSection.tsx
├── SROICard.tsx
├── EquityPanel.tsx          (grouped bar)
└── GoalProgressCard.tsx
```

Reuses existing `StatsCard`, `AreaChartCard`, `SparklineCard`, `FractionStatsCard`, `PercentageStatsCard`, `chart.tsx`.

## Export

"Export" button in header → PDF + CSV via extension of `src/lib/reportExport.ts`:
- PDF: branded header (org name if filtered + "Powered by Evolve Foundation"), each section as a page, charts rasterized
- CSV: flat metrics table + raw outcomes rows
- Logs an entry to `impact_report_audit`

## Out of scope (this pass)
- Editing program cost settings (already in Settings)
- Configuring funding goals UI (separate task if needed)
- Survey response analytics (separate, larger module)

## Files Created / Modified

**Created**
- `src/pages/admin/ImpactDashboard.tsx`
- `src/contexts/ImpactFiltersContext.tsx`
- `src/hooks/useImpactAnalytics.ts`
- `src/components/impact/*` (10 files above)

**Modified**
- `src/App.tsx` — add route
- `src/components/layouts/SidebarLayout.tsx` — nav link (Admin + Org Admin)
- `src/lib/realtimeRouter.ts` — invalidate impact queries on outcome/funnel changes
- `src/lib/reportExport.ts` — add `exportImpactReport()`
