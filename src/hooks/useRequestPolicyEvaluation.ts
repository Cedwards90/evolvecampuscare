import { useRequestAttachments } from '@/hooks/useRequestAttachments';
import { useFinancialAssistanceHistory } from '@/hooks/useFinancialAssistanceHistory';
import { useEffectiveGraduationDate } from '@/hooks/useEffectiveGraduationDate';
import { useRequestLineItems } from '@/hooks/useRequestLineItems';
import {
  evaluateFinancialAssistance,
  type PolicyEvaluation,
  type FundType,
} from '@/lib/financialAssistancePolicy';
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
  /** Used to route the request to the Barrier Mitigation or Alumni Support fund. */
  requestCreatedAt?: string | null;
}

export interface RequestPolicyEvaluationResult {
  /** Null when the request has no monetary context at all. */
  evaluation: PolicyEvaluation | null;
  hasMonetaryContext: boolean;
  isLoading: boolean;
  requiresRationale: boolean;
}

/** Requests dated on/after the effective graduation date draw on the Alumni Support fund. */
/** Whole months from graduation to the request date; null when either is unknown. */
export function monthsBetween(
  graduationDate: string | null | undefined,
  createdAt: string | null | undefined
): number | null {
  if (!graduationDate || !createdAt) return null;
  const grad = new Date(graduationDate);
  const created = new Date(createdAt);
  if (Number.isNaN(grad.getTime()) || Number.isNaN(created.getTime())) return null;
  let months =
    (created.getFullYear() - grad.getFullYear()) * 12 + (created.getMonth() - grad.getMonth());
  if (created.getDate() < grad.getDate()) months -= 1;
  return months;
}

export function classifyFund(
  createdAt: string | null | undefined,
  graduationDate: string | null | undefined
): FundType {
  if (!graduationDate || !createdAt) return 'barrier';
  const created = createdAt.slice(0, 10);
  return created >= graduationDate.slice(0, 10) ? 'alumni' : 'barrier';
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
  requestCreatedAt,
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
  const graduationQuery = useEffectiveGraduationDate(hasMonetaryContext ? studentId : undefined);
  const lineItemsQuery = useRequestLineItems(requestId, hasMonetaryContext);

  const graduationDate = graduationQuery.data?.date ?? null;
  const fundType = classifyFund(requestCreatedAt, graduationDate);

  // Only same-fund history counts: the two funds are separate and non-transferable.
  const sameFundTotal = (historyQuery.data?.rows ?? [])
    .filter((row) => classifyFund(row.createdAt, graduationDate) === fundType)
    .reduce((sum, row) => sum + row.approvedAmount, 0);

  const evaluation = hasMonetaryContext
    ? evaluateFinancialAssistance({
        requestedAmount: effectiveAmount,
        fundingPurpose,
        title: requestTitle,
        description: requestDescription,
        attachmentCount: attachments?.length ?? 0,
        priorApprovedTotal: sameFundTotal,
        priorHistoryKnown: !historyQuery.isError,
        amountFromApprovedRecord: amountFromApproved,
        fundType,
        graduationDateKnown: !!graduationDate,
        monthsSinceGraduation: monthsBetween(graduationDate, requestCreatedAt),
        lineItems: (lineItemsQuery.data ?? []).map((li) => ({
          label: li.label,
          amount: li.amount,
          isEligible: li.is_eligible,
        })),
      })
    : null;

  return {
    evaluation,
    hasMonetaryContext,
    isLoading: historyQuery.isLoading || graduationQuery.isLoading,
    requiresRationale: !!evaluation?.requiresRationale,
  };
}
