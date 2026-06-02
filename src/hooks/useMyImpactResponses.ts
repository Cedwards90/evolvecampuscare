import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ImpactTemplate {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  questions: any[];
}

export interface ImpactResponseRow {
  id: string;
  student_id: string;
  template_id: string;
  responses: Record<string, any>;
  score_summary: Record<string, any>;
  submitted_at: string;
  template?: ImpactTemplate | null;
}

export function useMyImpactResponses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-impact-responses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('impact_survey_responses')
        .select('*, template:impact_survey_templates(id, slug, title, description, questions)')
        .eq('student_id', user!.id)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ImpactResponseRow[];
    },
    enabled: !!user?.id,
  });
}

export function useStudentImpactResponses(studentId?: string) {
  return useQuery({
    queryKey: ['student-impact-responses', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('impact_survey_responses')
        .select('*, template:impact_survey_templates(id, slug, title, description, questions)')
        .eq('student_id', studentId!)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ImpactResponseRow[];
    },
    enabled: !!studentId,
  });
}

export function useUpdateImpactResponse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, responses }: { id: string; responses: Record<string, any> }) => {
      const { error } = await supabase
        .from('impact_survey_responses')
        .update({ responses, submitted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-impact-responses'] });
      queryClient.invalidateQueries({ queryKey: ['student-impact-responses'] });
    },
  });
}

export function useDeleteImpactResponse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('impact_survey_responses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-impact-responses'] });
      queryClient.invalidateQueries({ queryKey: ['student-impact-responses'] });
    },
  });
}
