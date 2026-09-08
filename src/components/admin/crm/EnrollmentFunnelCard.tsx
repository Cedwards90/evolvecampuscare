import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StudentCrmRow } from '@/hooks/useStudentCrm';
import type { StudentInvitationCounts } from '@/hooks/useStudentCrm';

export type FunnelStage = 'all' | 'signed_up' | 'profile_complete' | 'in_class' | 'graduated' | 'placed';

const today = () => new Date().toISOString().slice(0, 10);

export function isProfileComplete(row: StudentCrmRow): boolean {
  return !!(row.phone && row.address_line1 && row.date_of_birth);
}

export function isGraduated(row: StudentCrmRow): boolean {
  const t = today();
  if (row.graduation_date && row.graduation_date <= t) return true;
  if (row.cohort_graduated_at && row.cohort_graduated_at.slice(0, 10) <= t) return true;
  return false;
}

export function matchesStage(row: StudentCrmRow, stage: FunnelStage): boolean {
  switch (stage) {
    case 'signed_up':
      return true;
    case 'profile_complete':
      return isProfileComplete(row);
    case 'in_class':
      return !!row.cohort_id;
    case 'graduated':
      return isGraduated(row);
    case 'placed':
      return !!row.placement_date;
    default:
      return true;
  }
}

interface EnrollmentFunnelCardProps {
  /** All students in scope before the funnel filter is applied. */
  rows: StudentCrmRow[];
  stage: FunnelStage;
  onStageChange: (stage: FunnelStage) => void;
  invitations?: StudentInvitationCounts | null;
}

const STAGES: { key: FunnelStage; label: string; help: string }[] = [
  { key: 'signed_up', label: 'Signed up', help: 'Student accounts that exist' },
  { key: 'profile_complete', label: 'Profile complete', help: 'Phone, address and date of birth on file' },
  { key: 'in_class', label: 'In a class', help: 'Assigned to a class/cohort' },
  { key: 'graduated', label: 'Graduated', help: 'Graduation date reached, or their class has graduated' },
  { key: 'placed', label: 'Placed', help: 'Placement date recorded' },
];

export function EnrollmentFunnelCard({ rows, stage, onStageChange, invitations }: EnrollmentFunnelCardProps) {
  const base = rows.length;

  return (
    <Card className="border border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Enrollment funnel</CardTitle>
        <CardDescription>
          {invitations
            ? `${invitations.total} student invitation${invitations.total === 1 ? '' : 's'} sent all time (${invitations.pending} still pending). Stages below reflect the students currently in view — click one to filter.`
            : 'Stages reflect the students currently in view — click one to filter.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {STAGES.map((s) => {
            const count = rows.filter((r) => matchesStage(r, s.key)).length;
            const pct = base > 0 ? Math.round((count / base) * 100) : null;
            const active = stage === s.key;
            return (
              <Button
                key={s.key}
                type="button"
                variant="outline"
                onClick={() => onStageChange(active ? 'all' : s.key)}
                title={s.help}
                className={cn(
                  'h-auto flex-col items-start gap-1 py-3 text-left whitespace-normal',
                  active && 'border-primary bg-primary/5',
                )}
              >
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span className="text-xl font-semibold">{base === 0 ? '—' : count}</span>
                <span className="text-[11px] text-muted-foreground">
                  {base === 0 ? 'Not enough data' : `${pct}% of students shown`}
                </span>
              </Button>
            );
          })}
        </div>
        {stage !== 'all' && (
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => onStageChange('all')}>
            Clear stage filter
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
