import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CheckInWithStudent {
  id: string;
  student_id: string;
  mood_rating: number;
  progress_rating: number;
  blockers: string | null;
  wins: string | null;
  additional_notes: string | null;
  created_at: string;
  student_name: string | null;
  student_email: string;
  organization_id: string | null;
  organization_name: string | null;
  cohort_id: string | null;
  year_of_study: string | null;
}

export interface PostGradPlanWithStudent {
  id: string;
  student_id: string;
  career_goals: string;
  education_goals: string;
  housing_plan: string;
  financial_plan: string;
  health_wellness: string;
  support_needed: string;
  month_1_3_actions: string;
  month_4_6_actions: string;
  month_7_9_actions: string;
  month_10_12_actions: string;
  graduation_date: string | null;
  additional_notes: string | null;
  created_at: string;
  updated_at: string;
  student_name: string | null;
  student_email: string;
  organization_id: string | null;
  organization_name: string | null;
  cohort_id: string | null;
  year_of_study: string | null;
}

async function loadOrgMap() {
  const { data } = await supabase.from('training_organizations').select('id, name');
  return new Map((data || []).map((o) => [o.id, o.name as string]));
}

export function useAllCheckIns() {
  return useQuery({
    queryKey: ['all-checkins'],
    queryFn: async () => {
      const { data: checkins, error: checkinsError } = await supabase
        .from('student_checkins')
        .select('*')
        .order('created_at', { ascending: false });
      if (checkinsError) throw checkinsError;

      const studentIds = [...new Set(checkins.map(c => c.student_id))];
      const [{ data: profiles }, orgMap] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, full_name, email, organization_id, cohort_id, year_of_study')
          .in('user_id', studentIds),
        loadOrgMap(),
      ]);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return checkins.map(c => {
        const p = profileMap.get(c.student_id);
        return {
          ...c,
          student_name: p?.full_name || null,
          student_email: p?.email || '',
          organization_id: p?.organization_id || null,
          organization_name: p?.organization_id ? orgMap.get(p.organization_id) || null : null,
          cohort_id: (p as any)?.cohort_id || null,
          year_of_study: (p as any)?.year_of_study || null,
        };
      }) as CheckInWithStudent[];
    },
  });
}

export interface PendingStudent {
  student_id: string;
  student_name: string | null;
  student_email: string;
  organization_id: string | null;
  organization_name: string | null;
  cohort_id: string | null;
  year_of_study: string | null;
  last_submitted_at: string | null;
  days_since: number | null;
}

async function loadStudentsWithProfiles() {
  const { data: roles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'student');
  const ids = [...new Set((roles || []).map((r) => r.user_id))];
  if (ids.length === 0) return { students: [] as any[], orgMap: new Map<string, string>() };
  const [{ data: profiles }, orgMap] = await Promise.all([
    supabase
      .from('profiles')
      .select('user_id, full_name, email, organization_id, cohort_id, year_of_study')
      .in('user_id', ids),
    loadOrgMap(),
  ]);
  return { students: profiles || [], orgMap };
}

const CHECKIN_WINDOW_DAYS = 21;

export function usePendingCheckIns() {
  return useQuery({
    queryKey: ['pending-checkins'],
    queryFn: async () => {
      const { students, orgMap } = await loadStudentsWithProfiles();
      const studentIds = students.map((s: any) => s.user_id);
      if (studentIds.length === 0) return [] as PendingStudent[];

      const { data: checkins } = await supabase
        .from('student_checkins')
        .select('student_id, created_at')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false });

      const latest = new Map<string, string>();
      (checkins || []).forEach((c) => {
        if (!latest.has(c.student_id)) latest.set(c.student_id, c.created_at);
      });

      const cutoff = Date.now() - CHECKIN_WINDOW_DAYS * 86400000;
      const pending: PendingStudent[] = [];
      for (const s of students as any[]) {
        const last = latest.get(s.user_id) || null;
        const lastTs = last ? new Date(last).getTime() : null;
        if (lastTs !== null && lastTs >= cutoff) continue;
        pending.push({
          student_id: s.user_id,
          student_name: s.full_name || null,
          student_email: s.email || '',
          organization_id: s.organization_id || null,
          organization_name: s.organization_id ? orgMap.get(s.organization_id) || null : null,
          cohort_id: s.cohort_id || null,
          year_of_study: s.year_of_study || null,
          last_submitted_at: last,
          days_since: lastTs ? Math.floor((Date.now() - lastTs) / 86400000) : null,
        });
      }
      return pending;
    },
  });
}

export function usePendingPostGradPlans() {
  return useQuery({
    queryKey: ['pending-postgrad-plans'],
    queryFn: async () => {
      const { students, orgMap } = await loadStudentsWithProfiles();
      const studentIds = students.map((s: any) => s.user_id);
      if (studentIds.length === 0) return [] as PendingStudent[];

      const { data: plans } = await supabase
        .from('post_graduation_plans')
        .select('student_id')
        .in('student_id', studentIds);

      const has = new Set((plans || []).map((p) => p.student_id));
      return (students as any[])
        .filter((s) => !has.has(s.user_id))
        .map((s) => ({
          student_id: s.user_id,
          student_name: s.full_name || null,
          student_email: s.email || '',
          organization_id: s.organization_id || null,
          organization_name: s.organization_id ? orgMap.get(s.organization_id) || null : null,
          last_submitted_at: null,
          days_since: null,
        })) as PendingStudent[];
    },
  });
}

export function useAllPostGradPlans() {
  return useQuery({
    queryKey: ['all-postgrad-plans'],
    queryFn: async () => {
      const { data: plans, error } = await supabase
        .from('post_graduation_plans')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const studentIds = [...new Set(plans.map(p => p.student_id))];
      const [{ data: profiles }, orgMap] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, full_name, email, organization_id')
          .in('user_id', studentIds),
        loadOrgMap(),
      ]);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return plans.map(p => {
        const prof = profileMap.get(p.student_id);
        return {
          ...p,
          student_name: prof?.full_name || null,
          student_email: prof?.email || '',
          organization_id: prof?.organization_id || null,
          organization_name: prof?.organization_id ? orgMap.get(prof.organization_id) || null : null,
        };
      }) as PostGradPlanWithStudent[];
    },
  });
}
