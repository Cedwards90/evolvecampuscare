# Participant Records Transfer & Continuity System

Builds on existing Folder Summary, PDF sharing, certifications, and audit patterns. Three coordinated capabilities:

1. **Participant Record Export** (PDF + ZIP)
2. **Transfer Workflow** (internal org → org, Admin / Org Admin initiated)
3. **Transition Dashboard** (pending/completed transfers, validation, audit)

---

## 1. Database (new migration)

**`participant_record_exports`** — every export attempt
- `student_id`, `actor_id`, `format` (`pdf` | `zip`), `purpose` (`handoff` | `audit` | `grant` | `transition` | `other`), `notes`
- `file_path` (storage), `file_size`, `mime_type`, `section_counts jsonb`, `validation_report jsonb`
- `transfer_id` (nullable FK), `created_at`

**`participant_transfers`** — one row per transfer event
- `student_id`, `from_organization_id`, `to_organization_id`, `initiated_by`, `reason`, `status` (`pending` | `acknowledged` | `cancelled` | `completed`)
- `included_record_types text[]` (case_notes, requests, certifications, intake, post_grad, appointments, attachments, checkins, outcomes, demographics, messages, audit)
- `validation_snapshot jsonb` (gaps detected at initiation)
- `chain_of_custody jsonb` (append-only event log)
- `acknowledged_by` (Org Admin of receiving org), `acknowledged_at`, `acknowledgement_notes`
- `cancelled_by`, `cancelled_at`, `cancellation_reason`
- `export_id` (FK → participant_record_exports, generated bundle)
- `created_at`, `updated_at`

**`participant_transfer_events`** — audit trail
- `transfer_id`, `actor_id`, `event_type` (`initiated` | `record_added` | `record_removed` | `exported` | `acknowledged` | `cancelled` | `viewed` | `downloaded`), `metadata jsonb`, `created_at`

**`participant_record_access_log`** — who accessed export artifacts
- `export_id`, `actor_id`, `action` (`download` | `view_manifest`), `ip`, `user_agent`, `created_at`

**Storage bucket:** `participant-exports` (private). Path: `{student_id}/{export_id}/{filename}`. Signed URLs only, 10‑minute TTL.

**RLS:**
- Exports/transfers/events/access logs readable by Admin globally, by Org Admin via `user_in_org_admin_scope_v2(auth.uid(), student_id)` on the from/to org, and by `can_staff_manage_student` for the assigned CM (read-only on transfers).
- INSERT transfers: Admin OR (Org Admin of `from_organization_id` AND not suspended).
- INSERT exports: Admin / Org Admin in scope.
- INSERT events / access log: actor = auth.uid() with corresponding transfer/export permission.
- Acknowledge (UPDATE status → acknowledged): Admin OR Org Admin of `to_organization_id`.

GRANTs: SELECT/INSERT/UPDATE for authenticated; full for service_role. No anon.

Add all 4 tables to `REALTIME_TABLES` in `src/lib/realtimeRouter.ts`.

---

## 2. Edge Functions

**`generate-participant-record`** (POST `{ student_id, format, include_types[], purpose, transfer_id? }`)
- Verifies caller can manage student (`can_staff_manage_student` RPC).
- Runs validation pass → returns `validation_report` (missing NDA, unsigned intake, open emergency requests, expired certifications, unresolved support requests, missing outcomes, etc. — warn-only).
- Loads structured data via service client for every record type.
- Renders PDF using existing pdf-lib pattern (reuse helpers in `_shared/request-pdf.ts`; new `_shared/participant-record-pdf.ts` for sections).
- If `format=zip`: streams JSZip with `manifest.json`, `report.pdf`, `attachments/<request>/<file>`, `certifications/<cert>/<file>`, `intake.json`, `notes.json`, `audit.json`, `chain-of-custody.json` (if transfer).
- Uploads to `participant-exports`, inserts `participant_record_exports` row, appends `participant_transfer_events` if `transfer_id` set, returns signed URL + export_id.

**`acknowledge-participant-transfer`** (POST `{ transfer_id, notes? }`)
- Requires Org Admin of `to_organization_id` (or Admin).
- Updates status, writes event, signs receipt PDF stub (small confirmation PDF stored in same bucket).
- Sends in-app notifications to initiator + admins.

**`get-participant-export-url`** (GET `?export_id=…`)
- Verifies access, logs `participant_record_access_log`, returns short-lived signed URL.

All follow existing security pattern: strict CORS, `sanitizeError`, `auth.getUser()`, service client for privileged reads.

---

## 3. Frontend

**Hooks (new)**
- `useParticipantExports(studentId?)` — list + create via Edge Function.
- `useParticipantTransfers({ scope })` — `pending` / `completed` / `all` for current user's scope.
- `useTransferValidation(studentId)` — calls validation-only edge endpoint (or computes client-side from existing hooks; backend remains source of truth).
- `useAcknowledgeTransfer()`, `useCancelTransfer()`.

**Components (new)**
- `src/components/transfers/GenerateParticipantRecordCard.tsx` — replaces nothing; mounts on `StudentDetail.tsx` under a new "Transfer & Records" tab. Format picker (PDF/ZIP), record-type multi-select, purpose dropdown, validation checklist, "Generate".
- `src/components/transfers/InitiateTransferDialog.tsx` — pick receiving org (internal training_organizations dropdown excluding current), reason, record types, validation warnings ("Proceed anyway?"), creates transfer + auto-generates ZIP export linked to it.
- `src/components/transfers/TransferTimeline.tsx` — chain-of-custody event log.
- `src/components/transfers/AcknowledgeTransferDialog.tsx` — for receiving Org Admin.
- `src/components/transfers/TransferValidationChecklist.tsx` — reusable, traffic-light per gap.
- `src/components/transfers/ParticipantTimelineSection.tsx` — chronological merge of enrollment, requests, updates, appointments, notes, certifications, status changes, transfers; uses existing `useStudentDetail` data + new transfer events. Read-only.

**Pages**
- `src/pages/admin/ParticipantTransitions.tsx` — new route `/admin/transitions`. Tabs: **Pending**, **Acknowledged**, **All Transfers**, **Export History**, **Access Logs**. Tables with search/filter, links to student folder + transfer detail.
- `src/pages/admin/TransferDetail.tsx` — route `/admin/transitions/:transferId`. Shows summary, included records, validation snapshot, chain-of-custody timeline, acknowledgement panel, signed download link.

**Integration into existing pages (minimal, additive)**
- `StudentDetail.tsx`: add new "Transfer & Records" tab containing `GenerateParticipantRecordCard`, transfer history for this student, `ParticipantTimelineSection`, and an "Initiate Transfer" button (Admin/Org Admin only).
- Admin sidebar (existing `SidebarLayout.tsx`): add "Participant Transitions" link for Admin + Org Admin roles only.
- `App.tsx`: register the two new routes inside the existing protected admin section.
- `realtimeRouter.ts`: route changes for the 4 new tables to invalidate `['participant-exports']`, `['participant-transfers']`, `['transfer', id]`, `['student-detail', id]`.

No other existing files touched.

---

## 4. Permissions Summary

| Action | Admin | Org Admin (from org) | Org Admin (to org) | Case Manager | Student |
|---|---|---|---|---|---|
| Generate export | ✓ | ✓ (own org students) | — | — | — |
| Initiate transfer | ✓ | ✓ | — | — | — |
| Acknowledge transfer | ✓ | — | ✓ | — | — |
| View transitions dashboard | ✓ (all) | ✓ (own org scope) | ✓ (own org scope) | — | — |
| Download export artifact | ✓ | ✓ (scope) | ✓ (after acknowledge, scope) | — | — |
| View own timeline | ✓ | ✓ (scope) | ✓ (scope) | ✓ (assigned) | — |

---

## 5. Validation Checks (warn-only, configurable)

NDA unsigned · intake incomplete · no assigned case manager · open emergency requests · support requests `submitted`/`in_progress`/`escalated` · expired or expiring-30d certifications · missing participant_outcomes · missing demographics consent · post_grad_plan absent · attachments orphaned · open action items in notes.

Returned as `{ key, severity: 'warn'|'info', label, count, link }[]` and persisted to `validation_snapshot` so audits can replay state at transfer time.

---

## 6. Files

**New (DB + Edge)**
- 1 migration (4 tables + bucket + RLS + GRANTs)
- `supabase/functions/generate-participant-record/index.ts`
- `supabase/functions/acknowledge-participant-transfer/index.ts`
- `supabase/functions/get-participant-export-url/index.ts`
- `supabase/functions/_shared/participant-record-pdf.ts`
- `supabase/functions/_shared/participant-record-validation.ts`

**New (frontend)**
- 4 hooks, 6 components, 2 pages (see above)

**Modified (minimal, additive only)**
- `src/App.tsx` — 2 routes
- `src/components/layouts/SidebarLayout.tsx` — 1 nav link (Admin/Org Admin)
- `src/pages/StudentDetail.tsx` — 1 new tab
- `src/lib/realtimeRouter.ts` — 4 table mappings
- `mem://index.md` — feature reference

No other files touched. No changes to existing business logic, RLS on existing tables, or unrelated UI.
