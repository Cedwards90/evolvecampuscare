import { AlertTriangle, CheckCircle2, Info, ShieldCheck, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  LIFETIME_CAP,
  formatUsd,
  type PolicyEvaluation,
  type FindingSeverity,
} from '@/lib/financialAssistancePolicy';

const severityIcon: Record<FindingSeverity, typeof Info> = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

const severityClass: Record<FindingSeverity, string> = {
  critical: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-muted-foreground',
};

export function FinancialPolicyRecommendation({
  evaluation,
  isLoading,
  compact = false,
}: {
  evaluation: PolicyEvaluation;
  isLoading?: boolean;
  compact?: boolean;
}) {
  const badgeVariant =
    evaluation.recommendation === 'recommended'
      ? 'default'
      : evaluation.recommendation === 'conditional'
      ? 'secondary'
      : 'destructive';

  const usedPct = Math.min(100, (evaluation.usedLifetime / LIFETIME_CAP) * 100);

  const body = (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={badgeVariant}>{evaluation.recommendationLabel}</Badge>
        {isLoading && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> checking balance
          </span>
        )}
        <span className="text-xs text-muted-foreground">Advisory only — reviewer decides</span>
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Lifetime allocation used</span>
          <span className="font-medium">
            {formatUsd(evaluation.usedLifetime)} of {formatUsd(LIFETIME_CAP)}
          </span>
        </div>
        <Progress value={usedPct} className="h-2" />
        <p className="text-xs text-muted-foreground">
          Remaining balance {formatUsd(evaluation.remainingLifetime)}
          {evaluation.projectedTotal > 0 &&
            ` · total after this request ${formatUsd(evaluation.projectedTotal)}`}
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">{evaluation.tierLabel}</span>
      </div>

      <ul className="space-y-2">
        {evaluation.findings.length === 0 && (
          <li className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>No policy concerns detected.</span>
          </li>
        )}
        {evaluation.findings.map((finding) => {
          const Icon = severityIcon[finding.severity];
          return (
            <li key={finding.id} className="flex items-start gap-2 text-sm min-w-0">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${severityClass[finding.severity]}`} />
              <span className="min-w-0 break-words">
                <span className="font-medium">{finding.title}.</span>{' '}
                <span className="text-muted-foreground">{finding.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );

  if (compact) return body;

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Financial policy recommendation</CardTitle>
        <p className="text-xs text-muted-foreground">
          Program Operations Manual — Financial Control Protocol
        </p>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
