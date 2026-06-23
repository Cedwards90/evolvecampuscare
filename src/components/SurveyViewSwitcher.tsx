import { useLocation, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

interface ViewOption {
  value: string;
  label: string;
  path: string;
}

const STAFF_VIEWS: ViewOption[] = [
  { value: 'responses', label: 'Check-in & post-grad responses', path: '/admin/surveys' },
  { value: 'lifeskills', label: 'Life Skills surveys', path: '/admin/lifeskills' },
];

const STUDENT_VIEWS: ViewOption[] = [
  { value: 'mine', label: 'My Life Skills surveys', path: '/surveys' },
  { value: 'intake', label: 'Intake survey', path: '/intake-survey' },
];

/**
 * Dropdown that lets users jump between the different survey surfaces.
 * Placed at the top of every survey-related page so the section feels unified.
 */
export function SurveyViewSwitcher() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();

  const isStaff = role === 'admin' || role === 'case_manager' || role === 'org_admin';
  const views = isStaff ? STAFF_VIEWS : STUDENT_VIEWS;

  const current = views.find((v) => pathname.startsWith(v.path))?.value ?? views[0].value;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
      <Label htmlFor="survey-view" className="text-xs uppercase tracking-wider text-muted-foreground">
        View
      </Label>
      <Select
        value={current}
        onValueChange={(v) => {
          const target = views.find((x) => x.value === v);
          if (target && target.path !== pathname) navigate(target.path);
        }}
      >
        <SelectTrigger id="survey-view" className="sm:w-72 rounded-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {views.map((v) => (
            <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
