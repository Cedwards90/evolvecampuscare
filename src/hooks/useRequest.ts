import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupportRequest, RequestUpdate, Profile, RequestStatus } from '@/types/database';

interface RequestWithDetails extends SupportRequest {
  student: Profile | null;
  case_manager: Profile | null;
  updates: (RequestUpdate & { user: Profile | null })[];
}

export function useRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: ['request', requestId],
    queryFn: async (): Promise<RequestWithDetails | null> => {
      if (!requestId) return null;

      // Fetch the request
      const { data: request, error: requestError } = await supabase
        .from('support_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError) throw requestError;
      if (!request) return null;

      // Fetch student profile
      const { data: student } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', request.student_id)
        .single();

      // Fetch case manager profile if assigned
      let caseManager = null;
      if (request.assigned_case_manager_id) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', request.assigned_case_manager_id)
          .single();
        caseManager = data;
      }

      // Fetch all updates for this request
      const { data: updates } = await supabase
        .from('request_updates')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      // Fetch user profiles for updates
      const updatesWithUsers = await Promise.all(
        (updates || []).map(async (update) => {
          const { data: user } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', update.user_id)
            .single();
          return { ...update, user } as RequestUpdate & { user: Profile | null };
        })
      );

      return {
        ...request,
        student: student as Profile | null,
        case_manager: caseManager as Profile | null,
        updates: updatesWithUsers,
      };
    },
    enabled: !!requestId,
  });
}

export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, userId }: { requestId: string; userId: string }) => {
      // Update status to in_progress
      const { error: updateError } = await supabase
        .from('support_requests')
        .update({ status: 'in_progress' as RequestStatus })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Add approval note
      const { error: noteError } = await supabase
        .from('request_updates')
        .insert({
          request_id: requestId,
          user_id: userId,
          previous_status: 'submitted',
          new_status: 'in_progress',
          note: 'Request has been approved and is now being processed.',
          is_internal: false,
        });

      if (noteError) throw noteError;
    },
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}

export function useDenyRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      requestId, 
      userId, 
      reason 
    }: { 
      requestId: string; 
      userId: string; 
      reason: string;
    }) => {
      // Update status to cancelled
      const { error: updateError } = await supabase
        .from('support_requests')
        .update({ status: 'cancelled' as RequestStatus })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Add denial note with reason
      const { error: noteError } = await supabase
        .from('request_updates')
        .insert({
          request_id: requestId,
          user_id: userId,
          previous_status: 'submitted',
          new_status: 'cancelled',
          note: `Request denied: ${reason}`,
          is_internal: false,
        });

      if (noteError) throw noteError;
    },
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}

export function useResolveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, userId }: { requestId: string; userId: string }) => {
      const { error: updateError } = await supabase
        .from('support_requests')
        .update({ 
          status: 'resolved' as RequestStatus,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      const { error: noteError } = await supabase
        .from('request_updates')
        .insert({
          request_id: requestId,
          user_id: userId,
          previous_status: 'in_progress',
          new_status: 'resolved',
          note: 'Request has been resolved.',
          is_internal: false,
        });

      if (noteError) throw noteError;
    },
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}

export function useEscalateRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      requestId, 
      userId, 
      reason 
    }: { 
      requestId: string; 
      userId: string; 
      reason: string;
    }) => {
      const { error: updateError } = await supabase
        .from('support_requests')
        .update({ 
          status: 'escalated' as RequestStatus,
          escalated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      const { error: noteError } = await supabase
        .from('request_updates')
        .insert({
          request_id: requestId,
          user_id: userId,
          previous_status: 'in_progress',
          new_status: 'escalated',
          note: `Request escalated: ${reason}`,
          is_internal: false,
        });

      if (noteError) throw noteError;
    },
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}

export function useAddReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      requestId, 
      userId, 
      message, 
      isInternal 
    }: { 
      requestId: string; 
      userId: string; 
      message: string;
      isInternal: boolean;
    }) => {
      const { error } = await supabase
        .from('request_updates')
        .insert({
          request_id: requestId,
          user_id: userId,
          note: message,
          is_internal: isInternal,
        });

      if (error) throw error;
    },
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
    },
  });
}
