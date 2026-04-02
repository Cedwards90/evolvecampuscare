import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TrainingOrganization {
  id: string;
  name: string;
  description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useTrainingOrganizations() {
  return useQuery({
    queryKey: ['training-organizations'],
    queryFn: async (): Promise<TrainingOrganization[]> => {
      const { data, error } = await supabase
        .from('training_organizations')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as TrainingOrganization[];
    },
  });
}

export function useActiveOrganizations() {
  return useQuery({
    queryKey: ['training-organizations', 'active'],
    queryFn: async (): Promise<TrainingOrganization[]> => {
      const { data, error } = await supabase
        .from('training_organizations')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as TrainingOrganization[];
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (org: { name: string; description?: string; contact_name?: string; contact_email?: string }) => {
      const { data, error } = await supabase
        .from('training_organizations')
        .insert(org)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['training-organizations'] }),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string; contact_name?: string; contact_email?: string; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('training_organizations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['training-organizations'] }),
  });
}

export function useBulkAssignOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ organizationId, userIds }: { organizationId: string; userIds: string[] }) => {
      // For each user: close previous membership, update profile, create new membership
      const results = await Promise.all(
        userIds.map(async (userId) => {
          // Close any existing active membership for this user (any org)
          await supabase
            .from('organization_memberships')
            .update({ left_at: new Date().toISOString() })
            .eq('user_id', userId)
            .is('left_at', null);

          // Update profile
          const { error } = await supabase
            .from('profiles')
            .update({ organization_id: organizationId })
            .eq('user_id', userId);
          if (error) throw error;

          // Create new membership record
          await supabase
            .from('organization_memberships')
            .insert({ user_id: userId, organization_id: organizationId });
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
    },
  });
}
