import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatHours, totalMinutes, type TimeEntry } from '@/hooks/useTimeEntries';
import { startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';

export function WeeklyTotalsCards({ entries }: { entries: TimeEntry[] }) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const thisWeek = entries.filter((e) => isWithinInterval(parseISO(e.entry_date), { start: weekStart, end: weekEnd }));

  const totalAll = totalMinutes(entries);
  const totalWeek = totalMinutes(thisWeek);
  const billableWeek = totalMinutes(thisWeek.filter((e) => e.billable));
  const pending = entries.filter((e) => e.status === 'pending').length;
  const approvedWeek = totalMinutes(thisWeek.filter((e) => e.status === 'approved'));

  const stats = [
    { label: 'This week', value: `${formatHours(totalWeek)}h` },
    { label: 'Billable this week', value: `${formatHours(billableWeek)}h` },
    { label: 'Approved this week', value: `${formatHours(approvedWeek)}h` },
    { label: 'Pending entries', value: String(pending) },
    { label: 'Total in view', value: `${formatHours(totalAll)}h` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{s.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
