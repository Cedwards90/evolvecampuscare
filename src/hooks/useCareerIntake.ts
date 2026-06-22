import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type CareerIntake = {
  id: string;
  student_id: string;
  student_status: string | null;
  educational_goal: string | null;
  referral_sources: string[];
  assistance_areas: string[];
  obstacles: string[];
  current_major: string | null;
  accomplishment_goal: string | null;
  career_influences: string | null;
  dream_career: string | null;
  considered_majors: string | null;
  favorite_subjects: string | null;
  least_favorite_subjects: string | null;
  strengths_skills: string | null;
  work_experience: string | null;
  prior_assessments: string | null;
  has_computer_access: boolean | null;
  internet_skill_level: string | null;
  availability: Record<string, string[]>;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CareerIntakeInput = Partial<Omit<CareerIntake, 'id' | 'student_id' | 'created_at' | 'updated_at'>>;

export function useCareerIntake(studentId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['career-intake', studentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('career_intake_responses')
        .select('*')
        .eq('student_id', studentId!)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as CareerIntake | null;
    },
    enabled: !!studentId,
  });

  const upsert = useMutation({
    mutationFn: async (input: CareerIntakeInput) => {
      const payload = { student_id: studentId!, created_by: user?.id ?? null, ...input };
      const { error } = await (supabase as any)
        .from('career_intake_responses')
        .upsert(payload, { onConflict: 'student_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['career-intake', studentId] }),
  });

  return { intake: query.data, isLoading: query.isLoading, upsert };
}
