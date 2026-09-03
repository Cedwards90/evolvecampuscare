import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig = {
  submitted: {
    label: 'Submitted',
    className: 'status-submitted',
  },
  in_progress: {
    label: 'In Progress',
    className: 'status-in-progress',
  },
  escalated: {
    label: 'Escalated',
    className: 'status-escalated',
  },
  resolved: {
    label: 'Resolved',
    className: 'status-resolved',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'status-cancelled',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig] ?? {
    label: (status || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    className: 'status-submitted',
  };
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
