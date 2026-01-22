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

const colorConfig = {
  blue: {
    stroke: 'hsl(217, 91%, 60%)',
    fill: 'hsl(217, 91%, 60%)',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconText: 'text-blue-600 dark:text-blue-400',
    ring: 'stroke-blue-500',
  },
  green: {
    stroke: 'hsl(142, 76%, 36%)',
    fill: 'hsl(142, 76%, 36%)',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    ring: 'stroke-emerald-500',
  },
  red: {
    stroke: 'hsl(0, 84%, 60%)',
    fill: 'hsl(0, 84%, 60%)',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconText: 'text-red-600 dark:text-red-400',
    ring: 'stroke-red-500',
  },
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
  const config = colorConfig[color];
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const circumference = 2 * Math.PI * 28;
  const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;

  return (
    <Card className={cn("border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300", className)}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* Circular Progress Ring */}
          <div className="relative">
            <svg className="h-16 w-16 -rotate-90 transform">
              <circle 
                cx="32" 
                cy="32" 
                r="28" 
                strokeWidth="4" 
                fill="none" 
                className="stroke-muted/30"
              />
              <circle 
                cx="32" 
                cy="32" 
                r="28" 
                strokeWidth="4" 
                fill="none" 
                className={cn("transition-all duration-700 ease-out", config.ring)}
                strokeLinecap="round"
                strokeDasharray={strokeDasharray}
              />
            </svg>
            <div className={cn(
              "absolute inset-0 flex items-center justify-center",
              config.iconText
            )}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
          
          <div className="flex-1">
            <p className="text-sm font-medium">{title}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold tracking-tight">{current}</span>
              <span className="text-lg text-muted-foreground font-medium">/{total}</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="h-12 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`sparkline-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={config.fill} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={config.fill} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke={config.stroke} 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill={`url(#sparkline-${color})`} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium whitespace-nowrap px-2 py-1 rounded-full",
              trend.isPositive 
                ? "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30" 
                : "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30"
            )}>
              {trend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>{trend.value}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
