import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Profile } from '@/types/database';

export interface StudentAssignment {
  id: string;
  student_id: string;
  case_manager_id: string;
  assigned_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  student?: Profile;
  case_manager?: Profile;
}

export interface UnassignedStudent {
  user_id: string;
  profile: Profile;
  pendingRequests: number;
}

export function useStudentAssignments() {
  return useQuery({
    queryKey: ['student-assignments'],
    queryFn: async () => {
      // Fetch all assignments
      const { data: assignments, error } = await supabase
        .from('student_assignments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!assignments || assignments.length === 0) return [];

      // Get unique user IDs (students and case managers)
      const studentIds = [...new Set(assignments.map(a => a.student_id))];
      const caseManagerIds = [...new Set(assignments.map(a => a.case_manager_id))];
      const allUserIds = [...new Set([...studentIds, ...caseManagerIds])];

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', allUserIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      // Enrich assignments with profiles
      return assignments.map(assignment => ({
        ...assignment,
        student: profileMap.get(assignment.student_id) as Profile | undefined,
        case_manager: profileMap.get(assignment.case_manager_id) as Profile | undefined,
      })) as StudentAssignment[];
    },
  });
}

export function useUnassignedStudents() {
  return useQuery({
    queryKey: ['unassigned-students'],
    queryFn: async () => {
      // Get all students (users with student role)
      const { data: studentRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      if (rolesError) throw rolesError;

      const allStudentIds = studentRoles?.map(r => r.user_id) || [];
      if (allStudentIds.length === 0) return [];

      // Get already assigned students
      const { data: assignments, error: assignmentsError } = await supabase
        .from('student_assignments')
        .select('student_id');

      if (assignmentsError) throw assignmentsError;

      const assignedStudentIds = new Set(assignments?.map(a => a.student_id) || []);

      // Filter to get unassigned students
      const unassignedStudentIds = allStudentIds.filter(id => !assignedStudentIds.has(id));
      if (unassignedStudentIds.length === 0) return [];

      // Get profiles for unassigned students
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', unassignedStudentIds);

      if (profilesError) throw profilesError;

      // Get pending request counts for each student
      const studentsWithCounts = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { count } = await supabase
            .from('support_requests')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', profile.user_id)
            .not('status', 'in', '("resolved","cancelled")');

          return {
            user_id: profile.user_id,
            profile: profile as Profile,
            pendingRequests: count || 0,
          };
        })
      );

      return studentsWithCounts as UnassignedStudent[];
    },
  });
}

interface AssignStudentParams {
  studentId: string;
  caseManagerId: string;
  assignedBy: string;
  notes?: string;
  updateExistingRequests?: boolean;
}

export function useAssignStudent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      studentId,
      caseManagerId,
      assignedBy,
      notes,
      updateExistingRequests = true,
    }: AssignStudentParams) => {
      // Upsert the assignment (update if exists, insert if not)
      const { error: assignError } = await supabase
        .from('student_assignments')
        .upsert(
          {
            student_id: studentId,
            case_manager_id: caseManagerId,
            assigned_by: assignedBy,
            notes: notes || null,
          },
          { onConflict: 'student_id' }
        );

      if (assignError) throw assignError;

      // Optionally update all existing unresolved requests to this case manager
      if (updateExistingRequests) {
        const { error: updateError } = await supabase
          .from('support_requests')
          .update({ 
            assigned_case_manager_id: caseManagerId,
            status: 'in_progress',
          })
          .eq('student_id', studentId)
          .in('status', ['submitted', 'in_progress', 'escalated']);

        if (updateError) {
          console.error('Failed to update existing requests:', updateError);
          // Don't throw - assignment succeeded, just log the warning
        }
      }

      return { studentId, caseManagerId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-students'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['case-managers'] });
      queryClient.invalidateQueries({ queryKey: ['case-manager-stats'] });
      queryClient.invalidateQueries({ queryKey: ['my-students'] });
      queryClient.invalidateQueries({ queryKey: ['student-folders'] });
      queryClient.invalidateQueries({ queryKey: ['my-assignment'] });
      toast({
        title: 'Student assigned',
        description: 'The student has been assigned to the case manager.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Assignment failed',
        description: error instanceof Error ? error.message : 'Failed to assign student',
        variant: 'destructive',
      });
    },
  });
}

export function useRemoveStudentAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase
        .from('student_assignments')
        .delete()
        .eq('student_id', studentId);

      if (error) throw error;
      return studentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-students'] });
      toast({
        title: 'Assignment removed',
        description: 'The student assignment has been removed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Removal failed',
        description: error instanceof Error ? error.message : 'Failed to remove assignment',
        variant: 'destructive',
      });
    },
  });
}

interface BulkAssignStudentsParams {
  studentIds: string[];
  caseManagerId: string;
  assignedBy: string;
}

export function useBulkAssignStudents() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      studentIds,
      caseManagerId,
      assignedBy,
    }: BulkAssignStudentsParams) => {
      // Create assignment records for all students
      const assignments = studentIds.map(studentId => ({
        student_id: studentId,
        case_manager_id: caseManagerId,
        assigned_by: assignedBy,
      }));

      const { error: assignError } = await supabase
        .from('student_assignments')
        .upsert(assignments, { onConflict: 'student_id' });

      if (assignError) throw assignError;

      // Update all existing unresolved requests for these students
      for (const studentId of studentIds) {
        await supabase
          .from('support_requests')
          .update({ 
            assigned_case_manager_id: caseManagerId,
            status: 'in_progress',
          })
          .eq('student_id', studentId)
          .in('status', ['submitted', 'in_progress', 'escalated']);
      }

      return { studentIds, caseManagerId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['student-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-students'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['case-managers'] });
      queryClient.invalidateQueries({ queryKey: ['case-manager-stats'] });
      toast({
        title: 'Students assigned',
        description: `${variables.studentIds.length} student(s) have been assigned to the case manager.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Bulk assignment failed',
        description: error instanceof Error ? error.message : 'Failed to assign students',
        variant: 'destructive',
      });
    },
  });
}
