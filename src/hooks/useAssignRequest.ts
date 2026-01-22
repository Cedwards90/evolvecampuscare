import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AssignRequestParams {
  requestId: string;
  caseManagerId: string | null;
  userId: string;
}

interface BulkAssignParams {
  requestIds: string[];
  caseManagerId: string;
  userId: string;
}

export function useAssignRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ requestId, caseManagerId, userId }: AssignRequestParams) => {
      // Update the request's assigned case manager
      const { error: updateError } = await supabase
        .from('support_requests')
        .update({ 
          assigned_case_manager_id: caseManagerId,
          status: caseManagerId ? 'in_progress' : 'submitted'
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Log the assignment in request_updates
      const { error: noteError } = await supabase
        .from('request_updates')
        .insert({
          request_id: requestId,
          user_id: userId,
          note: caseManagerId 
            ? 'Request has been assigned to a case manager.' 
            : 'Request has been unassigned.',
          is_internal: true,
          new_status: caseManagerId ? 'in_progress' : 'submitted',
        });

      if (noteError) throw noteError;

      return { requestId, caseManagerId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['request', variables.requestId] });
      queryClient.invalidateQueries({ queryKey: ['case-managers'] });
      queryClient.invalidateQueries({ queryKey: ['case-manager-stats'] });
      
      toast({
        title: variables.caseManagerId ? 'Request Assigned' : 'Request Unassigned',
        description: variables.caseManagerId 
          ? 'The request has been assigned to a case manager.'
          : 'The request has been unassigned.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign request',
        variant: 'destructive',
      });
    },
  });
}

export function useBulkAssignRequests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ requestIds, caseManagerId, userId }: BulkAssignParams) => {
      // Update all requests
      const { error } = await supabase
        .from('support_requests')
        .update({ 
          assigned_case_manager_id: caseManagerId,
          status: 'in_progress'
        })
        .in('id', requestIds);

      if (error) throw error;

      // Log bulk assignment for each request
      const updates = requestIds.map(requestId => ({
        request_id: requestId,
        user_id: userId,
        note: 'Request assigned via bulk assignment.',
        is_internal: true,
        new_status: 'in_progress' as const,
      }));

      const { error: noteError } = await supabase
        .from('request_updates')
        .insert(updates);

      if (noteError) throw noteError;

      return { requestIds, caseManagerId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['case-managers'] });
      queryClient.invalidateQueries({ queryKey: ['case-manager-stats'] });
      
      toast({
        title: 'Requests Assigned',
        description: `${data.requestIds.length} request(s) have been assigned.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign requests',
        variant: 'destructive',
      });
    },
  });
}
