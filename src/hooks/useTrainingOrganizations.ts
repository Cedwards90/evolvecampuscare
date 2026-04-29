import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

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
    queryKey: queryKeys.organizations.all,
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
    queryKey: queryKeys.organizations.active,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all }),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.folders });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: ['organization-detail'] });
      queryClient.invalidateQueries({ queryKey: ['org-name'] });
    },
  });
}

export function useBulkAssignOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ organizationId, userIds }: { organizationId: string; userIds: string[] }) => {
      await Promise.all(
        userIds.map(async (userId) => {
          // Check if user already has an active membership in this org
          const { data: existing } = await supabase
            .from('organization_memberships')
            .select('id')
            .eq('user_id', userId)
            .eq('organization_id', organizationId)
            .is('left_at', null)
            .maybeSingle();

          if (existing) return; // Already in this org, skip

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
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.folders });
      queryClient.invalidateQueries({ queryKey: ['organization-detail'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.caseManagers.stats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
      queryClient.invalidateQueries({ queryKey: ['org-name'] });
    },
  });
}
