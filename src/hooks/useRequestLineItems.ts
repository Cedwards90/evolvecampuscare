import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RequestLineItem {
  id: string;
  request_id: string;
  label: string;
  amount: number;
  is_eligible: boolean;
  note: string | null;
  created_at: string;
}

/** Staff-only itemization of a financial request. RLS restricts reads to staff. */
export function useRequestLineItems(requestId?: string, enabled = true) {
  return useQuery({
    queryKey: ['request-line-items', requestId],
    enabled: !!requestId && enabled,
    queryFn: async (): Promise<RequestLineItem[]> => {
      const { data, error } = await supabase
        .from('request_line_items')
        .select('id, request_id, label, amount, is_eligible, note, created_at')
        .eq('request_id', requestId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, amount: Number(row.amount) }));
    },
  });
}

export function useAddRequestLineItem(requestId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { label: string; amount: number; is_eligible: boolean; note?: string | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('request_line_items').insert({
        request_id: requestId,
        label: input.label,
        amount: input.amount,
        is_eligible: input.is_eligible,
        note: input.note ?? null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-line-items', requestId] });
    },
  });
}

export function useDeleteRequestLineItem(requestId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('request_line_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-line-items', requestId] });
    },
  });
}
