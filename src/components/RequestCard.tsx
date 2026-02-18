import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { CategoryBadge } from './CategoryBadge';
import { TimeAgo } from './TimeAgo';
import { AlertTriangle } from 'lucide-react';
import type { SupportRequest } from '@/types/database';
import { cn } from '@/lib/utils';

interface RequestCardProps {
  request: SupportRequest;
  showAssignee?: boolean;
  showStudent?: boolean;
  onClick?: () => void;
  className?: string;
}

export function RequestCard({
  request,
  showAssignee = false,
  showStudent = false,
  onClick,
  className,
}: RequestCardProps) {
  const navigate = useNavigate();

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
        'cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
        request.is_emergency && 'border-destructive/50 bg-destructive/5',
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
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {request.is_emergency && (
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              )}
              <h3 className="font-semibold text-foreground truncate">{request.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {request.description}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={request.category} />
              <PriorityBadge priority={request.priority} />
              <StatusBadge status={request.status} />
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">
              <TimeAgo date={request.created_at} />
            </p>
            {showStudent && request.student && (
              <p className="text-xs text-muted-foreground mt-1">
                From: {request.student.full_name || request.student.email}
              </p>
            )}
            {showAssignee && request.case_manager && (
              <p className="text-xs text-muted-foreground mt-1">
                Assigned: {request.case_manager.full_name || request.case_manager.email}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
