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
      // Generate a secure token
      const token = crypto.randomUUID() + '-' + crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Insert invitation
      const { data: invitation, error: insertError } = await supabase
        .from('user_invitations')
        .insert({
          email: params.email,
          invited_role: params.role,
          invited_by: user.id,
          token,
          expires_at: expiresAt.toISOString(),
          auto_assign_case_manager: params.autoAssignCaseManager || null,
          notes: params.notes || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Build the invitation URL
      const inviteUrl = `${window.location.origin}/auth?tab=signup&invite=${token}`;

      // Call edge function to send invitation email
      let emailSent = true;
      const { data: emailResponse, error: emailError } = await supabase.functions.invoke('send-user-invitation', {
        body: {
          email: params.email,
          role: params.role,
          token,
          inviterName: user.user_metadata?.full_name || user.email,
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
