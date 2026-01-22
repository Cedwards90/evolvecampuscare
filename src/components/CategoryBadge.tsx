import { cn } from '@/lib/utils';
import { GraduationCap, DollarSign, Heart, Home, HelpCircle } from 'lucide-react';

interface CategoryBadgeProps {
  category: 'academic' | 'financial' | 'mental_health' | 'housing' | 'other';
  showIcon?: boolean;
  className?: string;
}

const categoryConfig = {
  academic: {
    label: 'Academic',
    icon: GraduationCap,
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  },
  financial: {
    label: 'Financial Aid',
    icon: DollarSign,
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
  mental_health: {
    label: 'Mental Health',
    icon: Heart,
    className: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  },
  housing: {
    label: 'Housing',
    icon: Home,
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  other: {
    label: 'Other',
    icon: HelpCircle,
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  },
};

export function CategoryBadge({ category, showIcon = false, className }: CategoryBadgeProps) {
  const config = categoryConfig[category];
  const Icon = config.icon;
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </span>
  );
}
