import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface StudentFolder {
  user_id: string;
  full_name: string | null;
  email: string;
  intake_completed: boolean;
  total_requests: number;
  pending_requests: number;
  last_activity: string | null;
  organization_id: string | null;
  organization_name: string | null;
  graduation_date: string | null;
}

export function useStudentFolders() {
  const { role, user } = useAuth();

  return useQuery({
    queryKey: ['student-folders', role, user?.id],
    queryFn: async (): Promise<StudentFolder[]> => {
      // Step 1: Get student user_ids based on role
      let studentIds: string[] = [];

      if (role === 'admin') {
        const { data: roles, error } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'student');
        if (error) throw error;
        studentIds = (roles || []).map(r => r.user_id);
      } else if (role === 'case_manager') {
        const { data: assignments, error } = await supabase
          .from('student_assignments')
          .select('student_id')
          .eq('case_manager_id', user!.id);
        if (error) throw error;
        studentIds = (assignments || []).map(a => a.student_id);
      } else if (role === 'org_admin') {
        // Get org(s) this user administers
        const { data: orgRows, error: orgErr } = await supabase
          .from('org_admins')
          .select('organization_id')
          .eq('user_id', user!.id);
        if (orgErr) throw orgErr;
        const orgIds = (orgRows || []).map(r => r.organization_id);
        if (orgIds.length === 0) {
          studentIds = [];
        } else {
          // Profiles in those orgs
          const { data: orgProfiles, error: profErr } = await supabase
            .from('profiles')
            .select('user_id')
            .in('organization_id', orgIds);
          if (profErr) throw profErr;
          const candidateIds = (orgProfiles || []).map(p => p.user_id);
          if (candidateIds.length === 0) {
            studentIds = [];
          } else {
            // Filter to those with the student role
            const { data: studentRoleRows, error: roleErr } = await supabase
              .from('user_roles')
              .select('user_id')
              .eq('role', 'student')
              .in('user_id', candidateIds);
            if (roleErr) throw roleErr;
            studentIds = (studentRoleRows || []).map(r => r.user_id);
          }
        }
      }

      if (studentIds.length === 0) return [];

      // Step 2: Fetch profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, organization_id, graduation_date')
        .in('user_id', studentIds);
      if (profileError) throw profileError;

      // Step 2b: Fetch org names
      const orgIds = [...new Set((profiles || []).map(p => (p as any).organization_id).filter(Boolean))];
      let orgMap = new Map<string, string>();
      if (orgIds.length > 0) {
        const { data: orgs, error: orgError } = await supabase
          .from('training_organizations')
          .select('id, name')
          .in('id', orgIds);
        if (orgError) throw orgError;
        orgMap = new Map((orgs || []).map((o: any) => [o.id, o.name]));
      }

      // Step 3: Fetch student_files for intake status
      const { data: files, error: filesError } = await supabase
        .from('student_files')
        .select('student_id, intake_completed_at')
        .in('student_id', studentIds);
      if (filesError) throw filesError;

      // Step 4: Fetch request counts
      const { data: requests, error: requestsError } = await supabase
        .from('support_requests')
        .select('student_id, status, updated_at')
        .in('student_id', studentIds);
      if (requestsError) throw requestsError;

      const filesMap = new Map((files || []).map(f => [f.student_id, f]));
      const requestsByStudent = new Map<string, typeof requests>();
      for (const r of requests || []) {
        if (!requestsByStudent.has(r.student_id)) requestsByStudent.set(r.student_id, []);
        requestsByStudent.get(r.student_id)!.push(r);
      }

      const pendingStatuses = ['submitted', 'in_progress', 'escalated'];

      return (profiles || []).map(p => {
        const reqs = requestsByStudent.get(p.user_id) || [];
        const file = filesMap.get(p.user_id);
        const lastReq = reqs.length > 0
          ? reqs.reduce((a, b) => (a.updated_at > b.updated_at ? a : b))
          : null;
        const orgId = (p as any).organization_id;

        return {
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          intake_completed: !!file?.intake_completed_at,
          total_requests: reqs.length,
          pending_requests: reqs.filter(r => pendingStatuses.includes(r.status)).length,
          last_activity: lastReq?.updated_at || null,
          organization_id: orgId || null,
          organization_name: orgId ? orgMap.get(orgId) || null : null,
          graduation_date: (p as any).graduation_date || null,
        };
      }).sort((a, b) => (b.last_activity || '').localeCompare(a.last_activity || ''));
    },
    enabled: !!user && (role === 'admin' || role === 'case_manager' || role === 'org_admin'),
  });
}
