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
  case_manager_name?: string | null;
  case_manager_email?: string | null;
  student_name?: string | null;
  student_email?: string | null;
  organization_name?: string | null;
}

export function useTimeEntries(filters: TimeEntryFilters = {}) {
  return useQuery({
    queryKey: ['time-entries', filters],
    queryFn: async (): Promise<TimeEntry[]> => {
      let q = supabase
        .from('time_entries')
        .select('*')
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
      if (error) throw error;
      const entries = (data ?? []) as any[];

      // Enrich
      const userIds = Array.from(
        new Set(
          entries.flatMap((e) => [e.case_manager_id, e.student_id]).filter(Boolean),
        ),
      ) as string[];
      const orgIds = Array.from(
        new Set(entries.map((e) => e.organization_id).filter(Boolean)),
      ) as string[];

      const [profilesRes, orgsRes] = await Promise.all([
        userIds.length
          ? supabase
              .from('profiles')
              .select('user_id, full_name, email')
              .in('user_id', userIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        orgIds.length
          ? supabase
              .from('training_organizations')
              .select('id, name')
              .in('id', orgIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);
      const profileMap = new Map(
        (profilesRes.data ?? []).map((p: any) => [p.user_id, p]),
      );
      const orgMap = new Map((orgsRes.data ?? []).map((o: any) => [o.id, o]));

      return entries.map((e) => {
        const cm = profileMap.get(e.case_manager_id);
        const st = e.student_id ? profileMap.get(e.student_id) : null;
        const org = e.organization_id ? orgMap.get(e.organization_id) : null;
        return {
          ...e,
          case_manager_name: cm?.full_name ?? null,
          case_manager_email: cm?.email ?? null,
          student_name: st?.full_name ?? null,
          student_email: st?.email ?? null,
          organization_name: org?.name ?? null,
        } as TimeEntry;
      });
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
