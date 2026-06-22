## Make Admin Dashboard tables collapsible

Wrap each of the table-bearing sections on `/admin-monitoring-reassigning-requests` (`src/pages/AdminDashboard.tsx`) in a `Collapsible` from `@/components/ui/collapsible`, so admins can hide/show them.

### Sections to make collapsible
1. **Case Manager Workloads** (cards grid)
2. **Escalated Requests** (table)
3. **All Requests** (table + status filter)
4. **Student Assignments** (the `StudentAssignmentsTable` with its own inner Assigned/Unassigned tabs)

### UX
- Each section's existing `CardHeader` becomes a `CollapsibleTrigger` (full-width button row) with a `ChevronDown` icon that rotates 180° when open.
- `CardContent` moves inside `CollapsibleContent`.
- Default state: **all open** (matches current behavior so nothing is hidden by surprise).
- Open/closed state stored in local `useState` per section (not persisted) — keeps scope small.
- Keep the section count badges (e.g. "2 requiring attention") visible in the trigger row so admins can see counts without expanding.

### Out of scope
- No changes to the top stats cards, charts, or filter bar.
- No changes to the inner tables themselves (columns, data, sorting).
- No persistence of collapsed state across reloads.
