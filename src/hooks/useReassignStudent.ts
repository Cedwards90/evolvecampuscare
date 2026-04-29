import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ReassignStudentParams {
  studentId: string;
  fromCaseManagerId: string | null;
  toCaseManagerId: string;
  fromCaseManagerName?: string | null;
  toCaseManagerName?: string | null;
  notes?: string;
  reassignOpenRequests?: boolean;
}

/**
 * Reassigns a student from one case manager to another.
 * - Admin-only (RLS also enforces this on student_assignments).
 * - Upserts the student_assignments row (one row per student).
 * - Optionally moves open requests to the new CM.
 * - Writes an internal audit note on every affected request.
 * - Invalidates every query key that surfaces assignments anywhere in the app.
 */
export function useReassignStudent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, role } = useAuth();

  return useMutation({
    mutationFn: async ({
      studentId,
      fromCaseManagerId,
      toCaseManagerId,
      fromCaseManagerName,
      toCaseManagerName,
      notes,
      reassignOpenRequests = true,
    }: ReassignStudentParams) => {
      if (!user) throw new Error('You must be signed in.');
      if (role !== 'admin') throw new Error('Only administrators can reassign students.');
      if (!toCaseManagerId) throw new Error('A target case manager is required.');
      if (toCaseManagerId === fromCaseManagerId) {
        throw new Error('Target case manager must differ from the current one.');
      }

      // Defense-in-depth: confirm target user actually has the case_manager role.
      const { data: targetRole, error: roleErr } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', toCaseManagerId)
        .eq('role', 'case_manager')
        .maybeSingle();
      if (roleErr) throw roleErr;
      if (!targetRole) throw new Error('Selected user is not a case manager.');

      // Upsert assignment (one row per student via unique constraint on student_id).
      const { error: assignErr } = await supabase
        .from('student_assignments')
        .upsert(
          {
            student_id: studentId,
            case_manager_id: toCaseManagerId,
            assigned_by: user.id,
            notes: notes || null,
          },
          { onConflict: 'student_id' }
        );
      if (assignErr) throw assignErr;

      let updatedRequestIds: string[] = [];

      if (reassignOpenRequests) {
        const { data: openRequests, error: fetchErr } = await supabase
          .from('support_requests')
          .select('id')
          .eq('student_id', studentId)
          .in('status', ['submitted', 'in_progress', 'escalated']);
        if (fetchErr) throw fetchErr;

        updatedRequestIds = (openRequests || []).map((r) => r.id);

        if (updatedRequestIds.length > 0) {
          const { error: updErr } = await supabase
            .from('support_requests')
            .update({ assigned_case_manager_id: toCaseManagerId })
            .in('id', updatedRequestIds);
          if (updErr) throw updErr;

          // Audit note on each affected request (internal — staff only).
          const fromLabel = fromCaseManagerName || 'previous case manager';
          const toLabel = toCaseManagerName || 'new case manager';
          const auditNote =
            `Student reassigned from ${fromLabel} to ${toLabel} by an administrator.` +
            (notes ? ` Notes: ${notes}` : '');

          const auditRows = updatedRequestIds.map((rid) => ({
            request_id: rid,
            user_id: user.id,
            note: auditNote,
            is_internal: true,
          }));
          const { error: auditErr } = await supabase
            .from('request_updates')
            .insert(auditRows);
          if (auditErr) {
            // Non-fatal: assignment succeeded; log only.
            console.error('Failed to write reassignment audit notes:', auditErr);
          }
        }
      }

      return { studentId, toCaseManagerId, updatedRequestIds };
    },
    onSuccess: (_data, variables) => {
      // Invalidate every key that displays assignments so all surfaces refresh instantly.
      queryClient.invalidateQueries({ queryKey: ['student-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-students'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['case-managers'] });
      queryClient.invalidateQueries({ queryKey: ['case-manager-stats'] });
      queryClient.invalidateQueries({ queryKey: ['my-students'] });
      queryClient.invalidateQueries({ queryKey: ['my-assignment'] });
      queryClient.invalidateQueries({ queryKey: ['student-detail', variables.studentId] });

      toast({
        title: 'Student reassigned',
        description: 'The student and their open requests have been moved to the new case manager.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Reassignment failed',
        description: error instanceof Error ? error.message : 'Failed to reassign student',
        variant: 'destructive',
      });
    },
  });
}
