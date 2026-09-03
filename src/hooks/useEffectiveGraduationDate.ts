import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EffectiveGraduation {
  /** ISO date (yyyy-mm-dd) or null when neither the student nor their cohort has one. */
  date: string | null;
  source: 'student' | 'cohort' | null;
}

/**
 * Resolves a participant's effective graduation date: the student-level override on
 * their profile takes precedence, otherwise the cohort's graduation date.
 * Read-only; relies on existing RLS.
 */
export function useEffectiveGraduationDate(studentId: string | undefined) {
  return useQuery({
    queryKey: ['effective-graduation-date', studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<EffectiveGraduation> => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('graduation_date, cohort_id')
        .eq('user_id', studentId!)
        .maybeSingle();
      if (error) throw error;

      if (profile?.graduation_date) {
        return { date: profile.graduation_date as string, source: 'student' };
      }

      if (profile?.cohort_id) {
        const { data: cohort } = await supabase
          .from('cohorts')
          .select('graduated_at')
          .eq('id', profile.cohort_id)
          .maybeSingle();
        const graduatedAt = (cohort as { graduated_at?: string | null } | null)?.graduated_at;
        if (graduatedAt) return { date: graduatedAt, source: 'cohort' };
      }

      return { date: null, source: null };
    },
  });
}
