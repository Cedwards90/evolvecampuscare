# High-Priority UX Overhaul

Goal: make the app feel like a workflow ("I need help" / "I'm managing" / "I'm reporting") instead of a 30-item toolbox. One pass, six areas.

## 1. Semantic URLs with redirects

Add short, workflow-based routes and permanently redirect the legacy literal paths so bookmarks, emailed links, and QR codes keep working.

| New route | Replaces |
| --- | --- |
| `/requests/new` | `/student-submitting-a-support-request`, `/student/support-request` |
| `/requests/mine` | `/student-tracking-request-status-scheduling-meeting` |
| `/requests/drafts` | `/student-creating-offline-draft-request` |
| `/requests/queue` | `/case-manager-managing-student-requests` |
| `/admin` | `/admin-monitoring-reassigning-requests` |
| `/students` | `/student-folders` |
| `/reports/*`, `/settings`, `/messages`, `/requests`, `/requests/:id` | unchanged (already semantic) |

A small `legacyRedirects` map renders `<Navigate replace>` routes for every old path, including the ones used in QR flows and email links. All internal `Link`/`navigate` call sites are updated to the new paths.

## 2. Sidebar: workflow groups, no duplicates

Rebuild the nav model into four intent-based groups per role, with the current 6 groups + flat 30 labels collapsed:

- Students: `Home`, `Get Help` (Submit request, My requests, Drafts), `My Progress` (Surveys, Check-in, Submissions, Resources), `Messages`
- Case managers: `Home`, `Caseload` (Request queue, Students, Appointments, Messages), `Reporting` (Reports, Case notes, Surveys), `Time`
- Admin / org admin: `Home`, `Operations` (Admin dashboard, Requests, Students, Appointments), `People` (Users, Case managers, Organizations), `Reporting` (Reports, Request analytics, Impact, Time reports), `Administration` (Surveys, QR codes, Resources, NDA, Login activity)

Duplicate `Surveys` entries are resolved to a single role-aware destination. Nav config moves to `src/lib/navigation.ts` so the sidebar, mobile drawer, and bottom tabs read the same source.

## 3. Mobile bottom tab bar

New `MobileTabBar` with 5 role-based tabs (student: Home, Get Help, Surveys, Messages, More; staff: Home, Queue, Students, Reports, More). Visible under `md`, fixed to the bottom with safe-area padding; "More" opens the existing drawer for everything else. Page content gets bottom padding so nothing is covered. Top mobile header slims down to logo + notifications + avatar.

## 4. Dashboard: action first, analytics second

Restructure `Dashboard.tsx` into three stacked zones instead of a flat stack of banners and charts:

1. **Today panel** (first viewport, role-specific): one primary CTA plus a compact list of the things needing attention today — for students: submit/continue a request, active request status, due check-in, pending surveys; for staff: unassigned/escalated requests, overdue items, today's appointments, unread messages.
2. **Consolidated alerts**: the current stack of banner cards (profile review, check-in, survey invites, plan, intake) collapses into one prioritized "Action needed" list that shows at most the top 2 items with a "see all" expansion. Same underlying data and links — presentation only.
3. **Overview**: existing stats cards, charts, sparkline, summary, and role cards move below the fold, unchanged in logic.

No data-fetch or business-logic changes; the existing hooks feed the new layout.

## 5. Auth: split student and staff flows

- `/auth` becomes the student-facing screen: email + password, Google, "Create account", nothing else visible.
- `/auth/staff` handles staff sign-in, with MFA verification/enrollment revealed only after credentials succeed.
- Invite links (`?invite=`) route to a dedicated invitation view that shows the role and only the fields needed to accept.
- Shared form logic extracted into `src/components/auth/` pieces so behavior (validation, redirects, MFA gate, password rules) is preserved exactly — only what is on screen at once changes.

## 6. Empty and loading states

Replace blank/sparse containers with contextual `EmptyState` usage plus a CTA on: dashboard request lists, request queue, my requests, drafts, surveys, check-ins, students index, appointments, reports, messages. Example: "No active requests yet — Submit your first support request". Skeletons replace bare spinners on the dashboard zones, request lists, and student index.

## Technical notes

- Route table in `src/App.tsx` reorganized by workflow with a generated legacy-redirect block; `ProtectedRoute` role gating carried over per route unchanged.
- New: `src/lib/navigation.ts`, `src/components/layouts/MobileTabBar.tsx`, `src/components/dashboard/TodayPanel.tsx`, `src/components/dashboard/ActionNeededList.tsx`, `src/pages/auth/StaffAuth.tsx` (+ shared auth form components).
- Edited: `src/App.tsx`, `SidebarLayout.tsx`, `AppLayout.tsx`, `Dashboard.tsx`, `Auth.tsx`, and internal link call sites for renamed routes.
- No database, RLS, edge function, or query-logic changes. Existing permissions, MFA enforcement, and data behavior stay as-is.
- Verification: typecheck, then a Playwright pass at mobile and desktop widths on dashboard, request submit, queue, and auth to confirm no overflow and no broken links.
