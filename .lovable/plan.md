## Goal
Make the existing organization sort on `/admin/surveys` discoverable, matching the obvious "Sort by" dropdown style already used on the Plans tab.

## Changes — `src/pages/admin/SurveyResponses.tsx` only

### 1. Add a visible Sort control above the Check-Ins table
Mirror the Plans tab pattern. Add this above the Check-Ins `<Card>`:

```
[Sort by ▾] Date (newest) / Date (oldest) / Student A–Z / Student Z–A / Organization A–Z / Organization Z–A
```

Wired to existing `checkSort` state and `setCheckSort`. Sortable column headers stay (they remain a power-user shortcut).

### 2. Make the column header sort affordance more obvious
- Add `cursor-pointer hover:text-primary` to the header `<button>` styling.
- Always render the `ArrowUpDown` icon when not active (already done) — also bold the active header label.

### 3. Plans tab visual parity
- Keep the existing "Sort by" dropdown but prefix with the same label/spacing as Check-Ins for visual consistency.

### 4. Confirm wiring (no change expected, just verify in code)
- `useGlobalFilters().filters.organizationId` already filters both lists.
- `organization_name` is already hydrated by `useSurveyResponses.ts`.
- Sort by `'organization'` already works for both Check-Ins and Plans.

## Out of scope
- No changes to data hooks, RLS, or other pages.
- No grouping by organization.

## Files touched
- `src/pages/admin/SurveyResponses.tsx`
