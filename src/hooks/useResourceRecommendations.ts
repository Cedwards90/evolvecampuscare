import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CommunityResource } from './useCommunityResources';

export interface ResourceRecommendation {
  id: string;
  student_id: string;
  resource_id: string;
  source: 'intake' | 'request' | 'manual';
  request_id: string | null;
  reason: string | null;
  dismissed_at: string | null;
  clicked_at: string | null;
  created_at: string;
  resource?: CommunityResource;
}

export function useResourceRecommendations(studentId?: string, opts?: { includeDismissed?: boolean }) {
  return useQuery({
    queryKey: ['resource_recommendations', studentId, !!opts?.includeDismissed],
    enabled: !!studentId,
    queryFn: async () => {
      let q = supabase
        .from('resource_recommendations')
        .select('*, resource:community_resources(*)')
        .eq('student_id', studentId!)
        .order('created_at', { ascending: false });
      if (!opts?.includeDismissed) q = q.is('dismissed_at', null);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ResourceRecommendation[];
    },
  });
}

export function useGenerateRecommendations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { studentId: string; source: 'intake' | 'request'; requestId?: string }) => {
      const { data, error } = await supabase.functions.invoke('recommend-resources', {
        body: {
          student_id: payload.studentId,
          source: payload.source,
          request_id: payload.requestId ?? null,
        },
      });
      if (error) throw error;
      return data as { recommendations: ResourceRecommendation[]; degraded?: boolean; message?: string };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['resource_recommendations', vars.studentId] });
    },
  });
}

export function useDismissRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('resource_recommendations')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resource_recommendations'] }),
  });
}

export function useMarkRecommendationClicked() {
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from('resource_recommendations')
        .update({ clicked_at: new Date().toISOString() })
        .eq('id', id);
    },
  });
}
