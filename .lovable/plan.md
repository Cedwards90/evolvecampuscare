

## Plan: Fix Offline Drafts, Submission Flow, and UX Polish

### Overview
The submit request flow and track requests page are already using real database queries. The main remaining issue is the **Offline Drafts page** which still uses mock data and fake sync/submit logic. This plan also addresses the draft-to-request sync path and minor UX improvements.

---

### 1. Rewrite Offline Drafts Page to Use Real Storage (Critical)

**Problem:** `src/pages/OfflineDraft.tsx` imports `mockOfflineDrafts` and stores drafts only in component state. Saving, syncing, and submitting are all fake (just `setTimeout` delays). New users see pre-populated demo drafts.

**Fix:** Rewrite the page to use a dual-storage approach:
- **Online:** Read/write drafts to the `offline_drafts` database table (already exists with RLS)
- **Offline:** Fall back to IndexedDB using the existing `src/lib/offlineStorage.ts` utilities

**File:** `src/pages/OfflineDraft.tsx`

Changes:
- Remove the `mockOfflineDrafts` import entirely
- Create a custom hook `useOfflineDrafts` (inline or separate file) that:
  - When online: queries `offline_drafts` table filtered by `user_id = auth.uid()` and `synced = false`
  - When offline: reads from IndexedDB via `getDraftsOffline()`
- **Save Draft:** Write to IndexedDB immediately (works offline), and if online also upsert to `offline_drafts` table
- **Sync Drafts:** For each unsynced IndexedDB draft, upsert to `offline_drafts` table and mark as synced
- **Submit Draft:** Convert draft to a real support request using the existing `useSubmitRequest` hook, then delete the draft from both IndexedDB and the database table
- **Delete Draft:** Remove from both IndexedDB and database table

---

### 2. Create useOfflineDrafts Hook (New File)

**File:** `src/hooks/useOfflineDrafts.ts`

This hook will:
- Query the `offline_drafts` table for the current user's unsynced drafts
- Provide mutations for save, delete, and sync operations
- Integrate with IndexedDB for offline-first capability
- Invalidate queries on success

```text
Hook API:
- drafts: Draft[]         (from DB when online, IndexedDB when offline)
- isLoading: boolean
- saveDraft(data)          -> writes to IndexedDB + DB
- deleteDraft(id)          -> removes from IndexedDB + DB
- syncDrafts()             -> pushes IndexedDB drafts to DB
- submitDraft(draft)       -> calls useSubmitRequest, then deletes draft
```

---

### 3. Fix Draft Submit to Create Real Request (Critical)

**Problem:** The current `submitDraft` function just navigates to `/student-submitting-a-support-request` without creating a request or passing data. The draft is never converted.

**Fix:** In the rewritten `OfflineDraft.tsx`:
- When "Submit" is clicked on a draft, call `useSubmitRequest.mutateAsync()` with the draft data
- On success: delete the draft from IndexedDB and the `offline_drafts` table
- Show a success toast: "Your request has been submitted!"
- Redirect to `/student-tracking-request-status-scheduling-meeting`

---

### 4. Verify Submit Request Flow (Already Working)

**Current state:** `src/pages/SubmitRequest.tsx` already:
- Has per-step validation (step 1: category, step 2: title/description)
- Calls `submitRequest.mutateAsync()` which writes to `support_requests` table
- Shows toast on success: "Request submitted successfully!"
- Redirects to the tracking page
- Invalidates the `['requests']` query cache

**No changes needed** -- the submission flow is already correct. The earlier confusion may have been due to testing with mock data on the tracking page (now fixed).

---

### 5. Minor UX Improvements

**5a. Accessible labels for draft action buttons**
- Add `aria-label` attributes to the Edit, Submit, and Delete buttons in the drafts list
- Add `aria-label` to the Sync button

**5b. Offline status already global**
- The `OfflineIndicator` component is already rendered in `SidebarLayout.tsx` and shows when `!isOnline`
- The `OfflineProvider` wraps the app in `main.tsx`
- No changes needed

**5c. Phone validation already implemented**
- Regex validation `/^\+?[\d\s\-()]{7,20}$/` was already added to Settings.tsx
- No changes needed

---

### Summary of Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useOfflineDrafts.ts` | Create | Hook for dual-storage draft management |
| `src/pages/OfflineDraft.tsx` | Rewrite | Remove mock data, use real storage and submit |

### What Will NOT Change (Already Fixed)
- `src/pages/TrackRequests.tsx` -- already uses real database queries
- `src/pages/SubmitRequest.tsx` -- already has validation, toast, and redirect
- `src/pages/Settings.tsx` -- already has phone validation
- `src/components/layouts/SidebarLayout.tsx` -- already has offline indicator

