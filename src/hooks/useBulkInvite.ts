import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BulkInviteEntry {
  email: string;
  fullName?: string;
}

export interface BulkInviteParams {
  emails: BulkInviteEntry[];
  notes?: string;
  organizationId?: string;
}

export interface BulkInviteResponse {
  jobId: string;
  total: number;
  async: boolean;
  succeeded?: number;
  failed?: number;
  skipped?: number;
}

export function useBulkInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: BulkInviteParams): Promise<BulkInviteResponse> => {
      const { data, error } = await supabase.functions.invoke('bulk-invite-students', {
        body: params,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as BulkInviteResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations'] });
      qc.invalidateQueries({ queryKey: ['bulk-invite-jobs'] });
    },
  });
}

export interface BulkInviteJob {
  id: string;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  status: 'processing' | 'complete' | 'failed';
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface BulkInviteJobItem {
  id: string;
  job_id: string;
  email: string;
  full_name: string | null;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  error: string | null;
  created_at: string;
}

export function useBulkInviteJob(jobId: string | null) {
  return useQuery({
    queryKey: ['bulk-invite-jobs', jobId],
    enabled: !!jobId,
    refetchInterval: (q) => {
      const data = q.state.data as { job: BulkInviteJob } | undefined;
      if (!data?.job) return 2000;
      return data.job.status === 'processing' ? 2000 : false;
    },
    queryFn: async () => {
      const { data: job, error: jobErr } = await supabase
        .from('bulk_invite_jobs')
        .select('*')
        .eq('id', jobId!)
        .single();
      if (jobErr) throw jobErr;

      const { data: items, error: itemErr } = await supabase
        .from('bulk_invite_job_items')
        .select('*')
        .eq('job_id', jobId!)
        .order('created_at', { ascending: true });
      if (itemErr) throw itemErr;

      return { job: job as BulkInviteJob, items: (items ?? []) as BulkInviteJobItem[] };
    },
  });
}
