import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PersonalityProfile = {
  id: string;
  student_id: string;
  type_code: string | null;
  type_name: string | null;
  energy_pct: number | null;
  energy_label: string | null;
  mind_pct: number | null;
  mind_label: string | null;
  nature_pct: number | null;
  nature_label: string | null;
  tactics_pct: number | null;
  tactics_label: string | null;
  identity_pct: number | null;
  identity_label: string | null;
  strengths: string[];
  weaknesses: string[];
  summary: string | null;
  assessment_source: string | null;
  assessment_url: string | null;
  assessed_on: string | null;
  attachment_path: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonalityInput = Partial<Omit<PersonalityProfile, 'id' | 'student_id' | 'created_at' | 'updated_at'>>;

export function useStudentPersonality(studentId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['personality-profile', studentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('student_personality_profiles')
        .select('*')
        .eq('student_id', studentId!)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as PersonalityProfile | null;
    },
    enabled: !!studentId,
  });

  const upsert = useMutation({
    mutationFn: async (input: PersonalityInput) => {
      const payload = { student_id: studentId!, created_by: user?.id ?? null, ...input };
      const { error } = await (supabase as any)
        .from('student_personality_profiles')
        .upsert(payload, { onConflict: 'student_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personality-profile', studentId] }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('student_personality_profiles' as any)
        .delete()
        .eq('student_id', studentId!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personality-profile', studentId] }),
  });

  return { profile: query.data, isLoading: query.isLoading, upsert, remove };
}
