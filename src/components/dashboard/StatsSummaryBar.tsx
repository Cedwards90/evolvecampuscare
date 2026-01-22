import { cn } from '@/lib/utils';

interface StatsSummaryItem {
  label: string;
  value: string | number;
  color: 'blue' | 'green' | 'orange' | 'red';
}

interface StatsSummaryBarProps {
  items: StatsSummaryItem[];
  className?: string;
}

const colorClasses = {
  blue: 'bg-primary',
  green: 'bg-success',
  orange: 'bg-warning',
  red: 'bg-destructive',
};

export function StatsSummaryBar({ items, className }: StatsSummaryBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-6 rounded-lg border border-border/50 bg-card p-4", className)}>
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{item.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</span>
            <div className={cn("h-1 w-16 rounded-full", colorClasses[item.color])} />
          </div>
        </div>
      ))}
    </div>
  );
}
