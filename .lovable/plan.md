

## Plan: Improve Unassigned Request Notifications and Assignment Prompts

### Problem
When a student submits a request without a pre-assigned case manager, the `notify-new-request` Edge Function already creates in-app notifications for admins. However:
1. The notification message says "requires assignment" in the email but the in-app notification just says "submitted a request" -- it doesn't clearly prompt the admin to assign it
2. The notification `type` is `'new_request'`, but the icon map in `NotificationsDropdown` doesn't include that key -- it falls through to a generic Bell icon
3. The Admin Dashboard has an "Unassigned Requests" section, but it's buried below charts -- there's no prominent alert banner at the top when requests need assignment

### Changes

---

### 1. Update In-App Notification for Unassigned Requests

**File:** `supabase/functions/notify-new-request/index.ts`

When the request has no assigned case manager (the fallback path at line 239), update the in-app notification to:
- Use type `'unassigned_request'` instead of `'new_request'`
- Change the title to: "Unassigned Request: [title]"
- Change the message to: "[Student name] submitted a [priority] [category] request. Please assign a case manager."
- Keep the link as `/requests/[requestId]`

For emergency unassigned requests, the existing emergency type and messaging is fine but the message should also mention assignment is needed.

---

### 2. Add Notification Icon Mappings

**File:** `src/components/notifications/NotificationsDropdown.tsx`

Add the missing notification type icons to the `notificationIcons` map:
- `'new_request'` -> `FileText`
- `'unassigned_request'` -> `UserPlus` (prompts assignment action)
- `'emergency'` -> `AlertTriangle`

This ensures notifications render with meaningful icons instead of the default Bell.

---

### 3. Add Prominent Alert Banner on Admin Dashboard

**File:** `src/pages/AdminDashboard.tsx`

Insert a dismissible alert card immediately after the PageHeader (before the Stats Overview section) that appears when `unassignedRequests.length > 0`:

- Uses an amber/warning color scheme
- Shows: "[N] request(s) awaiting case manager assignment"
- Includes a "Review & Assign" button that scrolls to or links to the existing Unassigned Requests table section below
- For emergency unassigned requests, use a red/destructive color scheme instead

This surfaces the most critical action (assigning requests) at the very top of the admin view.

---

### Summary of File Changes

| File | Change |
|------|--------|
| `supabase/functions/notify-new-request/index.ts` | Use `unassigned_request` type with assignment-prompting message |
| `src/components/notifications/NotificationsDropdown.tsx` | Add icon mappings for `new_request`, `unassigned_request`, `emergency` |
| `src/pages/AdminDashboard.tsx` | Add prominent alert banner for unassigned requests at top of page |

