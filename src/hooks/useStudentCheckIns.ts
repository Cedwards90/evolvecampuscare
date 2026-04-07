import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface StudentCheckIn {
  id: string;
  student_id: string;
  mood_rating: number;
  progress_rating: number;
  blockers: string | null;
  wins: string | null;
  additional_notes: string | null;
  created_at: string;
}

export function useStudentCheckIns(studentId?: string) {
  return useQuery({
    queryKey: ['student-checkins', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_checkins')
        .select('*')
        .eq('student_id', studentId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as StudentCheckIn[];
    },
    enabled: !!studentId,
  });
}

export function useLatestCheckIn() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['latest-checkin', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_checkins')
        .select('*')
        .eq('student_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as StudentCheckIn | null;
    },
    enabled: !!user?.id,
  });
}

export function useSubmitCheckIn() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      mood_rating: number;
      progress_rating: number;
      blockers?: string;
      wins?: string;
      additional_notes?: string;
    }) => {
      const { error } = await supabase
        .from('student_checkins')
        .insert({
          student_id: user!.id,
          mood_rating: data.mood_rating,
          progress_rating: data.progress_rating,
          blockers: data.blockers || null,
          wins: data.wins || null,
          additional_notes: data.additional_notes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['latest-checkin'] });
      queryClient.invalidateQueries({ queryKey: ['student-checkins'] });
    },
  });
}
