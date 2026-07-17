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

async function sendStatusChangeNotification(params: {
  requestId: string;
  studentId: string;
  requestTitle: string;
  previousStatus: string;
  newStatus: string;
  note?: string;
}) {
  try {
    await supabase.functions.invoke('notify-status-change', {
      body: params,
    });
  } catch (error) {
    console.error('Failed to send status change notification:', error);
  }
}

async function createInAppNotification(params: {
  userId: string;
  title: string;
  message: string;
  type: string;
  link: string;
}) {
  try {
    await supabase.from('notifications').insert({
      user_id: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      link: params.link,
    });
  } catch (error) {
    console.error('Failed to create in-app notification:', error);
  }
}

export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      requestId, 
      userId,
      approvedAmount 
    }: { 
      requestId: string; 
      userId: string;
      approvedAmount?: number;
    }) => {
      // Fetch request details first
      const { data: requestData } = await supabase
        .from('support_requests')
        .select('student_id, title, requested_amount, status, category')
        .eq('id', requestId)
        .single();

      const previousStatus = requestData?.status || 'submitted';
      const isAlreadyInProgress = previousStatus === 'in_progress';
      const isFinancial = requestData?.category === 'financial';

      // Compute approval_status when we have a monetary decision
      let approvalStatus: 'approved' | 'partially_approved' | null = null;
      if (isFinancial && approvedAmount !== undefined && requestData?.requested_amount) {
        approvalStatus = approvedAmount >= requestData.requested_amount ? 'approved' : 'partially_approved';
      } else if (isFinancial && approvedAmount !== undefined) {
        approvalStatus = 'approved';
      }

      const baseUpdate: {
        status?: RequestStatus;
        approved_amount?: number;
        approval_status?: string;
        approval_decided_at?: string;
        approval_decided_by?: string;
      } = {};

      if (!isAlreadyInProgress) baseUpdate.status = 'in_progress' as RequestStatus;
      if (approvedAmount !== undefined) baseUpdate.approved_amount = approvedAmount;
      if (approvalStatus) {
        baseUpdate.approval_status = approvalStatus;
        baseUpdate.approval_decided_at = new Date().toISOString();
        baseUpdate.approval_decided_by = userId;
      }

      if (Object.keys(baseUpdate).length > 0) {
        const { error: updateError } = await supabase
          .from('support_requests')
          .update(baseUpdate)
          .eq('id', requestId);
        if (updateError) throw updateError;
      }

      // Build approval note
      let note = isAlreadyInProgress 
        ? 'Request has been confirmed and is being actively processed.'
        : 'Request has been approved and is now being processed.';
      
      if (approvedAmount !== undefined && requestData?.requested_amount) {
        const formattedRequested = requestData.requested_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        const formattedApproved = approvedAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        if (approvedAmount >= requestData.requested_amount) {
          note = `Request ${isAlreadyInProgress ? 'confirmed' : 'approved'} for the full amount of ${formattedApproved}.`;
        } else {
          note = `Request ${isAlreadyInProgress ? 'confirmed' : 'partially approved'} for ${formattedApproved} (requested: ${formattedRequested}).`;
        }
      } else if (approvedAmount !== undefined) {
        const formattedApproved = approvedAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        note = `Request ${isAlreadyInProgress ? 'confirmed' : 'approved'} for ${formattedApproved}.`;
      }

      // Add approval note
      const { error: noteError } = await supabase
        .from('request_updates')
        .insert({
          request_id: requestId,
          user_id: userId,
          previous_status: previousStatus,
          new_status: 'in_progress',
          note,
          is_internal: false,
        });

      if (noteError) throw noteError;

      // Send email notification to student
      if (requestData) {
        sendStatusChangeNotification({
          requestId,
          studentId: requestData.student_id,
          requestTitle: requestData.title,
          previousStatus,
          newStatus: 'in_progress',
        });

        // Create in-app notification for student
        createInAppNotification({
          userId: requestData.student_id,
          title: isAlreadyInProgress ? '✅ Request Confirmed' : '✅ Request Approved',
          message: `Your request "${requestData.title}" has been ${isAlreadyInProgress ? 'confirmed' : 'approved'} and is being processed.`,
          type: 'status_update',
          link: `/requests/${requestId}`,
        });
      }
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
      // Fetch request details first
      const { data: requestData } = await supabase
        .from('support_requests')
        .select('student_id, title, status')
        .eq('id', requestId)
        .single();

      const previousStatus = requestData?.status || 'submitted';

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
          previous_status: previousStatus,
          new_status: 'cancelled',
          note: `Request denied: ${reason}`,
          is_internal: false,
        });

      if (noteError) throw noteError;

      // Send email notification to student
      if (requestData) {
        sendStatusChangeNotification({
          requestId,
          studentId: requestData.student_id,
          requestTitle: requestData.title,
          previousStatus,
          newStatus: 'cancelled',
          note: reason,
        });

        // Create in-app notification for student
        createInAppNotification({
          userId: requestData.student_id,
          title: '❌ Request Denied',
          message: `Your request "${requestData.title}" has been denied. Reason: ${reason}`,
          type: 'status_update',
          link: `/requests/${requestId}`,
        });
      }
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
      // Fetch request details first
      const { data: requestData } = await supabase
        .from('support_requests')
        .select('student_id, title, status')
        .eq('id', requestId)
        .single();

      const { error: updateError } = await supabase
        .from('support_requests')
        .update({ 
          status: 'resolved' as RequestStatus,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      const previousStatus = requestData?.status || 'in_progress';

      const { error: noteError } = await supabase
        .from('request_updates')
        .insert({
          request_id: requestId,
          user_id: userId,
          previous_status: previousStatus,
          new_status: 'resolved',
          note: 'Request has been resolved.',
          is_internal: false,
        });

      if (noteError) throw noteError;

      // Send email notification to student
      if (requestData) {
        sendStatusChangeNotification({
          requestId,
          studentId: requestData.student_id,
          requestTitle: requestData.title,
          previousStatus,
          newStatus: 'resolved',
        });

        // Create in-app notification for student
        createInAppNotification({
          userId: requestData.student_id,
          title: '🎉 Request Resolved',
          message: `Your request "${requestData.title}" has been resolved.`,
          type: 'status_update',
          link: `/requests/${requestId}`,
        });
      }
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
      // Fetch request details first
      const { data: requestData } = await supabase
        .from('support_requests')
        .select('student_id, title')
        .eq('id', requestId)
        .single();

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

      // Send email notification to student
      if (requestData) {
        sendStatusChangeNotification({
          requestId,
          studentId: requestData.student_id,
          requestTitle: requestData.title,
          previousStatus: 'in_progress',
          newStatus: 'escalated',
          note: reason,
        });

        // Create in-app notification for student
        createInAppNotification({
          userId: requestData.student_id,
          title: '⚠️ Request Escalated',
          message: `Your request "${requestData.title}" has been escalated for further review.`,
          type: 'status_update',
          link: `/requests/${requestId}`,
        });
      }
    },
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}

export function useEditRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      userId,
      changes,
      original,
    }: {
      requestId: string;
      userId: string;
      changes: {
        title?: string;
        description?: string;
        category?: string;
        priority?: string;
        requested_amount?: number | null;
      };
      original: {
        title: string;
        description: string;
        category: string;
        priority: string;
        requested_amount?: number | null;
        student_id: string;
      };
    }) => {
      // Build update payload with only changed fields
      const updatePayload: {
        title?: string;
        description?: string;
        category?: 'academic' | 'financial' | 'housing' | 'mental_health' | 'other';
        priority?: 'low' | 'medium' | 'high' | 'emergency';
        requested_amount?: number | null;
      } = {};
      const changeNotes: string[] = [];

      if (changes.title && changes.title !== original.title) {
        updatePayload.title = changes.title;
        changeNotes.push('title updated');
      }
      if (changes.description && changes.description !== original.description) {
        updatePayload.description = changes.description;
        changeNotes.push('description updated');
      }
      if (changes.category && changes.category !== original.category) {
        updatePayload.category = changes.category as typeof updatePayload.category;
        changeNotes.push(`category changed from ${original.category} to ${changes.category}`);
      }
      if (changes.priority && changes.priority !== original.priority) {
        updatePayload.priority = changes.priority as typeof updatePayload.priority;
        changeNotes.push(`priority changed from ${original.priority} to ${changes.priority}`);
      }
      if (changes.requested_amount !== undefined && changes.requested_amount !== original.requested_amount) {
        updatePayload.requested_amount = changes.requested_amount;
        const oldAmt = original.requested_amount
          ? `$${original.requested_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          : 'none';
        const newAmt = changes.requested_amount !== null
          ? `$${changes.requested_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          : 'none';
        changeNotes.push(`amount changed from ${oldAmt} to ${newAmt}`);
      }

      if (Object.keys(updatePayload).length === 0) {
        throw new Error('No changes were made.');
      }

      const { error: updateError } = await supabase
        .from('support_requests')
        .update(updatePayload)
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Log the edit in request_updates
      const note = `Request modified: ${changeNotes.join(', ')}.`;
      const { error: noteError } = await supabase
        .from('request_updates')
        .insert({
          request_id: requestId,
          user_id: userId,
          note,
          is_internal: false,
        });

      if (noteError) throw noteError;

      // In-app notification for the student
      createInAppNotification({
        userId: original.student_id,
        title: '✏️ Request Modified',
        message: `Your request has been updated by staff: ${changeNotes.join(', ')}.`,
        type: 'status_update',
        link: `/requests/${requestId}`,
      });
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
