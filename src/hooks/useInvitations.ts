import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AppRole } from '@/types/database';

export interface Invitation {
  id: string;
  email: string;
  invited_role: AppRole;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  auto_assign_case_manager: string | null;
  notes: string | null;
  created_at: string;
  organization_id?: string | null;
}

export function useInvitations() {
  return useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Invitation[];
    },
  });
}

export function usePendingInvitations() {
  return useQuery({
    queryKey: ['invitations', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Invitation[];
    },
  });
}

interface SendInvitationParams {
  email: string;
  role: AppRole;
  notes?: string;
  autoAssignCaseManager?: string;
  organizationId?: string;
}

export interface InvitationResult {
  invitation: Invitation;
  inviteUrl: string;
  emailSent: boolean;
}

export function useSendInvitation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: SendInvitationParams): Promise<InvitationResult> => {
      // Call edge function to generate secure token and create invitation
      const { data: tokenResponse, error: tokenError } = await supabase.functions.invoke('generate-invitation-token', {
        body: {
          email: params.email,
          role: params.role,
          notes: params.notes,
          autoAssignCaseManager: params.autoAssignCaseManager,
          organizationId: params.organizationId,
        },
      });

      if (tokenError) {
        console.error('Token generation error:', tokenError);
        throw new Error('Failed to generate invitation token');
      }

      if (tokenResponse?.error) {
        throw new Error(tokenResponse.error);
      }

      const { invitation, inviteUrl, token } = tokenResponse;

      // Call edge function to send invitation email
      let emailSent = true;
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: emailResponse, error: emailError } = await supabase.functions.invoke('send-user-invitation', {
        body: {
          email: params.email,
          role: params.role,
          token,
          inviterName: user?.user_metadata?.full_name || user?.email || 'Admin',
          notes: params.notes,
          appUrl: window.location.origin,
        },
      });

      if (emailError || emailResponse?.error) {
        console.error('Failed to send invitation email:', emailError || emailResponse?.error);
        emailSent = false;
      }

      return { invitation: invitation as Invitation, inviteUrl, emailSent };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['case-managers'] });
      if (result.emailSent) {
        toast({
          title: 'Invitation sent',
          description: 'The invitation email has been sent successfully.',
        });
      }
      // Don't show toast if email failed - the dialog will show the link
    },
    onError: (error) => {
      toast({
        title: 'Failed to create invitation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('user_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Invitation revoked',
        description: 'The invitation has been cancelled.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to revoke invitation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useValidateInvitation(token: string | null) {
  return useQuery({
    queryKey: ['invitation-validate', token],
    queryFn: async () => {
      if (!token) return null;

      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('token', token)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data as Invitation;
    },
    enabled: !!token,
  });
}

/**
 * Deprecated: realtime invalidation for user_invitations is now handled
 * centrally by useRealtimeBridge. This hook is a no-op and kept for backward
 * compatibility with any pages that still call it.
 */
export function useInvitationsRealtime() {
  // no-op
}

