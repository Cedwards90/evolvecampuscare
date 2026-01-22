import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryItem {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: string;
}

interface SummaryCardProps {
  title: string;
  totalValue: number;
  totalLabel: string;
  trendValue?: number;
  items: SummaryItem[];
  className?: string;
}

export function SummaryCard({ 
  title, 
  totalValue, 
  totalLabel, 
  trendValue,
  items,
  className 
}: SummaryCardProps) {
  return (
    <Card className={cn("border border-border/50 shadow-sm", className)}>
      {/* Gradient Header */}
      <div className="rounded-t-lg bg-gradient-to-br from-primary via-primary to-primary/80 p-5 text-primary-foreground">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-3xl font-bold">{totalValue.toLocaleString()}</p>
            <p className="text-sm opacity-90">{totalLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {trendValue && (
              <span className="flex items-center gap-1 rounded-md bg-white/20 px-2 py-1 text-xs font-medium">
                <TrendingUp className="h-3 w-3" />
                {trendValue}%
              </span>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-white/20">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Items List */}
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-3 px-5 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
              <span className="text-sm font-semibold">{item.value}</span>
            </div>
          ))}
        </div>
        
        <div className="border-t border-border p-3">
          <Button variant="ghost" className="w-full text-sm font-medium">
            Full Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
