## Remove Participant Transitions/Transfers Entirely

Full teardown of the Transitions tab and the underlying transfers/exports feature.

### Frontend removals
- **`src/App.tsx`** — drop the `TransitionsDashboard` import and the `/admin/transitions` route.
- **`src/components/layouts/SidebarLayout.tsx`** — remove the `Transitions` nav item (and `ArrowRightLeft` import if unused).
- **`src/pages/admin/TransitionsDashboard.tsx`** — delete.
- **`src/pages/StudentDetail.tsx`** — remove the `transfers` / "Transfer & Records" option, its content block, and the three transfer-component imports (`GenerateParticipantRecordCard`, `InitiateTransferDialog`, `ParticipantTransfersSection`).
- **`src/components/transfers/`** — delete the entire folder (`GenerateParticipantRecordCard.tsx`, `InitiateTransferDialog.tsx`, `ParticipantTransfersSection.tsx`).
- **`src/hooks/useParticipantTransfers.ts`** — delete.
- **`src/lib/realtimeRouter.ts`** — remove the `participant_transfers`, `participant_transfer_events`, `participant_record_exports`, `participant_record_access_log` cases and their entries in the subscribed-tables list.

### Edge functions (delete code + deployed function)
- `supabase/functions/acknowledge-participant-transfer/`
- `supabase/functions/generate-participant-record/`
- `supabase/functions/get-participant-export-url/`

Call `supabase--delete_edge_functions` for these three names so the deployed instances are removed.

### Database migration (destructive — drops data)
Single migration in dependency order:
```sql
DROP TABLE IF EXISTS public.participant_record_access_log CASCADE;
DROP TABLE IF EXISTS public.participant_record_exports CASCADE;
DROP TABLE IF EXISTS public.participant_transfer_events CASCADE;
DROP TABLE IF EXISTS public.participant_transfers CASCADE;
```
Also drop the `participant-exports` storage bucket and its objects.

### Verification
- Build passes (no dangling imports).
- `/admin/transitions` 404s, sidebar no longer lists Transitions, StudentDetail dropdown no longer shows Transfer & Records.
- `supabase--linter` clean re: dropped tables.

### Out of scope
- Generic request PDF sharing (`share-request-pdf`, `public-request-pdf`) — unrelated to participant transfers, kept.
- Student File / Folder Summary / Certifications — untouched.

### Warning to user
This permanently destroys every existing participant transfer record, transfer event, exported participant record metadata, access log, and any files stored in the `participant-exports` bucket. There is no undo.
