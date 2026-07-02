import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface LifeSkillsTemplate {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  questions: any;
}

export interface LifeSkillsAssignment {
  id: string;
  student_id: string;
  template_id: string;
  next_due_at: string | null;
  last_completed_at: string | null;
  cohort_id?: string | null;
}

export function useLifeSkillsTemplates() {
  return useQuery({
    queryKey: ['lifeskills', 'templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('impact_survey_templates')
        .select('id, slug, title, description, questions')
        .like('slug', 'lifeskills-%')
        .eq('is_active', true)
        .order('slug');
      if (error) throw error;
      return (data || []) as LifeSkillsTemplate[];
    },
  });
}

export function useLifeSkillsTemplate(slug?: string) {
  return useQuery({
    queryKey: ['lifeskills', 'template', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('impact_survey_templates')
        .select('id, slug, title, description, questions')
        .eq('slug', slug!)
        .maybeSingle();
      if (error) throw error;
      return data as LifeSkillsTemplate | null;
    },
    enabled: !!slug,
  });
}

export function useMyLifeSkillsAssignments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['lifeskills', 'my-assignments', user?.id],
    queryFn: async () => {
      // Fetch all assignments for this student joined with template info
      const { data, error } = await supabase
        .from('impact_survey_assignments')
        .select('id, student_id, template_id, next_due_at, last_completed_at, impact_survey_templates!inner(id, slug, title, description)')
        .eq('student_id', user!.id);
      if (error) throw error;
      return (data || []).filter((r: any) => r.impact_survey_templates?.slug?.startsWith('lifeskills-'));
    },
    enabled: !!user,
  });
}

export function useMyLifeSkillsResponses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['lifeskills', 'my-responses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('impact_survey_responses')
        .select('id, template_id, submitted_at, impact_survey_templates!inner(slug)')
        .eq('student_id', user!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

export function useSubmitLifeSkillsResponse() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (args: { template_id: string; template_slug: string; responses: Record<string, any>; score_summary: Record<string, any> }) => {
      const { error } = await supabase.from('impact_survey_responses').insert({
        student_id: user!.id,
        template_id: args.template_id,
        responses: args.responses,
        score_summary: args.score_summary,
      });
      if (error) throw error;

      // Mark assignment complete
      await supabase
        .from('impact_survey_assignments')
        .update({ last_completed_at: new Date().toISOString() })
        .eq('student_id', user!.id)
        .eq('template_id', args.template_id);

      // Mark matching invitations complete
      await supabase
        .from('survey_invitations')
        .update({ completed_at: new Date().toISOString() })
        .eq('student_id', user!.id)
        .eq('survey_type', `lifeskills:${args.template_slug}`)
        .is('completed_at', null);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lifeskills'] });
      qc.invalidateQueries({ queryKey: ['pending-surveys'] });
    },
  });
}

export interface LifeSkillsCompletionStat {
  slug: string;
  assigned: number;
  completed: number;
}

export function useLifeSkillsCompletionStats() {
  return useQuery({
    queryKey: ['lifeskills', 'completion-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('impact_survey_assignments')
        .select('last_completed_at, impact_survey_templates!inner(slug)');
      if (error) throw error;
      const map = new Map<string, LifeSkillsCompletionStat>();
      for (const row of data || []) {
        const slug = (row as any).impact_survey_templates?.slug as string;
        if (!slug?.startsWith('lifeskills-')) continue;
        const cur = map.get(slug) || { slug, assigned: 0, completed: 0 };
        cur.assigned += 1;
        if ((row as any).last_completed_at) cur.completed += 1;
        map.set(slug, cur);
      }
      return Array.from(map.values());
    },
  });
}

export async function sendLifeSkillsSurvey(payload: {
  template_slug: string;
  cohort_id?: string;
  organization_id?: string;
  student_ids?: string[];
  notes?: string;
  skip_already_sent?: boolean;
}) {
  const { data, error } = await supabase.functions.invoke('send-lifeskills-survey', { body: payload });
  if (error) throw error;
  return data as { total: number; assigned: number; invited: number; emailed: number; failed: number; skipped: number; already_sent_skipped?: number };
}
