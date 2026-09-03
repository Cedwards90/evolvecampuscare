import { cn } from '@/lib/utils';

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

const priorityConfig = {
  low: {
    label: 'Low',
    className: 'priority-low',
  },
  medium: {
    label: 'Medium',
    className: 'priority-medium',
  },
  high: {
    label: 'High',
    className: 'priority-high',
  },
  emergency: {
    label: 'Emergency',
    className: 'priority-emergency',
  },
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority as keyof typeof priorityConfig] ?? {
    label: (priority || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    className: 'priority-low',
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
