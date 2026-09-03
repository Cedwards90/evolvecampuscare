import { AlertTriangle, CheckCircle2, Info, ShieldCheck, Loader2, Gavel } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LIFETIME_CAP,
  formatUsd,
  type PolicyEvaluation,
  type FindingSeverity,
  type PolicyDecision,
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

const decisionTone: Record<PolicyDecision, string> = {
  approve: 'border-primary/40 bg-primary/5',
  approve_reduced: 'border-amber-500/40 bg-amber-500/5',
  approve_with_executive: 'border-amber-500/40 bg-amber-500/5',
  needs_amount: 'border-muted bg-muted/40',
  deny: 'border-destructive/40 bg-destructive/5',
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
  const pendingPct = Math.min(100 - usedPct, (evaluation.requestAmount / LIFETIME_CAP) * 100);

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

      {/* Final recommended decision */}
      <div className={`rounded-lg border p-3 min-w-0 ${decisionTone[evaluation.decision]}`}>
        <div className="flex items-start gap-2">
          <Gavel className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Recommended decision
            </p>
            <p className="font-semibold break-words">{evaluation.decisionLabel}</p>
            <p className="text-sm text-muted-foreground break-words">{evaluation.decisionReason}</p>
            {evaluation.blockers.length > 0 && (
              <p className="text-xs text-muted-foreground break-words">
                To resolve: {evaluation.blockers.join(' · ')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Balance math */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Lifetime allocation for this fund</span>
          <span className="font-medium">{formatUsd(LIFETIME_CAP)}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary flex">
          <div className="h-full bg-primary" style={{ width: `${usedPct}%` }} />
          <div className="h-full bg-primary/40" style={{ width: `${pendingPct}%` }} />
        </div>
        <dl className="grid gap-1 text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Approved to date</dt>
            <dd className="font-medium">{formatUsd(evaluation.usedLifetime)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">This request</dt>
            <dd className="font-medium">
              {evaluation.requestAmount > 0 ? formatUsd(evaluation.requestAmount) : 'Not recorded'}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Balance after approval</dt>
            <dd className="font-medium">{formatUsd(evaluation.remainingAfter)}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground break-words">
          Balance before this request {formatUsd(evaluation.remainingLifetime)}
          {evaluation.overageAmount > 0 && ` · over the cap by ${formatUsd(evaluation.overageAmount)}`}
          {` · max within policy without Executive Leadership approval ${formatUsd(
            evaluation.maxPolicyCompliantAmount
          )}`}
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 break-words">
          {evaluation.tierLabel}
          <span className="block text-xs text-muted-foreground">{evaluation.fundLabel}</span>
        </span>
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
