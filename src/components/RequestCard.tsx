import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { CategoryBadge } from './CategoryBadge';
import { TimeAgo } from './TimeAgo';
import { AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import type { SupportRequest } from '@/types/database';
import { cn } from '@/lib/utils';

interface RequestCardProps {
  request: SupportRequest;
  showAssignee?: boolean;
  showStudent?: boolean;
  /**
   * 'staff' emphasises urgency and the next required action.
   * 'student' emphasises progress and reassurance.
   */
  variant?: 'staff' | 'student';
  onClick?: () => void;
  className?: string;
}

const OPEN_STATUSES = new Set(['submitted', 'in_progress', 'escalated']);

/** Days an open request can sit before it reads as overdue. */
const OVERDUE_DAYS = 7;

function shortId(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function staffNextStep(request: SupportRequest): string {
  switch (request.status) {
    case 'submitted':
      return request.assigned_case_manager_id ? 'Next: review and start work' : 'Next: assign a case manager';
    case 'in_progress':
      return 'Next: update status or add a case note';
    case 'escalated':
      return 'Next: reassign or add support';
    case 'resolved':
      return 'Resolved — no action needed';
    case 'cancelled':
      return 'Cancelled — no action needed';
    default:
      return 'Next: review this request';
  }
}

function studentProgress(request: SupportRequest): string {
  switch (request.status) {
    case 'submitted':
      return 'Received — waiting for a case manager to pick it up';
    case 'in_progress':
      return 'Your case manager is working on this';
    case 'escalated':
      return 'Escalated for extra support';
    case 'resolved':
      return 'Resolved';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'In review';
  }
}

export function RequestCard({
  request,
  showAssignee = false,
  showStudent = false,
  variant = 'staff',
  onClick,
  className,
}: RequestCardProps) {
  const navigate = useNavigate();

  const isOpen = OPEN_STATUSES.has(request.status);
  const ageDays = (Date.now() - new Date(request.created_at).getTime()) / (1000 * 60 * 60 * 24);
  const isOverdue = isOpen && ageDays >= OVERDUE_DAYS;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/requests/${request.id}`);
    }
  };

  return (
    <Card
      className={cn(
        'min-w-0 cursor-pointer transition-all hover:border-primary/50 hover:shadow-md',
        request.is_emergency && 'border-destructive/50 bg-destructive/5',
        !request.is_emergency && isOverdue && 'border-warning/50',
        className
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <CardContent className="min-w-0 p-4">
        {/* 1. Status first: emergency / overdue */}
        {(request.is_emergency || isOverdue) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {request.is_emergency && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                Emergency
              </Badge>
            )}
            {isOverdue && (
              <Badge variant="outline" className="gap-1 border-warning text-warning">
                <Clock className="h-3 w-3" aria-hidden="true" />
                Open {Math.floor(ageDays)}d
              </Badge>
            )}
          </div>
        )}

        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* 2. Title + identity */}
            <h3 className="font-semibold text-foreground [overflow-wrap:anywhere] line-clamp-2">
              {request.title}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-mono">{shortId(request.id)}</span>
              <span aria-hidden="true"> · </span>
              Updated <TimeAgo date={request.updated_at || request.created_at} />
            </p>

            <p className="mb-3 mt-2 text-sm text-muted-foreground line-clamp-2 [overflow-wrap:anywhere]">
              {request.description}
            </p>

            {/* 3. Consistent grouping: status, priority, category */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={request.status} />
              <PriorityBadge priority={request.priority} />
              <CategoryBadge category={request.category} />
            </div>

            {/* 4. Next action / progress */}
            <p
              className={cn(
                'mt-3 text-xs font-medium',
                variant === 'staff' && isOpen ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {variant === 'staff' ? staffNextStep(request) : studentProgress(request)}
            </p>
          </div>

          {/* 5. Secondary metadata + explicit affordance */}
          <div className="flex flex-shrink-0 flex-col items-end gap-1 text-right">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open request
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </span>
            <p className="text-[0.7rem] text-muted-foreground">
              Created <TimeAgo date={request.created_at} />
            </p>
            {showStudent && request.student && (
              <p className="max-w-[10rem] truncate text-[0.7rem] text-muted-foreground">
                From: {request.student.full_name || request.student.email}
              </p>
            )}
            {showAssignee && request.case_manager && (
              <p className="max-w-[10rem] truncate text-[0.7rem] text-muted-foreground">
                Assigned: {request.case_manager.full_name || request.case_manager.email}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
