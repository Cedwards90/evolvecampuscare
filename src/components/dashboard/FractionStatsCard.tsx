import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface FractionStatsCardProps {
  title: string;
  current: number;
  total: number;
  icon: LucideIcon;
  subtitle?: string;
  progressColor?: 'blue' | 'green' | 'orange' | 'red';
  className?: string;
}

const progressColors = {
  blue: 'bg-primary',
  green: 'bg-success',
  orange: 'bg-warning',
  red: 'bg-destructive',
};

const progressBgColors = {
  blue: '[&>div]:bg-primary',
  green: '[&>div]:bg-success',
  orange: '[&>div]:bg-warning',
  red: '[&>div]:bg-destructive',
};

export function FractionStatsCard({ 
  title, 
  current, 
  total, 
  icon: Icon, 
  subtitle,
  progressColor = 'blue',
  className 
}: FractionStatsCardProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <Card className={cn("border border-border/50 shadow-sm", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight">{current}</span>
                <span className="text-lg text-muted-foreground">/{total}</span>
              </div>
              <p className="text-sm text-muted-foreground">{title}</p>
            </div>
          </div>
          <button className="text-muted-foreground hover:text-foreground">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
              <circle cx="8" cy="2" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="14" r="1.5" />
            </svg>
          </button>
        </div>
        
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{subtitle || title}</span>
            <span className="font-medium">{percentage.toFixed(0)}%</span>
          </div>
          <Progress 
            value={percentage} 
            className={cn("h-1.5", progressBgColors[progressColor])}
          />
        </div>
      </CardContent>
    </Card>
  );
}
