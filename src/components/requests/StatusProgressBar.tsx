import { Check, Clock, ArrowRight, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RequestStatus } from '@/types/database';

interface StatusProgressBarProps {
  status: RequestStatus;
  isAssigned: boolean;
}

type Step = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NORMAL_STEPS: Step[] = [
  { key: 'submitted', label: 'Submitted', icon: Clock },
  { key: 'assigned', label: 'Assigned', icon: ArrowRight },
  { key: 'in_progress', label: 'In Progress', icon: ArrowRight },
  { key: 'resolved', label: 'Resolved', icon: Check },
];

export function StatusProgressBar({ status, isAssigned }: StatusProgressBarProps) {
  // Branch states get their own treatment
  if (status === 'cancelled') {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 sm:p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0">
          <XCircle className="h-5 w-5 text-destructive" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm">Request denied / cancelled</p>
          <p className="text-xs text-muted-foreground">No further actions are available.</p>
        </div>
      </div>
    );
  }

  // Determine current index in normal flow
  let currentIdx = 0;
  if (status === 'submitted') currentIdx = isAssigned ? 1 : 0;
  else if (status === 'in_progress') currentIdx = 2;
  else if (status === 'escalated') currentIdx = 2;
  else if (status === 'resolved') currentIdx = 3;

  const isEscalated = status === 'escalated';

  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        {NORMAL_STEPS.map((step, idx) => {
          const isComplete = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const Icon = isComplete ? Check : step.icon;
          const dotColor = isEscalated && isCurrent
            ? 'bg-orange-500 text-white border-orange-500'
            : isComplete
            ? 'bg-primary text-primary-foreground border-primary'
            : isCurrent
            ? 'bg-primary text-primary-foreground border-primary ring-4 ring-primary/20'
            : 'bg-muted text-muted-foreground border-border';

          const lineColor = idx < currentIdx
            ? 'bg-primary'
            : 'bg-border';

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-initial min-w-0">
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className={cn(
                    'h-8 w-8 sm:h-9 sm:w-9 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0',
                    dotColor,
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <span
                  className={cn(
                    'text-[10px] sm:text-xs text-center leading-tight max-w-[64px] sm:max-w-none truncate',
                    isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {isEscalated && isCurrent ? 'Escalated' : step.label}
                </span>
              </div>
              {idx < NORMAL_STEPS.length - 1 && (
                <div className={cn('h-0.5 flex-1 mx-1 sm:mx-2 rounded-full -mt-5', lineColor)} />
              )}
            </div>
          );
        })}
      </div>
      {isEscalated && (
        <div className="mt-3 flex items-center gap-2 text-xs text-orange-700 dark:text-orange-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>This request is escalated for urgent attention.</span>
        </div>
      )}
    </div>
  );
}
