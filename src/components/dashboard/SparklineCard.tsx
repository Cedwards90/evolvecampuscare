import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface SparklineCardProps {
  title: string;
  subtitle?: string;
  current: number;
  total: number;
  data: number[];
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'red';
  className?: string;
}

const colors = {
  blue: 'hsl(217, 91%, 60%)',
  green: 'hsl(142, 76%, 36%)',
  red: 'hsl(0, 84%, 60%)',
};

export function SparklineCard({ 
  title, 
  subtitle,
  current, 
  total,
  data,
  trend,
  icon: Icon,
  color = 'blue',
  className 
}: SparklineCardProps) {
  const chartData = data.map((value, index) => ({ value }));
  const chartColor = colors[color];

  return (
    <Card className={cn("border border-border/50 shadow-sm", className)}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{title}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{current}</span>
              <span className="text-lg text-muted-foreground">/{total}</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="h-12 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`sparkline-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke={chartColor} 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill={`url(#sparkline-${color})`} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium whitespace-nowrap",
              trend.isPositive ? "text-success" : "text-destructive"
            )}>
              {trend.isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>{trend.value}% more</span>
              <span className="text-muted-foreground font-normal">from last week</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
