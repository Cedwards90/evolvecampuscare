import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FinancialPolicyRecommendation } from '@/components/requests/FinancialPolicyRecommendation';
import {
  useRequestPolicyEvaluation,
  type RequestPolicyEvaluationInput,
} from '@/hooks/useRequestPolicyEvaluation';

/**
 * Read-only advisory policy review for any request involving money.
 * Rendered independently of the approval controls so it stays visible on
 * resolved, cancelled, escalated, and unassigned requests.
 */
export function RequestPolicyCard({
  readOnly = false,
  ...input
}: RequestPolicyEvaluationInput & { readOnly?: boolean }) {
  const { evaluation, isLoading } = useRequestPolicyEvaluation(input);

  if (!evaluation) return null;

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Financial policy recommendation</CardTitle>
        <p className="text-xs text-muted-foreground">
          Program Operations Manual — Financial Control Protocol
          {readOnly ? ' · historical review, no actions available' : ''}
        </p>
      </CardHeader>
      <CardContent>
        <FinancialPolicyRecommendation evaluation={evaluation} isLoading={isLoading} compact />
      </CardContent>
    </Card>
  );
}
