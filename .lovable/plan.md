

User provided detailed UX feedback on the request detail page. Let me audit what already exists vs. what's new, and group into a focused plan.

**Already implemented (verified in codebase):**
- Activity timeline (`RequestTimeline.tsx`) with delete capability
- Internal notes via `RequestMessages` `isInternal` toggle
- Attachments with file type validation (`ALLOWED_MIME_TYPES`), size limits, preview, delete
- MFA enforcement for staff
- Status badges

**Genuine gaps to address:**

## Plan: Request Detail Page UX Polish

### 1. Visual status progression bar
Add a horizontal stepper above the activity timeline showing: `Submitted → In Review/Assigned → In Progress → Resolved` with current step highlighted. Denied/escalated states branch with distinct color.
- New component: `src/components/requests/StatusProgressBar.tsx`
- Mounted in `RequestDetail.tsx` near the top of the main column

### 2. Clickable contact info
Convert student email/phone to `mailto:` and `tel:` links with icons. Keep the existing "Send Message" in-portal button.
- Edit: `src/pages/RequestDetail.tsx` (student info card section)

### 3. Attachments — show accepted file types + upload progress
- Display accepted formats list ("PDF, JPG, PNG, DOCX, XLSX, CSV") under the existing limit text
- Add per-file progress bar during upload (track `xhr.upload.onprogress` or use Supabase resumable upload)
- Edit: `src/components/requests/RequestAttachments.tsx`
- Possibly edit: `src/hooks/useRequestAttachments.ts` to expose progress

### 4. Approve/Deny confirmations with reason
Wrap the existing Approve/Deny actions in an `AlertDialog` that:
- Asks for confirmation
- Includes a required "Reason / note" textarea on Deny, optional on Approve
- Reason is saved as a `request_updates` entry alongside the status change
- Edit: `src/components/requests/RequestActions.tsx`

### 5. Expected response time hint
Show a small line under the status badge: "Typical response: within 24 hours" (static for now, based on priority — emergency: 2h, high: 8h, medium: 24h, low: 72h).
- Edit: `src/pages/RequestDetail.tsx`

### 6. Accessibility polish
- Add `aria-label` to all icon-only buttons (download, delete, edit timeline, etc.)
- Ensure `<label htmlFor>` on every form field in dialogs touched above
- Add `title`/tooltip to action icons
- Verify focus ring visibility on dropzone and timeline delete buttons

### Files
| File | Change |
|---|---|
| `src/components/requests/StatusProgressBar.tsx` | NEW — visual stepper |
| `src/pages/RequestDetail.tsx` | Mount stepper, clickable contacts, ETA hint |
| `src/components/requests/RequestAttachments.tsx` | Accepted-types list, per-file progress bar, aria labels |
| `src/hooks/useRequestAttachments.ts` | Expose upload progress (optional — may use simple pending state) |
| `src/components/requests/RequestActions.tsx` | Approve/Deny confirmation dialog with reason |
| `src/components/requests/RequestTimeline.tsx` | aria-label audit |

### Out of scope (already done or backend-only)
- Activity timeline (exists)
- Internal notes (exists via `RequestMessages`)
- File preview (exists)
- MFA / password hashing (handled by Supabase Auth + existing MFA enforcement)
- Passkeys — would be a separate larger feature; mention but don't include

### Notes
- No backend schema changes required
- No new buckets, secrets, or tables
- Brand styling preserved (Forest Green primary, pill-shaped UI)

