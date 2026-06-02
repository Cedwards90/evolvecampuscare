import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface IntakeSection {
  section: string;
  responses: Record<string, any>;
}

export function useIntakeSurvey() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: studentFile, isLoading: fileLoading } = useQuery({
    queryKey: ['student-file', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_files')
        .select('*')
        .eq('student_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: responses = [], isLoading: responsesLoading } = useQuery({
    queryKey: ['intake-responses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intake_responses')
        .select('*')
        .eq('student_id', user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const saveSection = useMutation({
    mutationFn: async ({ section, responses }: IntakeSection) => {
      const { error } = await supabase
        .from('intake_responses')
        .insert({
          student_id: user!.id,
          section,
          responses,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intake-responses', user?.id] });
    },
  });

  const updateSection = useMutation({
    mutationFn: async ({ id, responses }: { id: string; responses: Record<string, any> }) => {
      const { error } = await supabase
        .from('intake_responses')
        .update({ responses })
        .eq('id', id)
        .eq('student_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intake-responses', user?.id] });
    },
  });

  const completeIntake = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('student_files')
        .update({ intake_completed_at: new Date().toISOString() })
        .eq('student_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-file', user?.id] });
    },
  });

  return {
    studentFile,
    responses,
    isLoading: fileLoading || responsesLoading,
    intakeCompleted: !!studentFile?.intake_completed_at,
    saveSection,
    updateSection,
    completeIntake,
  };
}
