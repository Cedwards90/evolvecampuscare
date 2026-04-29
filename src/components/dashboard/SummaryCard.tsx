import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Settings, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryItem {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: string;
  href?: string;
}

interface SummaryCardProps {
  title: string;
  totalValue: number;
  totalLabel: string;
  trendValue?: number;
  items: SummaryItem[];
  headerHref?: string;
  footerHref?: string;
  className?: string;
}

export function SummaryCard({ 
  title, 
  totalValue, 
  totalLabel, 
  trendValue,
  items,
  headerHref,
  footerHref,
  className 
}: SummaryCardProps) {
  const headerContent = (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-3xl font-bold tracking-tight">{totalValue.toLocaleString()}</p>
        <p className="text-sm opacity-90 mt-1">{totalLabel}</p>
      </div>
      <div className="flex items-center gap-2">
        {trendValue !== undefined && (
          <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <TrendingUp className="h-3 w-3" />
            {trendValue}%
          </span>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/20"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <Card className={cn("border border-border/50 shadow-sm overflow-hidden hover:shadow-lg", className)}>
      {/* Gradient Header */}
      {headerHref ? (
        <Link to={headerHref} className="block bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-5 text-primary-foreground hover:from-primary/95 hover:via-primary/85 hover:to-primary/65 transition-colors">
          {headerContent}
        </Link>
      ) : (
        <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-5 text-primary-foreground">
          {headerContent}
        </div>
      )}

      {/* Items List */}
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {items.map((item, index) => {
            const itemContent = (
              <>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                </div>
                <span className="text-sm font-semibold">{item.value}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </>
            );

            if (item.href) {
              return (
                <Link 
                  key={index} 
                  to={item.href}
                  className="flex items-center gap-3 px-5 py-3 transition-colors duration-200 hover:bg-muted/50 cursor-pointer group"
                >
                  {itemContent}
                </Link>
              );
            }

            return (
              <div 
                key={index} 
                className="flex items-center gap-3 px-5 py-3 transition-colors duration-200 hover:bg-muted/50 cursor-pointer group"
              >
                {itemContent}
              </div>
            );
          })}
        </div>
        
        <div className="border-t border-border p-3">
          {footerHref ? (
            <Button 
              variant="ghost" 
              className="w-full text-sm font-medium hover:bg-primary/5"
              asChild
            >
              <Link to={footerHref}>
                Full Details
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              className="w-full text-sm font-medium hover:bg-primary/5"
            >
              Full Details
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
