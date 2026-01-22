import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

export interface NotificationSettings {
  email_enabled: boolean;
  in_app_enabled: boolean;
  types: {
    new_request: boolean;
    status_change: boolean;
    assignment: boolean;
    invitation: boolean;
    weekly_summary: boolean;
  };
}

const DEFAULT_SETTINGS: NotificationSettings = {
  email_enabled: true,
  in_app_enabled: true,
  types: {
    new_request: true,
    status_change: true,
    assignment: true,
    invitation: true,
    weekly_summary: true,
  },
};

export function useNotificationSettings() {
  return useQuery({
    queryKey: ['site-settings', 'notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .eq('key', 'notifications')
        .single();
      
      if (error) {
        console.error('Error fetching notification settings:', error);
        return DEFAULT_SETTINGS;
      }
      
      const value = data?.value;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as unknown as NotificationSettings;
      }
      
      return DEFAULT_SETTINGS;
    },
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (newSettings: NotificationSettings) => {
      const { error } = await supabase
        .from('site_settings')
        .update({
          value: newSettings as unknown as Json,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq('key', 'notifications');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings', 'notifications'] });
    },
  });
}
