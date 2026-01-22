import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIBadgeProps {
  className?: string;
}

export function AIBadge({ className }: AIBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-100 to-blue-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:from-purple-900/30 dark:to-blue-900/30 dark:text-purple-300',
        className
      )}
    >
      <Sparkles className="h-3 w-3" />
      AI Generated
    </span>
  );
}
