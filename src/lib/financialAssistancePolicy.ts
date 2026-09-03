/**
 * Advisory evaluation of financial assistance requests against the
 * Program Operations Manual — Module 1 Supplemental: Financial Control Protocol.
 *
 * This module is pure and dependency-free. It never blocks or auto-decides;
 * it produces guidance for the human reviewer.
 */

export const LIFETIME_CAP = 1000;
export const SINGLE_DISBURSEMENT_CAP = 500;
export const DIRECTOR_TIER_MAX = 500;

export type FindingSeverity = 'critical' | 'warning' | 'info';

export interface PolicyFinding {
  id: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
}

export type ApprovalTier = 'director' | 'executive' | 'none';

export type Recommendation = 'recommended' | 'conditional' | 'not_recommended';

/**
 * Barrier Mitigation applies during active enrollment; Alumni Support applies
 * after the participant's graduation / career start. Each fund carries its own
 * lifetime allocation and the funds are non-transferable.
 */
export type FundType = 'barrier' | 'alumni';

export type PolicyDecision =
  | 'approve'
  | 'approve_reduced'
  | 'approve_with_executive'
  | 'deny'
  | 'needs_amount';

export interface PolicyEvaluationInput {
  requestedAmount?: number | null;
  fundingPurpose?: string | null;
  title?: string | null;
  description?: string | null;
  attachmentCount?: number;
  /** Sum of previously approved amounts drawn from the SAME fund as this request. */
  priorApprovedTotal?: number;
  priorHistoryKnown?: boolean;
  /**
   * True when `requestedAmount` was taken from an already-approved amount because the
   * record has no requested amount (legacy request predating the structured fields).
   */
  amountFromApprovedRecord?: boolean;
  /** Which fund this request draws on, derived from the effective graduation date. */
  fundType?: FundType;
  /** False when no graduation date exists for the participant or their cohort. */
  graduationDateKnown?: boolean;
}

export interface PolicyEvaluation {
  findings: PolicyFinding[];
  tier: ApprovalTier;
  tierLabel: string;
  fundType: FundType;
  fundLabel: string;
  /** Approved to date from this fund, before the request under review. */
  usedLifetime: number;
  /** Balance before this request. */
  remainingLifetime: number;
  /** This request's amount (0 when unknown). */
  requestAmount: number;
  /** Balance after approving this request, clamped at 0. */
  remainingAfter: number;
  /** Amount by which this request would exceed the fund's lifetime cap (0 when within it). */
  overageAmount: number;
  /** Largest amount that complies with both the remaining balance and the $500 single-transaction limit. */
  maxPolicyCompliantAmount: number;
  projectedTotal: number;
  exceedsLifetimeCap: boolean;
  recommendation: Recommendation;
  recommendationLabel: string;
  decision: PolicyDecision;
  decisionLabel: string;
  decisionReason: string;
  /** Suggested amount when the decision is a reduced approval. */
  decisionAmount: number | null;
  /** Items the reviewer should resolve before approving. */
  blockers: string[];
  requiresRationale: boolean;
}

const INELIGIBLE_KEYWORDS: { keyword: string; label: string }[] = [
  { keyword: 'cash loan', label: 'personal cash loans' },
  { keyword: 'cash advance', label: 'personal cash loans' },
  { keyword: 'loan to', label: 'personal cash loans' },
  { keyword: 'traffic ticket', label: 'traffic tickets/fines' },
  { keyword: 'parking ticket', label: 'traffic tickets/fines' },
  { keyword: 'speeding', label: 'traffic tickets/fines' },
  { keyword: 'fine', label: 'tickets/fines' },
  { keyword: 'bail', label: 'bail/bond payments' },
  { keyword: 'bond payment', label: 'bail/bond payments' },
  { keyword: 'legal defense', label: 'legal defense fees' },
  { keyword: 'attorney', label: 'legal defense fees' },
  { keyword: 'lawyer', label: 'legal defense fees' },
  { keyword: 'gift card', label: 'gift cards without itemized receipts' },
  { keyword: 'entertainment', label: 'entertainment' },
  { keyword: 'concert', label: 'entertainment' },
  { keyword: 'tobacco', label: 'tobacco/alcohol' },
  { keyword: 'cigarette', label: 'tobacco/alcohol' },
  { keyword: 'alcohol', label: 'tobacco/alcohol' },
  { keyword: 'vacation', label: 'non-essential travel' },
  { keyword: 'monthly bill', label: 'reoccurring monthly personal bills' },
  { keyword: 'recurring bill', label: 'reoccurring monthly personal bills' },
  { keyword: 'subscription', label: 'reoccurring monthly personal bills' },
];

const CASH_PAYMENT_KEYWORDS = [
  'pay the participant',
  'pay participant',
  'cash to student',
  'cash to participant',
  'direct cash',
  'cash payment',
  'reimburse in cash',
  'venmo',
  'cash app',
  'zelle',
];

const ELIGIBLE_KEYWORDS: { keyword: string; label: string }[] = [
  { keyword: 'state id', label: 'State ID / vital records' },
  { keyword: 'birth certificate', label: 'State ID / vital records' },
  { keyword: 'id card', label: 'State ID / vital records' },
  { keyword: 'work boot', label: 'work tools/boots' },
  { keyword: 'boots', label: 'work tools/boots' },
  { keyword: 'tool', label: 'work tools/boots' },
  { keyword: 'uniform', label: 'initial work uniforms' },
  { keyword: 'transit', label: 'transportation passes' },
  { keyword: 'bus pass', label: 'transportation passes' },
  { keyword: 'ventra', label: 'transportation passes' },
  { keyword: 'transportation', label: 'transportation passes' },
  { keyword: 'background check', label: 'background check / expungement fees' },
  { keyword: 'expungement', label: 'background check / expungement fees' },
  { keyword: 'licens', label: 'professional licensing fees' },
  { keyword: 'certification', label: 'advanced training / licensing' },
  { keyword: 'tuition', label: 'advanced training tuition' },
  { keyword: 'auto repair', label: 'auto repairs for commuting' },
  { keyword: 'car repair', label: 'auto repairs for commuting' },
  { keyword: 'utility', label: 'emergency food/utilities' },
  { keyword: 'utilities', label: 'emergency food/utilities' },
  { keyword: 'groceries', label: 'emergency food/utilities' },
  { keyword: 'food', label: 'emergency food/utilities' },
  { keyword: 'rent', label: 'emergency rental assistance' },
];

function matchKeywords<T extends { keyword: string; label: string }>(haystack: string, list: T[]) {
  const labels = new Set<string>();
  for (const entry of list) {
    if (haystack.includes(entry.keyword)) labels.add(entry.label);
  }
  return Array.from(labels);
}

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const FUND_LABELS: Record<FundType, string> = {
  barrier: 'Barrier Mitigation Fund (active enrollment)',
  alumni: 'Alumni Support Fund (post-graduation)',
};

export function evaluateFinancialAssistance(input: PolicyEvaluationInput): PolicyEvaluation {
  const {
    requestedAmount,
    fundingPurpose,
    title,
    description,
    attachmentCount = 0,
    priorApprovedTotal = 0,
    priorHistoryKnown = true,
    amountFromApprovedRecord = false,
    fundType = 'barrier',
    graduationDateKnown = true,
  } = input;

  const amount = typeof requestedAmount === 'number' && requestedAmount > 0 ? requestedAmount : null;
  const haystack = [title, description, fundingPurpose].filter(Boolean).join(' \n ').toLowerCase();

  const findings: PolicyFinding[] = [];

  const usedLifetime = Math.max(0, priorApprovedTotal);
  const remainingLifetime = Math.max(0, LIFETIME_CAP - usedLifetime);
  const requestAmount = amount ?? 0;
  const projectedTotal = usedLifetime + requestAmount;
  const exceedsLifetimeCap = amount !== null && projectedTotal > LIFETIME_CAP;
  const remainingAfter = Math.max(0, LIFETIME_CAP - projectedTotal);
  const overageAmount = Math.max(0, projectedTotal - LIFETIME_CAP);
  const maxPolicyCompliantAmount = Math.min(remainingLifetime, SINGLE_DISBURSEMENT_CAP);
  const fundLabel = FUND_LABELS[fundType];

  // --- Fund routing ---
  if (graduationDateKnown) {
    findings.push({
      id: 'fund-type',
      severity: 'info',
      title: `Draws on the ${fundType === 'alumni' ? 'Alumni Support Fund' : 'Barrier Mitigation Fund'}`,
      detail:
        fundType === 'alumni'
          ? 'The request was submitted after the participant’s graduation date, so it draws on the post-placement Alumni Support Fund. The two funds are separate and non-transferable.'
          : 'The request was submitted before the participant’s graduation date, so it draws on the Barrier Mitigation Fund for active enrollment. The two funds are separate and non-transferable.',
    });
  } else {
    findings.push({
      id: 'graduation-unknown',
      severity: 'warning',
      title: 'Graduation date not recorded',
      detail:
        'No graduation date exists for this participant or their cohort, so the request is treated as Barrier Mitigation. Set the cohort graduation date (or the participant’s own) to confirm the correct fund.',
    });
  }

  // --- Amount / cap checks ---
  if (amount === null) {
    findings.push({
      id: 'missing-amount',
      severity: 'warning',
      title: 'No amount requested on record',
      detail:
        'All disbursements require a pre-approved dollar amount with third-party documentation. Confirm the amount before authorizing.',
    });
  } else {
    if (exceedsLifetimeCap) {
      findings.push({
        id: 'lifetime-cap',
        severity: 'critical',
        title: `Exceeds the ${formatUsd(LIFETIME_CAP)} lifetime cap for this fund`,
        detail: `${formatUsd(usedLifetime)} already approved from this fund. Balance before this request is ${formatUsd(
          remainingLifetime
        )}, so this request is ${formatUsd(overageAmount)} over the cap (total would reach ${formatUsd(
          projectedTotal
        )}).`,
      });
    } else if (remainingAfter <= 100) {
      findings.push({
        id: 'lifetime-near-cap',
        severity: 'info',
        title: 'Nearly exhausts the lifetime allocation',
        detail: `After this disbursement the participant would have ${formatUsd(
          remainingAfter
        )} left of the ${formatUsd(LIFETIME_CAP)} lifetime allocation for this fund.`,
      });
    }

    if (amount > SINGLE_DISBURSEMENT_CAP) {
      findings.push({
        id: 'single-disbursement-cap',
        severity: 'warning',
        title: `Single transaction over ${formatUsd(SINGLE_DISBURSEMENT_CAP)}`,
        detail: `Single transactions cannot exceed ${formatUsd(
          SINGLE_DISBURSEMENT_CAP
        )} without prior Executive Leadership approval, regardless of the remaining balance.`,
      });
    }
  }

  if (!priorHistoryKnown) {
    findings.push({
      id: 'history-unknown',
      severity: 'info',
      title: 'Prior disbursement history unavailable',
      detail:
        'The lifetime balance shown could not be confirmed from the record. Verify the remaining fund balance manually before approving.',
    });
  }

  if (amountFromApprovedRecord && amount !== null) {
    findings.push({
      id: 'legacy-amount-source',
      severity: 'info',
      title: 'Amount taken from the approved disbursement',
      detail:
        'This request has no requested amount on file, so the guidance uses the recorded approved amount. It predates the structured financial fields — verify the figures against the original documentation.',
    });
  }

  // --- Expense category guidance ---
  const ineligible = matchKeywords(haystack, INELIGIBLE_KEYWORDS);
  if (ineligible.length > 0) {
    findings.push({
      id: 'ineligible-expense',
      severity: 'critical',
      title: 'Possible strictly ineligible expense',
      detail: `Language in this request matches ineligible categories: ${ineligible.join(
        ', '
      )}. Confirm the actual expense before approving.`,
    });
  }

  const cashHit = CASH_PAYMENT_KEYWORDS.some((k) => haystack.includes(k));
  if (cashHit) {
    findings.push({
      id: 'direct-cash',
      severity: 'critical',
      title: 'Direct cash payment indicated',
      detail:
        'Direct cash payments to participants are strictly prohibited. Pay the vendor directly, purchase on the participant’s behalf, or use a restricted program card.',
    });
  }

  const eligible = matchKeywords(haystack, ELIGIBLE_KEYWORDS);
  if (eligible.length > 0 && ineligible.length === 0) {
    findings.push({
      id: 'eligible-expense',
      severity: 'info',
      title: 'Matches eligible expense categories',
      detail: `Consistent with: ${eligible.join(', ')}.`,
    });
  } else if (eligible.length === 0 && ineligible.length === 0) {
    findings.push({
      id: 'unclassified-expense',
      severity: 'warning',
      title: 'Expense category unclear',
      detail:
        'This request does not clearly match a listed eligible expense. Document how the expense removes a barrier or supports employment.',
    });
  }

  // --- Documentation & justification ---
  if (attachmentCount === 0) {
    findings.push({
      id: 'missing-documentation',
      severity: 'warning',
      title: 'No third-party documentation attached',
      detail:
        'All disbursements require third-party documentation (official invoice/bill, vendor estimate, or itemized receipt) before pre-approval.',
    });
  }

  const justification = (fundingPurpose ?? '').trim();
  if (justification.length < 20) {
    findings.push({
      id: 'missing-justification',
      severity: 'warning',
      title: 'Operational justification incomplete',
      detail:
        'The FARF requires a written justification describing how the expense impacts retention, barrier removal, or employment.',
    });
  }

  // --- Approval tier ---
  let tier: ApprovalTier = 'none';
  let tierLabel = 'Confirm amount to determine the approval tier';
  if (amount !== null) {
    if (amount <= DIRECTOR_TIER_MAX) {
      tier = 'director';
      tierLabel = 'Tier 1 — Program Director written approval';
    } else {
      tier = 'executive';
      tierLabel = 'Tier 2 — Program Director review + Executive Leadership approval';
    }
  }

  const hasCritical = findings.some((f) => f.severity === 'critical');
  const hasWarning = findings.some((f) => f.severity === 'warning');

  const recommendation: Recommendation = hasCritical
    ? 'not_recommended'
    : hasWarning
    ? 'conditional'
    : 'recommended';

  const recommendationLabel =
    recommendation === 'recommended'
      ? 'Recommended — consistent with policy'
      : recommendation === 'conditional'
      ? 'Recommend with conditions'
      : 'Not recommended per policy';

  const blockers = findings
    .filter((f) => f.severity === 'critical' || f.severity === 'warning')
    .map((f) => f.title);

  // --- Final recommended decision ---
  const blockingCritical = ineligible.length > 0 || cashHit;

  let decision: PolicyDecision;
  let decisionLabel: string;
  let decisionReason: string;
  let decisionAmount: number | null = null;

  if (blockingCritical) {
    decision = 'deny';
    decisionLabel = 'Do not approve';
    decisionReason = cashHit
      ? 'A direct cash payment to the participant is prohibited — restructure as a vendor payment before reconsidering.'
      : 'The expense appears to fall in a strictly ineligible category.';
  } else if (amount === null) {
    decision = 'needs_amount';
    decisionLabel = 'Confirm the amount before deciding';
    decisionReason = `No dollar amount is on record. ${formatUsd(
      remainingLifetime
    )} remains in this fund, and up to ${formatUsd(
      maxPolicyCompliantAmount
    )} can be approved in a single transaction without Executive Leadership sign-off.`;
  } else if (remainingLifetime === 0) {
    decision = 'deny';
    decisionLabel = 'Do not approve';
    decisionReason = `The participant has used the full ${formatUsd(
      LIFETIME_CAP
    )} lifetime allocation for this fund.`;
  } else if (amount > remainingLifetime) {
    decision = 'approve_reduced';
    decisionAmount = maxPolicyCompliantAmount;
    decisionLabel = `Approve a reduced amount of ${formatUsd(maxPolicyCompliantAmount)}`;
    decisionReason = `The request is ${formatUsd(
      overageAmount
    )} over the remaining balance of ${formatUsd(remainingLifetime)} for this fund.`;
  } else if (amount > SINGLE_DISBURSEMENT_CAP) {
    decision = 'approve_with_executive';
    decisionLabel = 'Approve only with Executive Leadership sign-off';
    decisionReason = `The amount is within the remaining balance of ${formatUsd(
      remainingLifetime
    )} but above the ${formatUsd(
      SINGLE_DISBURSEMENT_CAP
    )} single-transaction limit, so it needs Tier 2 approval. Reducing it to ${formatUsd(
      maxPolicyCompliantAmount
    )} would keep it at Tier 1.`;
    decisionAmount = maxPolicyCompliantAmount;
  } else {
    decision = 'approve';
    decisionLabel = 'Approve as requested';
    decisionReason =
      blockers.length > 0
        ? `Within the caps for this fund; ${formatUsd(
            remainingAfter
          )} would remain. Resolve the open items below first.`
        : `Within the caps for this fund, documented and eligible; ${formatUsd(
            remainingAfter
          )} would remain.`;
  }

  return {
    findings,
    tier,
    tierLabel,
    fundType,
    fundLabel,
    usedLifetime,
    remainingLifetime,
    requestAmount,
    remainingAfter,
    overageAmount,
    maxPolicyCompliantAmount,
    projectedTotal,
    exceedsLifetimeCap,
    recommendation,
    recommendationLabel,
    decision,
    decisionLabel,
    decisionReason,
    decisionAmount,
    blockers,
    requiresRationale: recommendation !== 'recommended',
  };
}
