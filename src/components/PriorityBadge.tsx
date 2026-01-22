import { cn } from '@/lib/utils';

interface PriorityBadgeProps {
  priority: 'low' | 'medium' | 'high' | 'emergency';
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
  const config = priorityConfig[priority];
  
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
