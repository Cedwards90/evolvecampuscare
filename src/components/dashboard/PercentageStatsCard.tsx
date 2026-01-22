import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface PercentageStatsCardProps {
  title: string;
  percentage: number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon: LucideIcon;
  progressColor?: 'blue' | 'green' | 'orange' | 'red' | 'gradient';
  className?: string;
}

const progressBgColors = {
  blue: '[&>div]:bg-primary',
  green: '[&>div]:bg-success',
  orange: '[&>div]:bg-warning',
  red: '[&>div]:bg-destructive',
  gradient: '[&>div]:bg-gradient-to-r [&>div]:from-success [&>div]:via-warning [&>div]:to-destructive',
};

export function PercentageStatsCard({ 
  title, 
  percentage, 
  subtitle,
  trend,
  icon: Icon, 
  progressColor = 'gradient',
  className 
}: PercentageStatsCardProps) {
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
                <span className="text-2xl font-bold tracking-tight">{percentage.toFixed(2)}%</span>
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
            <span className="text-muted-foreground">{subtitle || 'Progress'}</span>
            {trend && (
              <span className={cn(
                "flex items-center gap-1 text-xs font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}>
                {trend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {trend.value}%
              </span>
            )}
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
