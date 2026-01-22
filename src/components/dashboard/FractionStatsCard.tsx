import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FractionStatsCardProps {
  title: string;
  current: number;
  total: number;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  href?: string;
  className?: string;
}

const colorStyles = {
  blue: {
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconText: 'text-blue-600 dark:text-blue-400',
    progressBg: 'bg-blue-100 dark:bg-blue-900/30',
    progressFill: 'bg-gradient-to-r from-blue-500 to-blue-600',
  },
  green: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    progressBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    progressFill: 'bg-gradient-to-r from-emerald-500 to-emerald-600',
  },
  yellow: {
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconText: 'text-amber-600 dark:text-amber-400',
    progressBg: 'bg-amber-100 dark:bg-amber-900/30',
    progressFill: 'bg-gradient-to-r from-amber-500 to-amber-600',
  },
  red: {
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconText: 'text-red-600 dark:text-red-400',
    progressBg: 'bg-red-100 dark:bg-red-900/30',
    progressFill: 'bg-gradient-to-r from-red-500 to-red-600',
  },
};

export function FractionStatsCard({ 
  title, 
  current, 
  total, 
  icon: Icon,
  color = 'blue',
  href,
  className 
}: FractionStatsCardProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const styles = colorStyles[color];

  const content = (
    <CardContent className="p-5">
      <div className="flex items-start gap-4">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 hover:scale-105", styles.iconBg)}>
          <Icon className={cn("h-5 w-5", styles.iconText)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold tracking-tight">{current}</span>
            <span className="text-lg text-muted-foreground font-medium">/{total}</span>
          </div>
        </div>
      </div>
      
      {/* Custom Progress Bar with Gradient */}
      <div className="mt-4">
        <div className={cn("h-2 w-full rounded-full overflow-hidden", styles.progressBg)}>
          <div 
            className={cn("h-full rounded-full transition-all duration-500 ease-out", styles.progressFill)}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Link to={href}>
        <Card className={cn("border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer hover:border-primary/50", className)}>
          {content}
        </Card>
      </Link>
    );
  }

  return (
    <Card className={cn("border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300", className)}>
      {content}
    </Card>
  );
}
