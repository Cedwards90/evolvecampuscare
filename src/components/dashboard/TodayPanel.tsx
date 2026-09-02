import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export interface TodayStat {
  label: string;
  value: number | string;
  href?: string;
  tone?: 'default' | 'urgent';
}

export interface TodayAction {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'outline';
}

interface TodayPanelProps {
  greeting: string;
  subtitle: string;
  primaryAction?: TodayAction;
  secondaryActions?: TodayAction[];
  stats?: TodayStat[];
}

/**
 * Action-first hero for the dashboard: who you are, what to do next, and the
 * two or three numbers that matter today. Analytics stay further down the page.
 */
export function TodayPanel({ greeting, subtitle, primaryAction, secondaryActions = [], stats = [] }: TodayPanelProps) {
  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold sm:text-2xl">{greeting}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2 lg:flex-shrink-0">
            {primaryAction && (
              <Button asChild size="lg" className="min-w-0">
                <Link to={primaryAction.href}>
                  {primaryAction.icon && <primaryAction.icon className="mr-2 h-4 w-4" />}
                  <span className="truncate">{primaryAction.label}</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
            {secondaryActions.map((action) => (
              <Button key={action.href + action.label} asChild size="lg" variant={action.variant ?? 'outline'}>
                <Link to={action.href}>
                  {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                  <span className="truncate">{action.label}</span>
                </Link>
              </Button>
            ))}
          </div>
        </div>

        {stats.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => {
              const body = (
                <div className="rounded-lg border border-border/50 bg-card p-3">
                  <p
                    className={
                      stat.tone === 'urgent'
                        ? 'font-display text-2xl font-bold text-destructive'
                        : 'font-display text-2xl font-bold'
                    }
                  >
                    {stat.value}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{stat.label}</p>
                </div>
              );
              return stat.href ? (
                <Link key={stat.label} to={stat.href} className="min-w-0 transition-opacity hover:opacity-80">
                  {body}
                </Link>
              ) : (
                <div key={stat.label} className="min-w-0">
                  {body}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
