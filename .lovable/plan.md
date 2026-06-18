# Show all organizations everywhere + add a data-preservation rule

## 1) Why orgs are "missing"

The database has 4 organizations: **548 Foundation**, **Elevate**, **Englewood Shared Renewables**, and **Jireh**. Three of them have `is_active = false`, so they get hidden by two queries:

- `src/hooks/useFilterOptions.ts` — global filter bar org dropdown — filters `.eq('is_active', true)`.
- `src/hooks/useTrainingOrganizations.ts` (`useActiveOrganizations`) — filters `.eq('is_active', true)`. Used by the Impact dashboard's org filter and breakdown table.

No data was lost — they're just flagged inactive, which the UI treats as hidden.

## 2) Fix (frontend only, no DB changes)

- `useFilterOptions.ts`: drop the `is_active = true` filter. Show all orgs the user is allowed to see (RLS already restricts org_admins to their own orgs; admins see all).
- `useTrainingOrganizations.ts → useActiveOrganizations()`: drop the `is_active = true` filter and rename the comment/intent to "visible organizations" (do not rename the export to avoid touching every call site). All consumers (Impact dashboard org filter, OrgBreakdownTable, ReportFilters, etc.) will then list all four orgs.
- Add a small "Inactive" badge next to inactive org names in the global filter dropdown and Impact org dropdown so admins can tell the difference at a glance. (No behavior change — they're still selectable.)

After this, you'll see 548 Foundation, Elevate, Jireh, and Englewood Shared Renewables in every org dropdown and in the Impact breakdown table.

## 3) Data-preservation rule (going forward)

Save a **Core** memory so it's applied to every future change in this project:

> **Student and organizational data must never be changed, removed, or hidden as a side effect of site updates.** When implementing UI/feature changes:
> - Never add filters that hide existing rows (e.g. `is_active`, `deactivated_at`, `suspended_at`) without explicit user request.
> - Never write migrations that DROP, TRUNCATE, or mass-DELETE/UPDATE rows in `profiles`, `training_organizations`, `organization_memberships`, `student_*`, `support_requests`, `intake_responses`, `post_graduation_plans`, `participant_outcomes`, `request_*`, or any other student/org data table.
> - Schema changes that touch these tables are allowed only when the user explicitly asks; favor additive changes (new columns/tables) over destructive ones.
> - If a feature requires hiding data, surface it as a user-controlled toggle, not a hard filter.

This rule will be persisted to `mem://core` so I follow it on every subsequent prompt without you having to repeat it.

## Files touched

- `src/hooks/useFilterOptions.ts` (1 line removed)
- `src/hooks/useTrainingOrganizations.ts` (1 line removed in `useActiveOrganizations`)
- `src/components/filters/FilterMultiSelect.tsx` or the org-option mapping spots — small "Inactive" label, only if the option carries a flag.
- `mem://index.md` (Core rule updated)

## Out of scope
- No DB migrations.
- No changes to the recent Impact org-breakdown work or the RLS fix.
- No changes to deactivation/reactivation flows on the Training Organizations admin page — admins can still mark orgs inactive there; it just no longer hides them in filters.
