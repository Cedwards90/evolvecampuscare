import { useRequestAttachments } from '@/hooks/useRequestAttachments';
import { useFinancialAssistanceHistory } from '@/hooks/useFinancialAssistanceHistory';
import { evaluateFinancialAssistance, type PolicyEvaluation } from '@/lib/financialAssistancePolicy';
import type { RequestCategory } from '@/types/database';

export interface RequestPolicyEvaluationInput {
  requestId: string;
  studentId?: string;
  requestCategory?: RequestCategory;
  requestedAmount?: number | null;
  approvedAmount?: number | null;
  fundingPurpose?: string | null;
  requestTitle?: string;
  requestDescription?: string;
}

export interface RequestPolicyEvaluationResult {
  /** Null when the request has no monetary context at all. */
  evaluation: PolicyEvaluation | null;
  hasMonetaryContext: boolean;
  isLoading: boolean;
  requiresRationale: boolean;
}

/**
 * Advisory financial policy evaluation for any request involving money:
 * Financial Assistance category, a requested amount, or an approved amount
 * (legacy records may only carry the latter).
 */
export function useRequestPolicyEvaluation({
  requestId,
  studentId,
  requestCategory,
  requestedAmount,
  approvedAmount,
  fundingPurpose,
  requestTitle,
  requestDescription,
}: RequestPolicyEvaluationInput): RequestPolicyEvaluationResult {
  const isFinancial = requestCategory === 'financial';
  const numericRequested =
    requestedAmount != null && Number(requestedAmount) > 0 ? Number(requestedAmount) : null;
  const numericApproved =
    approvedAmount != null && Number(approvedAmount) > 0 ? Number(approvedAmount) : null;
  const hasMonetaryContext = isFinancial || numericRequested !== null || numericApproved !== null;
  const amountFromApproved = numericRequested === null && numericApproved !== null;
  const effectiveAmount = numericRequested ?? numericApproved;

  const { data: attachments } = useRequestAttachments(hasMonetaryContext ? requestId : undefined);
  const historyQuery = useFinancialAssistanceHistory(
    hasMonetaryContext ? studentId : undefined,
    requestId
  );

  const evaluation = hasMonetaryContext
    ? evaluateFinancialAssistance({
        requestedAmount: effectiveAmount,
        fundingPurpose,
        title: requestTitle,
        description: requestDescription,
        attachmentCount: attachments?.length ?? 0,
        priorApprovedTotal: historyQuery.data?.approvedTotal ?? 0,
        priorHistoryKnown: !historyQuery.isError,
        amountFromApprovedRecord: amountFromApproved,
      })
    : null;

  return {
    evaluation,
    hasMonetaryContext,
    isLoading: historyQuery.isLoading,
    requiresRationale: !!evaluation?.requiresRationale,
  };
}
