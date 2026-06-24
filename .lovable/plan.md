## Goal
Help new users learn the platform via (1) an in-app guided walkthrough that fires on first login, and (2) an always-available Support Center with role-specific "Getting Started" guides alongside the existing FAQs.

## What exists today
- `/support` (`SupportCenter.tsx`) already hosts a searchable FAQ with categories for students. Staff FAQs are partial.
- `ContextualFaqTips` shows category-specific tips inside the request wizard.
- No first-run product tour, no "How it works" overview, no Help link in the top nav for all roles.

## What we'll add

### 1. Guided walkthrough (first-login product tour)
- Add a lightweight tour using `driver.js` (small, no React coupling, works with our existing DOM/shadcn).
- Per-role tour scripts:
  - **Student**: Dashboard → Submit Request → Track Requests → Messages → Check-in → Support.
  - **Case Manager**: Dashboard → Manage Requests → My Students → Messages → Reports → Time Tracking.
  - **Org Admin / Admin**: Admin Dashboard → Users/Case Managers → Surveys & Impact → QR Codes → Settings.
- Trigger: auto-runs once after first successful login (flag stored in `profiles.tour_completed_at` so it persists across devices; fallback to `localStorage` if column missing). User can "Skip" or "Don't show again."
- Re-runnable anytime from: Support Center top banner ("Replay walkthrough") and Settings → Help.
- Each step: title + 1–2 sentence description + "Next/Back/Skip" + optional "Learn more" link into Support Center anchor.

### 2. Support Center upgrades (`/support`)
- New top section **"Getting Started"** with role-aware cards:
  - "Platform overview" (what Evolve does, who does what)
  - "Your first 5 minutes" checklist (role-specific)
  - "Replay the guided tour" button
  - "Watch a 2-minute video" placeholder (optional; embed link slot only — no video produced)
- New FAQ categories for **Case Manager** and **Admin/Org Admin** (assignments, approvals, surveys, time tracking, QR codes, impact reports). Reuses the existing FAQ accordion + search.
- "How it works" expandable section explaining roles, request lifecycle, messaging rules, MFA, and data privacy — links to relevant pages.

### 3. Navigation & discoverability
- Add a persistent **Help (?)** icon in the top bar (all roles) → opens Support Center.
- Add an "Onboarding tip" toast on the Dashboard for the first 3 logins ("New here? Take the 60-second tour →").
- Settings page gets a "Help & walkthrough" row.

## Files to add
- `src/lib/tour/driver.ts` — driver.js setup + role tour definitions.
- `src/lib/tour/steps.ts` — per-role step arrays (selectors, titles, copy).
- `src/hooks/useProductTour.ts` — controls auto-trigger, persistence, replay.
- `src/components/support/GettingStartedSection.tsx` — role-aware getting-started cards + replay-tour button.
- `src/components/support/HowItWorks.tsx` — collapsible platform explainer.
- `src/components/navigation/HelpButton.tsx` — top-bar help icon.

## Files to edit
- `src/pages/SupportCenter.tsx` — mount Getting Started + How It Works; add staff/admin FAQ entries.
- `src/components/layouts/SidebarLayout.tsx` (or top header component) — add HelpButton.
- `src/pages/Dashboard.tsx` — first-N-logins onboarding toast + tour auto-trigger hook.
- `src/pages/Settings.tsx` — "Replay walkthrough" row.
- Targeted pages need `data-tour="…"` attributes on a handful of key elements (sidebar items, primary CTAs) so the tour can anchor steps.
- `package.json` — add `driver.js`.

## Out of scope
- No video production; only an embed slot if a URL is supplied later.
- No DB migration required for v1 (localStorage flag is fine). Optional follow-up: add `profiles.tour_completed_at` column for cross-device persistence.
- No translations beyond English in v1 (Spanish copy can follow our existing i18n pattern in a later pass).

## Open questions
1. Should the tour auto-launch for **existing** users too (one-time), or only brand-new signups going forward?
2. Want a short embedded explainer video slot now (URL TBD), or skip video entirely?
3. Should Admin/Org Admin see the same tour, or a separate Org-Admin-scoped one?