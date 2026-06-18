import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TimeEntryFilters {
  caseManagerId?: string;
  studentId?: string;
  organizationId?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'all';
  billable?: 'all' | 'true' | 'false';
  startDate?: string;
  endDate?: string;
  mineOnly?: boolean;
}

export interface TimeEntry {
  id: string;
  case_manager_id: string;
  student_id: string | null;
  organization_id: string | null;
  service_type: string;
  start_time: string;
  end_time: string;
  entry_date: string;
  duration_minutes: number;
  notes: string | null;
  billable: boolean;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  case_manager?: { full_name: string | null; email: string } | null;
  student?: { full_name: string | null; email: string } | null;
  organization?: { name: string } | null;
}

export function useTimeEntries(filters: TimeEntryFilters = {}) {
  return useQuery({
    queryKey: ['time-entries', filters],
    queryFn: async (): Promise<TimeEntry[]> => {
      let q = supabase
        .from('time_entries')
        .select(`
          *,
          case_manager:profiles!time_entries_case_manager_id_fkey(full_name, email),
          student:profiles!time_entries_student_id_fkey(full_name, email),
          organization:training_organizations(name)
        `)
        .order('entry_date', { ascending: false })
        .order('start_time', { ascending: false });

      if (filters.mineOnly) {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) q = q.eq('case_manager_id', u.user.id);
      }
      if (filters.caseManagerId) q = q.eq('case_manager_id', filters.caseManagerId);
      if (filters.studentId) q = q.eq('student_id', filters.studentId);
      if (filters.organizationId) q = q.eq('organization_id', filters.organizationId);
      if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
      if (filters.billable === 'true') q = q.eq('billable', true);
      if (filters.billable === 'false') q = q.eq('billable', false);
      if (filters.startDate) q = q.gte('entry_date', filters.startDate);
      if (filters.endDate) q = q.lte('entry_date', filters.endDate);

      const { data, error } = await q;
      if (error) {
        // Fallback without joins if FK names differ
        const { data: plain, error: e2 } = await supabase
          .from('time_entries')
          .select('*')
          .order('entry_date', { ascending: false });
        if (e2) throw e2;
        return (plain ?? []) as any;
      }
      return (data ?? []) as any;
    },
  });
}

export function useUpdateTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TimeEntry> }) => {
      const { data, error } = await supabase
        .from('time_entries')
        .update(patch as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-entries'] }),
  });
}

export function useReviewTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      review_note,
    }: { id: string; status: 'approved' | 'rejected'; review_note?: string }) => {
      const { data, error } = await supabase
        .from('time_entries')
        .update({ status, review_note: review_note ?? null } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-entries'] }),
  });
}

export function useTimeEntryAudit(entryId: string | null) {
  return useQuery({
    queryKey: ['time-entry-audit', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entry_audit')
        .select('*')
        .eq('time_entry_id', entryId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
