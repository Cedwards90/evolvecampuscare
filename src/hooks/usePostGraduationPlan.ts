import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PostGraduationPlanInput {
  graduation_date?: string | null;
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
  additional_notes?: string;
}

export function useMyPlans() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['post-graduation-plans', 'my', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_graduation_plans')
        .select('*')
        .eq('student_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

export function useStudentPlans(studentId: string | undefined) {
  return useQuery({
    queryKey: ['post-graduation-plans', 'student', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_graduation_plans')
        .select('*')
        .eq('student_id', studentId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
  });
}

export function useSubmitPlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (plan: PostGraduationPlanInput) => {
      const { error } = await supabase
        .from('post_graduation_plans')
        .insert({
          student_id: user!.id,
          ...plan,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-graduation-plans'] });
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PostGraduationPlanInput> }) => {
      const { error } = await supabase
        .from('post_graduation_plans')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-graduation-plans'] });
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('post_graduation_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-graduation-plans'] });
    },
  });
}
