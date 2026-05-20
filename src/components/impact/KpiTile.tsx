import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Props {
  title: string;
  value: string | number;
  hint?: string;
}

export function KpiTile({ title, value, hint }: Props) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function FundingGoalRow({ title, current, target, period }: { title: string; current: number; target: number; period: string }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">{current} / {target} • {Math.round(pct)}%</span>
      </div>
      <Progress value={pct} />
      <p className="text-xs text-muted-foreground">{period}</p>
    </div>
  );
}
