import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Read-only summary of a participant's previously approved financial assistance,
 * used to compute the remaining lifetime allocation. Relies on existing RLS.
 */
export function useFinancialAssistanceHistory(
  studentId: string | undefined,
  excludeRequestId?: string
) {
  return useQuery({
    queryKey: ['financial-assistance-history', studentId, excludeRequestId],
    enabled: !!studentId,
    queryFn: async () => {
      let query = supabase
        .from('support_requests')
        .select('id, approved_amount, approval_status, created_at')
        .eq('student_id', studentId!)
        .eq('category', 'financial')
        .not('approved_amount', 'is', null);

      if (excludeRequestId) {
        query = query.neq('id', excludeRequestId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []).filter((r) => r.approval_status !== 'denied');
      const total = rows.reduce((sum, r) => sum + Number(r.approved_amount ?? 0), 0);

      return { approvedTotal: total, disbursementCount: rows.length };
    },
  });
}
