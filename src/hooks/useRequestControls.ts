import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

function invalidate(qc: ReturnType<typeof useQueryClient>, requestId: string) {
  qc.invalidateQueries({ queryKey: ['request', requestId] });
  qc.invalidateQueries({ queryKey: ['requests'] });
  qc.invalidateQueries({ queryKey: ['student-detail'] });
  qc.invalidateQueries({ queryKey: ['request-analytics'] });
  qc.invalidateQueries({ queryKey: ['missing-receipts'] });
}

async function addTimelineNote(requestId: string, userId: string, note: string, isInternal = false) {
  await supabase.from('request_updates').insert({
    request_id: requestId,
    user_id: userId,
    note,
    is_internal: isInternal,
  });
}

/** Archive keeps the record and all of its history; it only leaves the active queues. */
export function useArchiveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, userId, reason }: { requestId: string; userId: string; reason: string }) => {
      if (!reason.trim()) throw new Error('A reason is required to archive a request.');
      const { error } = await db
        .from('support_requests')
        .update({ archived_at: new Date().toISOString(), archived_by: userId, archive_reason: reason.trim() })
        .eq('id', requestId);
      if (error) throw error;
      await addTimelineNote(requestId, userId, `Request archived. Reason: ${reason.trim()}`, true);
    },
    onSuccess: (_d, v) => invalidate(qc, v.requestId),
  });
}

export function useUnarchiveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, userId }: { requestId: string; userId: string }) => {
      const { error } = await db
        .from('support_requests')
        .update({ archived_at: null, archived_by: null })
        .eq('id', requestId);
      if (error) throw error;
      await addTimelineNote(requestId, userId, 'Request restored from the archive.', true);
    },
    onSuccess: (_d, v) => invalidate(qc, v.requestId),
  });
}

/** Second approval for amounts above the threshold. Must be a different admin. */
export function useSecondApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, userId, note }: { requestId: string; userId: string; note?: string }) => {
      const { error } = await db
        .from('support_requests')
        .update({ second_approval_by: userId, second_approval_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;
      await addTimelineNote(
        requestId,
        userId,
        `Second approval recorded.${note?.trim() ? ` Note: ${note.trim()}` : ''}`,
        false,
      );
    },
    onSuccess: (_d, v) => invalidate(qc, v.requestId),
  });
}

export interface PaymentInput {
  requestId: string;
  userId: string;
  amountPaid: number;
  paidAt: string;
  method: string;
  reference: string;
}

/** Records the payment. The database blocks an approver from paying their own approval. */
export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, userId, amountPaid, paidAt, method, reference }: PaymentInput) => {
      const { error } = await db
        .from('support_requests')
        .update({
          amount_paid: amountPaid,
          paid_at: new Date(paidAt).toISOString(),
          paid_by: userId,
          payment_method: method,
          payment_reference: reference.trim() || null,
        })
        .eq('id', requestId);
      if (error) throw error;

      const formatted = amountPaid.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
      await addTimelineNote(
        requestId,
        userId,
        `Payment recorded: ${formatted} by ${method}${reference.trim() ? ` (ref ${reference.trim()})` : ''}. Please confirm the amount you received.`,
        false,
      );

      const { data: req } = await db
        .from('support_requests')
        .select('student_id, title')
        .eq('id', requestId)
        .maybeSingle();
      if (req?.student_id) {
        const { error: notifyError } = await db.rpc('notify_user', {
          _user_id: req.student_id,
          _title: 'Confirm the funds you received',
          _message: `A payment of ${formatted} was recorded for "${req.title}". Please confirm the amount and date you received it.`,
          _type: 'status_update',
          _link: `/requests/${requestId}`,
        });
        if (notifyError) console.error('Failed to notify participant:', notifyError);
      }
    },
    onSuccess: (_d, v) => invalidate(qc, v.requestId),
  });
}

/** The participant confirms what they actually received. */
export function useConfirmReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      userId,
      amount,
      receivedOn,
    }: {
      requestId: string;
      userId: string;
      amount: number;
      receivedOn: string;
    }) => {
      const { error } = await db
        .from('support_requests')
        .update({
          participant_confirmed_amount: amount,
          participant_confirmed_at: new Date(receivedOn).toISOString(),
        })
        .eq('id', requestId);
      if (error) throw error;
      await addTimelineNote(
        requestId,
        userId,
        `Participant confirmed receiving ${amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} on ${new Date(receivedOn).toLocaleDateString()}.`,
        false,
      );
    },
    onSuccess: (_d, v) => invalidate(qc, v.requestId),
  });
}

/** Admin override when the participant cannot confirm. Reason is recorded. */
export function useReceiptOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, userId, reason }: { requestId: string; userId: string; reason: string }) => {
      if (!reason.trim()) throw new Error('A written reason is required.');
      const { error } = await db
        .from('support_requests')
        .update({ receipt_override_reason: reason.trim(), receipt_override_by: userId })
        .eq('id', requestId);
      if (error) throw error;
      await addTimelineNote(requestId, userId, `Receipt confirmation overridden by an administrator. Reason: ${reason.trim()}`, false);
    },
    onSuccess: (_d, v) => invalidate(qc, v.requestId),
  });
}

/** Coding: funding source, class and test-record marking. */
export function useSetRequestCoding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      userId,
      fundingSourceId,
      cohortId,
      isTestRecord,
    }: {
      requestId: string;
      userId: string;
      fundingSourceId?: string | null;
      cohortId?: string | null;
      isTestRecord?: boolean;
    }) => {
      const payload: Record<string, unknown> = {};
      if (fundingSourceId !== undefined) payload.funding_source_id = fundingSourceId;
      if (cohortId !== undefined) payload.cohort_id = cohortId;
      if (isTestRecord !== undefined) payload.is_test_record = isTestRecord;
      if (Object.keys(payload).length === 0) return;
      const { error } = await db.from('support_requests').update(payload).eq('id', requestId);
      if (error) throw error;
      await addTimelineNote(requestId, userId, 'Request coding updated (funding source / class / record type).', true);
    },
    onSuccess: (_d, v) => invalidate(qc, v.requestId),
  });
}

/** Timeline entries are retracted, never deleted. */
export function useRetractTimelineEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, userId }: { entryId: string; userId: string; requestId?: string }) => {
      const { error } = await db
        .from('request_updates')
        .update({ retracted_at: new Date().toISOString(), retracted_by: userId })
        .eq('id', entryId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      if (v.requestId) qc.invalidateQueries({ queryKey: ['request', v.requestId] });
      qc.invalidateQueries({ queryKey: ['request-updates'] });
    },
  });
}
