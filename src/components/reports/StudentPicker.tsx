import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStudentAssignments } from '@/hooks/useStudentAssignments';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  value: string | undefined;
  onChange: (studentId: string) => void;
  /** When set, only show students assigned to this case manager */
  caseManagerId?: string;
}

export function StudentPicker({ value, onChange, caseManagerId }: Props) {
  const { user, role } = useAuth();
  const { data: assignments, isLoading } = useStudentAssignments();

  const filterCm = caseManagerId ?? (role === 'case_manager' ? user?.id : undefined);

  const students = useMemo(() => {
    const list = (assignments || []).filter(
      (a) => !filterCm || a.case_manager_id === filterCm,
    );
    // Dedupe by student id (a student is only ever assigned to one CM, but be safe)
    const seen = new Set<string>();
    return list.filter((a) => {
      if (seen.has(a.student_id)) return false;
      seen.add(a.student_id);
      return !!a.student;
    });
  }, [assignments, filterCm]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Student:</span>
      <Select value={value} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder={isLoading ? 'Loading…' : 'Select a student'} />
        </SelectTrigger>
        <SelectContent>
          {students.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No assigned students
            </div>
          )}
          {students.map((a) => (
            <SelectItem key={a.student_id} value={a.student_id}>
              {a.student?.full_name || a.student?.email || 'Unknown student'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
