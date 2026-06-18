import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/types/database';

export type TimeEntryStatus = 'pending' | 'approved' | 'rejected';
export type ServiceType =
  | 'direct_service'
  | 'case_management'
  | 'documentation'
  | 'meeting'
  | 'outreach'
  | 'travel'
  | 'other';

export interface TimeEntry {
  id: string;
  case_manager_id: string;
  student_id: string | null;
  organization_id: string | null;
  entry_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  service_type: ServiceType;
  notes: string | null;
  billable: boolean;
  status: TimeEntryStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  case_manager?: Pick<Profile, 'user_id' | 'full_name' | 'email'> | null;
  student?: Pick<Profile, 'user_id' | 'full_name' | 'email'> | null;
}

export interface TimeEntryFilters {
  caseManagerIds?: string[];
  studentIds?: string[];
  organizationIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  status?: TimeEntryStatus[];
  billable?: boolean | null;
}

export function useTimeEntries(filters: TimeEntryFilters = {}) {
  return useQuery({
    queryKey: ['time-entries', filters],
    queryFn: async (): Promise<TimeEntry[]> => {
      let q = supabase
        .from('time_entries' as any)
        .select('*')
        .order('entry_date', { ascending: false })
        .order('start_time', { ascending: false });

      if (filters.caseManagerIds?.length) q = q.in('case_manager_id', filters.caseManagerIds);
      if (filters.studentIds?.length) q = q.in('student_id', filters.studentIds);
      if (filters.organizationIds?.length) q = q.in('organization_id', filters.organizationIds);
      if (filters.dateFrom) q = q.gte('entry_date', filters.dateFrom);
      if (filters.dateTo) q = q.lte('entry_date', filters.dateTo);
      if (filters.status?.length) q = q.in('status', filters.status);
      if (filters.billable !== undefined && filters.billable !== null) q = q.eq('billable', filters.billable);

      const { data, error } = await q;
      if (error) throw error;

      const entries = (data ?? []) as unknown as TimeEntry[];
      const userIds = Array.from(
        new Set(
          entries.flatMap((e) => [e.case_manager_id, e.student_id].filter(Boolean) as string[]),
        ),
      );

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        const map = new Map((profiles ?? []).map((p) => [p.user_id, p]));
        for (const e of entries) {
          e.case_manager = (map.get(e.case_manager_id) as any) ?? null;
          e.student = e.student_id ? ((map.get(e.student_id) as any) ?? null) : null;
        }
      }
      return entries;
    },
  });
}

export function totalMinutes(entries: TimeEntry[]) {
  return entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
}

export function formatHours(minutes: number) {
  return (minutes / 60).toFixed(2);
}
