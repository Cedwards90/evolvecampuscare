

User wants admins and case managers to be able to delete entries from the request activity timeline (the `request_updates` table) to fix duplicates or mistakes.

Current state:
- `request_updates` table has RLS for SELECT and INSERT only — no DELETE policy exists, so nobody can delete.
- `RequestTimeline.tsx` only renders entries; no delete UI.
- Need: DELETE policy + UI button (admin always, case manager for assigned requests).

Question — should case managers be able to delete ANY entry on assigned requests, or only entries they themselves created? Safer default: case managers delete only their own entries; admins delete any. I'll go with that and mention it in the plan.

## Plan: Delete Activity Timeline Entries

### Backend (migration)
Add a DELETE RLS policy on `public.request_updates`:
- **Admins**: can delete any update
- **Case managers**: can delete updates they authored (`user_id = auth.uid()`) on requests assigned to them
- **Students**: cannot delete

```sql
CREATE POLICY "Admins and authoring case managers can delete updates"
ON public.request_updates FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'case_manager')
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM support_requests sr
      WHERE sr.id = request_updates.request_id
        AND sr.assigned_case_manager_id = auth.uid()
    )
  )
);
```

### Frontend
| File | Change |
|---|---|
| `src/components/requests/RequestTimeline.tsx` | Show small trash icon on each entry when current user is admin OR is the case manager who authored that entry. Confirm via `AlertDialog` then call `supabase.from('request_updates').delete()`. Invalidate the request query to refresh. Toast on success/error. |
| `src/pages/RequestDetail.tsx` | Pass current user role + id into `RequestTimeline` (or read from `useAuth` inside the component). |

Behavior:
- Students: never see delete button.
- Case managers: see delete only on entries they created on their assigned requests.
- Admins: see delete on every entry.
- Confirmation dialog warns the action is permanent.

### Files
- New migration (RLS policy)
- `src/components/requests/RequestTimeline.tsx`
- `src/pages/RequestDetail.tsx` (minor — pass props or rely on auth context)

### Notes
- No new tables, buckets, or secrets.
- Status-change entries can also be deleted (request status itself is unaffected — the timeline is just an audit log row).
- No realtime needed; React Query refetch handles it.

