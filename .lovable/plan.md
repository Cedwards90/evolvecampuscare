## Group Sidebar Nav into Collapsible Sections

Today the sidebar is one long flat list of ~18 items mixed across roles. The fix is to group items into a few labeled, collapsible sections and let the section containing the active route auto-expand. No items get removed; nothing changes for students (their list is already short).

### Section structure (role-filtered as today)

**Workspace** (always visible to that role)
- Dashboard — all roles
- Messages — all roles
- My Submissions — student
- Submit Request, Track Requests, Offline Drafts — student
- Manage Requests — case_manager, org_admin
- Student Folders — case_manager, admin, org_admin

**People** — admin / org_admin / case_manager
- User Management (admin)
- Case Managers (admin, org_admin)
- Organizations (admin)

**Engagement** — staff
- Surveys
- QR Codes

**Insights** — staff
- Admin Dashboard (admin, org_admin)
- Reports
- Impact Analytics

**Time** — case_manager / admin / org_admin
- Time Tracking (case_manager)
- Time Reports (admin, org_admin)

**Compliance** — admin
- NDA

**Bottom (unchanged)**
- Help Center
- Settings (moved here from the main list — it belongs with utility links)

### Behavior
- Each group uses shadcn `Collapsible` with a small uppercase `SidebarGroupLabel` + chevron.
- The group containing the current route is open by default; others collapsed. Open/closed state persists in `localStorage` per user.
- When the whole sidebar is in `collapsible="icon"` mode, group labels hide and items render as icon-only (tooltips on hover) — no nested chevrons in that mode.
- A group with only one visible item (after role filtering) renders flat — no wrapper — to avoid pointless collapsibles for, e.g., students.
- Students effectively see one short flat list (Workspace only), so they get the same simplified experience they have now.

### Out of scope
- No route/permission changes.
- No icon, label, or color overhaul.
- No mobile sheet redesign beyond mirroring the same grouping.
- No new pages, no removed pages.

### Files touched
- `src/components/layouts/SidebarLayout.tsx` — convert the flat `navItems` array into a grouped structure and render groups with `Collapsible`.

### Verification
- Each role only sees their permitted items, same as before.
- Active route's group is expanded on load; click a different group's item → that group expands, prior remembered state restored on next visit.
- Collapsing the whole sidebar still shows all icons; expanding restores the grouped view.
