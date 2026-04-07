

## Plan: Mobile-Responsive Admin Pages

### Problem
The admin pages (Training Organizations, User Management, Organization Detail) use wide HTML tables that overflow on mobile screens. Tabs, filters, and pagination also don't adapt well to small viewports.

### Approach
Wrap all tables in a horizontal scroll container and hide less-critical columns on small screens. Use responsive stacking for filters, pagination, and tab triggers.

### Changes

**1. `src/pages/admin/TrainingOrganizations.tsx`**
- Wrap `<Table>` in `<div className="overflow-x-auto">` 
- Hide "Contact" column on mobile (`hidden sm:table-cell`)
- Hide "Members" column on mobile (`hidden md:table-cell`)
- Stack header (title + "Add Organization" button) vertically on mobile — already done via `flex-col sm:flex-row`

**2. `src/pages/admin/UserManagementPage.tsx`**
- Wrap `<Table>` in `<div className="overflow-x-auto">`
- Hide "Email" column on mobile (`hidden sm:table-cell`) — name cell already shows avatar
- Hide "Organization" column on mobile (`hidden md:table-cell`)
- Hide "Joined" column on mobile (`hidden lg:table-cell`)
- Stack pagination text and buttons vertically on small screens (`flex-col sm:flex-row`)

**3. `src/pages/admin/OrganizationDetail.tsx`**
- Wrap both member tables in `<div className="overflow-x-auto">`
- Make tabs list scrollable on mobile (`w-full overflow-x-auto`)
- Stack the header card's stats grid below the org info on mobile (already uses `md:flex-row`, just ensure stats grid is `grid-cols-3` with smaller text on mobile)

**4. `src/components/admin/BulkAssignOrgDialog.tsx`**
- Dialog already uses `sm:max-w-lg` — add `max-h-[90vh]` to prevent overflow on short screens
- Stack footer buttons vertically on very small screens (`flex-col sm:flex-row`)

### Summary

| File | Change |
|------|--------|
| `src/pages/admin/TrainingOrganizations.tsx` | Scroll wrapper, hide columns on mobile |
| `src/pages/admin/UserManagementPage.tsx` | Scroll wrapper, hide columns, responsive pagination |
| `src/pages/admin/OrganizationDetail.tsx` | Scroll wrappers, scrollable tabs |
| `src/components/admin/BulkAssignOrgDialog.tsx` | Constrain height, stack footer on mobile |

