import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type TransferStatus = 'pending' | 'acknowledged' | 'cancelled' | 'completed';

export interface ParticipantTransfer {
  id: string;
  student_id: string;
  from_organization_id: string | null;
  to_organization_id: string;
  initiated_by: string;
  reason: string | null;
  status: TransferStatus;
  included_record_types: string[];
  validation_snapshot: any;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  acknowledgement_notes: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  export_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParticipantExport {
  id: string;
  student_id: string;
  actor_id: string;
  format: 'pdf' | 'zip';
  purpose: string;
  notes: string | null;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  section_counts: Record<string, any>;
  validation_report: any[];
  transfer_id: string | null;
  created_at: string;
}

export interface TransferEvent {
  id: string;
  transfer_id: string;
  actor_id: string;
  event_type: string;
  metadata: Record<string, any>;
  created_at: string;
}

export function useParticipantExports(studentId?: string) {
  return useQuery({
    queryKey: ['participant-exports', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from('participant_record_exports')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ParticipantExport[];
    },
    enabled: !!studentId,
  });
}

export function useAllParticipantExports() {
  return useQuery({
    queryKey: ['participant-exports', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participant_record_exports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as ParticipantExport[];
    },
  });
}

export function useParticipantTransfers(filters?: { student_id?: string; status?: TransferStatus[] }) {
  return useQuery({
    queryKey: ['participant-transfers', filters],
    queryFn: async () => {
      let q = supabase.from('participant_transfers').select('*').order('created_at', { ascending: false });
      if (filters?.student_id) q = q.eq('student_id', filters.student_id);
      if (filters?.status?.length) q = q.in('status', filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ParticipantTransfer[];
    },
  });
}

export function useTransferEvents(transferId?: string) {
  return useQuery({
    queryKey: ['participant-transfer-events', transferId],
    queryFn: async () => {
      if (!transferId) return [];
      const { data, error } = await supabase
        .from('participant_transfer_events')
        .select('*')
        .eq('transfer_id', transferId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as TransferEvent[];
    },
    enabled: !!transferId,
  });
}

export function useGenerateParticipantRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      student_id: string;
      format: 'pdf' | 'zip';
      purpose: string;
      notes?: string;
      include?: string[];
      transfer_id?: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-participant-record', { body: input });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { export: ParticipantExport; signed_url: string; validation: any[] };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['participant-exports', vars.student_id] });
      qc.invalidateQueries({ queryKey: ['participant-exports', 'all'] });
      if (vars.transfer_id) {
        qc.invalidateQueries({ queryKey: ['participant-transfer-events', vars.transfer_id] });
        qc.invalidateQueries({ queryKey: ['participant-transfers'] });
      }
    },
  });
}

export function useGetExportUrl() {
  return useMutation({
    mutationFn: async (export_id: string) => {
      const { data, error } = await supabase.functions.invoke('get-participant-export-url', { body: { export_id } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as { signed_url: string }).signed_url;
    },
  });
}

export function useInitiateTransfer() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      student_id: string;
      from_organization_id: string;
      to_organization_id: string;
      reason: string;
      included_record_types: string[];
      validation_snapshot?: any[];
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('participant_transfers')
        .insert({
          student_id: input.student_id,
          from_organization_id: input.from_organization_id,
          to_organization_id: input.to_organization_id,
          initiated_by: user.id,
          reason: input.reason,
          included_record_types: input.included_record_types,
          validation_snapshot: input.validation_snapshot || [],
        })
        .select('*')
        .single();
      if (error) throw error;
      await supabase.from('participant_transfer_events').insert({
        transfer_id: data.id,
        actor_id: user.id,
        event_type: 'initiated',
        metadata: { reason: input.reason, included: input.included_record_types },
      });
      return data as ParticipantTransfer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['participant-transfers'] });
    },
  });
}

export function useAcknowledgeTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { transfer_id: string; notes?: string }) => {
      const { data, error } = await supabase.functions.invoke('acknowledge-participant-transfer', { body: input });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['participant-transfers'] });
      qc.invalidateQueries({ queryKey: ['participant-transfer-events', v.transfer_id] });
    },
  });
}

export function useCancelTransfer() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { transfer_id: string; reason: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('participant_transfers')
        .update({
          status: 'cancelled',
          cancelled_by: user.id,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: input.reason,
        })
        .eq('id', input.transfer_id);
      if (error) throw error;
      await supabase.from('participant_transfer_events').insert({
        transfer_id: input.transfer_id,
        actor_id: user.id,
        event_type: 'cancelled',
        metadata: { reason: input.reason },
      });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['participant-transfers'] });
      qc.invalidateQueries({ queryKey: ['participant-transfer-events', v.transfer_id] });
    },
  });
}

export function useExportAccessLog(exportId?: string) {
  return useQuery({
    queryKey: ['participant-export-access-log', exportId],
    queryFn: async () => {
      if (!exportId) return [];
      const { data, error } = await supabase
        .from('participant_record_access_log')
        .select('*')
        .eq('export_id', exportId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!exportId,
  });
}
