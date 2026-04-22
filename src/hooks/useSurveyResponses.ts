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
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', studentIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return checkins.map(c => ({
        ...c,
        student_name: profileMap.get(c.student_id)?.full_name || null,
        student_email: profileMap.get(c.student_id)?.email || '',
      })) as CheckInWithStudent[];
    },
  });
}

export interface PendingInvitation {
  id: string;
  student_id: string;
  survey_type: string;
  sent_by: string;
  notes: string | null;
  created_at: string;
  email_status: string | null;
  email_sent_at: string | null;
  email_error: string | null;
  student_name: string | null;
  student_email: string;
  sender_name: string | null;
}

export interface RecentlySentInvitation {
  id: string;
  student_id: string;
  survey_type: string;
  sent_by: string;
  created_at: string;
  completed_at: string | null;
  email_status: string | null;
  student_name: string | null;
  student_email: string;
  sender_name: string | null;
}

export function usePendingInvitations() {
  return useQuery({
    queryKey: ['pending-invitations-all'],
    queryFn: async () => {
      const { data: invites, error } = await supabase
        .from('survey_invitations')
        .select('*')
        .is('completed_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const studentIds = [...new Set(invites.map(i => i.student_id))];

      const [{ data: checkins }, { data: plans }, { data: profiles }] = await Promise.all([
        supabase
          .from('student_checkins')
          .select('student_id, created_at')
          .in('student_id', studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000']),
        supabase
          .from('post_graduation_plans')
          .select('student_id, created_at')
          .in('student_id', studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000']),
        supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', [...new Set([...invites.map(i => i.student_id), ...invites.map(i => i.sent_by)])]),
      ]);

      // Group submissions per student for quick lookup
      const checkinsByStudent = new Map<string, string[]>();
      checkins?.forEach(c => {
        const arr = checkinsByStudent.get(c.student_id) || [];
        arr.push(c.created_at);
        checkinsByStudent.set(c.student_id, arr);
      });
      const plansByStudent = new Map<string, string[]>();
      plans?.forEach(p => {
        const arr = plansByStudent.get(p.student_id) || [];
        arr.push(p.created_at);
        plansByStudent.set(p.student_id, arr);
      });

      const ONE_HOUR_MS = 60 * 60 * 1000;

      // Find invites that have a matching submission within grace window
      const toAutoHeal: { id: string; completed_at: string }[] = [];
      const trulyPending = invites.filter(inv => {
        const submissions = inv.survey_type === 'checkin'
          ? checkinsByStudent.get(inv.student_id)
          : inv.survey_type === 'post_graduation_plan'
          ? plansByStudent.get(inv.student_id)
          : undefined;

        if (!submissions?.length) return true;

        const inviteTime = new Date(inv.created_at).getTime();
        const match = submissions.find(s => new Date(s).getTime() >= inviteTime - ONE_HOUR_MS);

        if (match) {
          toAutoHeal.push({ id: inv.id, completed_at: match });
          return false;
        }
        return true;
      });

      // Fire-and-forget auto-heal
      if (toAutoHeal.length > 0) {
        Promise.all(
          toAutoHeal.map(h =>
            supabase
              .from('survey_invitations')
              .update({ completed_at: h.completed_at })
              .eq('id', h.id)
          )
        ).catch(err => console.warn('Auto-heal survey_invitations failed:', err));
      }

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return trulyPending.map(i => ({
        ...i,
        student_name: profileMap.get(i.student_id)?.full_name || null,
        student_email: profileMap.get(i.student_id)?.email || '',
        sender_name: profileMap.get(i.sent_by)?.full_name || profileMap.get(i.sent_by)?.email || null,
      })) as PendingInvitation[];
    },
  });
}

export function useRecentlySentInvitations() {
  return useQuery({
    queryKey: ['recently-sent-invitations'],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: invites, error } = await supabase
        .from('survey_invitations')
        .select('*')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!invites?.length) return [] as RecentlySentInvitation[];

      const userIds = [...new Set([...invites.map(i => i.student_id), ...invites.map(i => i.sent_by)])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return invites.map(i => ({
        ...i,
        student_name: profileMap.get(i.student_id)?.full_name || null,
        student_email: profileMap.get(i.student_id)?.email || '',
        sender_name: profileMap.get(i.sent_by)?.full_name || profileMap.get(i.sent_by)?.email || null,
      })) as RecentlySentInvitation[];
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
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', studentIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return plans.map(p => ({
        ...p,
        student_name: profileMap.get(p.student_id)?.full_name || null,
        student_email: profileMap.get(p.student_id)?.email || '',
      })) as PostGradPlanWithStudent[];
    },
  });
}
