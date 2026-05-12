import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SummaryBullet { text: string; evidence_ids: string[] }
export interface SummarySection { bullets: SummaryBullet[] }
export interface FolderSummary {
  sections: Record<string, SummarySection>;
  evidence_counts: Record<string, number>;
  section_counts?: Record<string, number>;
  generated_at: string;
  model: string | null;
}

export const SECTION_LABELS: Record<string, string> = {
  key_updates: 'Key updates',
  completed_items: 'Completed items',
  missing_documents: 'Missing documents',
  risks_red_flags: 'Risks & red flags',
  areas_of_improvement: 'Areas of improvement',
  achievements: 'Achievements',
  recommended_next_steps: 'Recommended next steps',
};

export function useFolderSummary(studentId: string | undefined) {
  return useMutation({
    mutationFn: async (): Promise<FolderSummary> => {
      if (!studentId) throw new Error('Missing studentId');
      const { data, error } = await supabase.functions.invoke('generate-folder-summary', {
        body: { studentId },
      });
      if (error) throw new Error(error.message || 'Failed to generate summary');
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as FolderSummary;
    },
  });
}

export function useFolderSummaryAudit(studentId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['folder_summary_audit', studentId],
    queryFn: async () => {
      if (!studentId) return [] as any[];
      const { data, error } = await supabase
        .from('folder_summary_audit')
        .select('id, action, created_at, actor_id')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId,
  });

  const logDownload = async () => {
    if (!studentId) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return;
    await supabase.from('folder_summary_audit').insert({
      student_id: studentId,
      actor_id: u.user.id,
      action: 'downloaded_pdf',
      section_counts: {},
      evidence_counts: {},
    });
    qc.invalidateQueries({ queryKey: ['folder_summary_audit', studentId] });
  };

  return { ...query, logDownload };
}
