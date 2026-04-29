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
