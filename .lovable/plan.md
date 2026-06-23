# Community Resource Recommendations

Import the 156-row Chicago resource list (9 categories) into the platform and surface it to students automatically — after they finish the intake survey and whenever they submit a support request — with an AI agent that picks the best matches.

## 1. Data: store resources in the database

New table `community_resources`:
- `category` (text) — one of: Basic Needs & Stability, Housing & Stability, Health & Wellness, Workforce & Economic Empowerment, Legal & Reentry Support, Transportation Services, Youth & Family Services, Senior Services, Community & Civic Engagement
- `name`, `address`, `website`, `contact`, `phone`, `description` (optional/blank for now), `tags` (text[]), `is_active`, timestamps
- RLS: any authenticated user can read; only admins can insert/update/delete
- Admin UI: simple list + add/edit/delete page at `/admin/resources` (linked under Compliance group in sidebar)
- One-time seed migration loads all 156 rows from the uploaded spreadsheet

New table `resource_recommendations` (audit + dedup for student-facing history):
- `student_id`, `resource_id`, `source` ('intake' | 'request' | 'manual'), `request_id?`, `reason` (short AI-generated rationale), `dismissed_at`, `clicked_at`, `created_at`
- RLS: student reads/updates own; staff (admin/CM-assigned/org_admin in scope) reads

## 2. Need → category mapping (rules layer)

Before calling the AI, narrow the candidate set with deterministic rules so the agent stays fast/cheap and grounded. Examples:

| Intake / request signal | Candidate categories |
|---|---|
| `daily_challenges` includes "Food security concerns" | Basic Needs & Stability |
| "Transportation challenges" | Transportation Services |
| "Childcare needs" | Youth & Family Services |
| `mainReason` = "Housing concerns" / living_situation = "Transitional/temporary" | Housing & Stability |
| `mainReason` = "Personal/emotional wellbeing" or `stress_level` ≥ 4 or `interested_resources` includes Counseling/Crisis | Health & Wellness |
| `mainReason` = "Financial hardship" / `work_status` = "Not working" / employment = unemployed | Workforce & Economic Empowerment, Basic Needs & Stability |
| Support request `category` = legal | Legal & Reentry Support |
| Support request `category` = academic/career | Workforce & Economic Empowerment |

Mapping lives in `src/lib/resourceMatching.ts` so it's easy to tune.

## 3. AI agent (Lovable AI Gateway)

New edge function `recommend-resources`:
- Input: `{ student_id, source: 'intake' | 'request', request_id? }`
- Loads the student's intake responses (+ request if applicable) and the filtered candidate resources
- Calls `google/gemini-3-flash-preview` via the AI SDK with structured output (`Output.object`) returning:
  ```
  { recommendations: [{ resource_id, reason }] } // top 3–5
  ```
- Inserts results into `resource_recommendations` (skips duplicates already recommended to that student in last 30 days)
- Returns the rows so the UI can render immediately
- Auth: requires logged-in student or staff acting on their behalf; CORS + Zod validation per edge-function rules

## 4. Where students see recommendations

- **End of intake survey** (`src/pages/IntakeSurvey.tsx`): after `completeIntake` succeeds, call `recommend-resources` with `source: 'intake'`, then show a new `RecommendedResourcesCard` on the post-intake screen and persist them so they appear on the dashboard.
- **After submitting a request** (`src/hooks/useSubmitRequest.ts` or the submit success page): fire `recommend-resources` with `source: 'request'` and show matches inline on the request confirmation + request detail.
- **Student dashboard**: new "Recommended for you" section listing the most recent non-dismissed recommendations with name, category, one-line AI reason, website/phone, and Dismiss / Mark helpful buttons.

## 5. Where staff see them

- On `StudentDetail.tsx` add a "Recommended Resources" subsection inside the student's profile/folder showing history of what was suggested and whether the student engaged.
- Case managers can manually push a resource to a student from the resources admin page (creates a `source: 'manual'` row).

## 6. Browse / search (bonus, lightweight)

New student-facing page `/resources`:
- Filter by category, free-text search across name/address
- Used as the "see all" link from the recommendation card
- Listed in the Workspace sidebar group for students

## Technical notes

- Seed migration uses a single `INSERT … VALUES (...)` batched insert generated from the spreadsheet.
- Edge function uses the AI SDK + `createLovableAiGatewayProvider` helper, schema kept small (only `resource_id` enum of candidate IDs + short `reason` string) to stay under Gemini's structured-output state limit.
- All gateway errors (402/429) surface to the UI as a soft message — the recommendations panel degrades to "Browse all resources" if the AI call fails.
- No PII leaves the server: only de-identified intake answers are sent to the model.

## Files touched

- `supabase/migrations/<ts>_community_resources.sql` (new tables, RLS, seed)
- `supabase/functions/recommend-resources/index.ts` (new)
- `src/lib/resourceMatching.ts` (new — rules)
- `src/hooks/useCommunityResources.ts`, `src/hooks/useResourceRecommendations.ts` (new)
- `src/components/resources/RecommendedResourcesCard.tsx`, `ResourceCard.tsx` (new)
- `src/pages/Resources.tsx`, `src/pages/admin/ResourcesAdmin.tsx` (new)
- `src/pages/IntakeSurvey.tsx`, `src/pages/Dashboard.tsx`, `src/pages/StudentDetail.tsx`, `src/pages/SubmitRequest.tsx` / submit hook (edits)
- `src/App.tsx`, `src/components/layouts/SidebarLayout.tsx` (route + nav)

## Open question

Do you want the AI agent to recommend resources only from this curated list, or should it also be able to suggest "no good match — try this national hotline" fallbacks when the list has nothing relevant?
