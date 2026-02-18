import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOffline } from '@/contexts/OfflineContext';
import {
  saveDraftOffline,
  getDraftsOffline,
  deleteDraftOffline,
  generateDraftId,
} from '@/lib/offlineStorage';
import type { RequestCategory, RequestPriority } from '@/types/database';

export interface DraftFormData {
  category: RequestCategory;
  title: string;
  description: string;
  priority: RequestPriority;
  isEmergency: boolean;
}

export interface Draft {
  id: string;
  draft_data: DraftFormData;
  synced: boolean;
  created_at: string;
  updated_at: string;
}

export function useOfflineDrafts() {
  const { user, profile } = useAuth();
  const { isOnline } = useOffline();
  const queryClient = useQueryClient();

  const draftsQuery = useQuery({
    queryKey: ['offline-drafts', user?.id, isOnline],
    queryFn: async (): Promise<Draft[]> => {
      if (!user?.id) return [];

      if (isOnline) {
        const { data, error } = await supabase
          .from('offline_drafts')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        return (data || []).map((d) => ({
          id: d.id,
          draft_data: d.draft_data as unknown as DraftFormData,
          synced: d.synced ?? false,
          created_at: d.created_at,
          updated_at: d.updated_at,
        }));
      }

      // Offline: read from IndexedDB
      const local = await getDraftsOffline();
      return local.map((d) => ({
        id: d.id,
        draft_data: {
          category: d.category as RequestCategory,
          title: d.title,
          description: d.description,
          priority: d.priority as RequestPriority,
          isEmergency: d.is_emergency,
        },
        synced: false,
        created_at: d.created_at,
        updated_at: d.updated_at,
      }));
    },
    enabled: !!user?.id,
  });

  const saveDraftMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: DraftFormData }) => {
      const draftId = id || generateDraftId();
      const now = new Date().toISOString();

      // Always save to IndexedDB first (works offline)
      await saveDraftOffline({
        id: draftId,
        category: data.category,
        priority: data.priority,
        title: data.title,
        description: data.description,
        is_emergency: data.isEmergency,
        created_at: now,
        updated_at: now,
      });

      // If online, also persist to DB
      if (isOnline && user?.id) {
        const row: any = {
          id: draftId,
          user_id: user.id,
          draft_data: data as any,
          synced: false,
          updated_at: now,
        };
        const { error } = await supabase.from('offline_drafts').upsert(row);
        if (error) throw error;
      }

      return draftId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offline-drafts'] });
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      await deleteDraftOffline(draftId);

      if (isOnline && user?.id) {
        const { error } = await supabase
          .from('offline_drafts')
          .delete()
          .eq('id', draftId)
          .eq('user_id', user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offline-drafts'] });
    },
  });

  const syncDraftsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const localDrafts = await getDraftsOffline();
      if (localDrafts.length === 0) return 0;

      for (const d of localDrafts) {
        const row: any = {
          id: d.id,
          user_id: user.id,
          draft_data: {
            category: d.category,
            title: d.title,
            description: d.description,
            priority: d.priority,
            isEmergency: d.is_emergency,
          },
          synced: true,
          updated_at: new Date().toISOString(),
        };
        await supabase.from('offline_drafts').upsert(row);
      }

      return localDrafts.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offline-drafts'] });
    },
  });

  const submitDraftMutation = useMutation({
    mutationFn: async (draft: Draft) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data: assignment } = await supabase
        .from('student_assignments')
        .select('case_manager_id')
        .eq('student_id', user.id)
        .maybeSingle();

      const hasAssignedCM = assignment?.case_manager_id;

      const { data, error } = await supabase
        .from('support_requests')
        .insert({
          student_id: user.id,
          category: draft.draft_data.category,
          title: draft.draft_data.title,
          description: draft.draft_data.description,
          priority: draft.draft_data.priority,
          is_emergency: draft.draft_data.isEmergency,
          status: hasAssignedCM ? 'in_progress' : 'submitted',
          assigned_case_manager_id: hasAssignedCM || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Clean up draft from both stores
      await deleteDraftOffline(draft.id);
      await supabase
        .from('offline_drafts')
        .delete()
        .eq('id', draft.id)
        .eq('user_id', user.id);

      // Fire-and-forget notification
      supabase.functions.invoke('notify-new-request', {
        body: {
          requestId: data.id,
          requestTitle: draft.draft_data.title,
          category: draft.draft_data.category,
          priority: draft.draft_data.priority,
          isEmergency: draft.draft_data.isEmergency,
          studentId: user.id,
          studentName: profile?.full_name || '',
        },
      }).catch(console.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offline-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });

  return {
    drafts: draftsQuery.data ?? [],
    isLoading: draftsQuery.isLoading,
    saveDraft: saveDraftMutation,
    deleteDraft: deleteDraftMutation,
    syncDrafts: syncDraftsMutation,
    submitDraft: submitDraftMutation,
  };
}
