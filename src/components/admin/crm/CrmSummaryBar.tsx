import { Users, DollarSign, TrendingUp, HandCoins } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { StudentCrmRow } from '@/hooks/useStudentCrm';

interface CrmSummaryBarProps {
  rows: StudentCrmRow[];
  /** Money figures are hidden for roles that should not see funding amounts. */
  showMoney: boolean;
}

export function CrmSummaryBar({ rows, showMoney }: CrmSummaryBarProps) {
  const total = rows.length;
  const dispersed = rows.reduce((sum, r) => sum + r.dispersed, 0);
  const funded = rows.filter((r) => r.dispersed > 0).length;
  const average = funded > 0 ? dispersed / funded : 0;

  const items = [
    { label: 'Students shown', value: String(total), icon: Users },
    ...(showMoney
      ? [
          { label: 'Total dispersed', value: formatCurrency(dispersed), icon: DollarSign },
          {
            label: 'Average per funded student',
            value: funded > 0 ? formatCurrency(average) : 'No funded students yet',
            icon: TrendingUp,
          },
          { label: 'Students with funding', value: String(funded), icon: HandCoins },
        ]
      : []),
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <Card key={item.label} className="border border-border/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 min-w-0">
              <item.icon className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-semibold break-words">{item.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
