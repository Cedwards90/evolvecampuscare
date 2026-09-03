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
/** Alumni Support is available up to 12 months after graduation / placement. */
export const ALUMNI_WINDOW_MONTHS = 12;

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
  | 'needs_amount'
  | 'needs_more_info';

export type EligibilityVerdict = 'eligible' | 'ineligible' | 'wrong_fund' | 'unclear';

export interface PolicyLineItem {
  label: string;
  amount: number;
  isEligible: boolean;
}

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
  /** Whole months between graduation and the request date (alumni requests only). */
  monthsSinceGraduation?: number | null;
  /** Optional reviewer breakdown; when present it drives the qualifying amount. */
  lineItems?: PolicyLineItem[];
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
  /** Balance after approving the recommended amount, clamped at 0. */
  remainingAfter: number;
  /** Amount by which this request would exceed the fund's lifetime cap (0 when within it). */
  overageAmount: number;
  /** Largest amount that complies with both the remaining balance and the $500 single-transaction limit. */
  maxPolicyCompliantAmount: number;
  projectedTotal: number;
  exceedsLifetimeCap: boolean;
  /** What the request appears to be for, judged against the active fund's lists. */
  eligibility: EligibilityVerdict;
  eligibilityDetail: string;
  /** Manual rule(s) that drove the eligibility verdict. */
  matchedCategories: string[];
  /** Portion of the request that qualifies under policy (before caps). */
  qualifyingAmount: number | null;
  /** Portion excluded by reviewer line items. */
  ineligibleLineTotal: number;
  hasLineItems: boolean;
  recommendation: Recommendation;
  recommendationLabel: string;
  decision: PolicyDecision;
  decisionLabel: string;
  decisionReason: string;
  /** Suggested amount when the decision is a full or reduced approval. */
  decisionAmount: number | null;
  /** Why the recommended amount is lower than what was requested. */
  reductionReason: string | null;
  /** Items the reviewer should resolve before approving. */
  blockers: string[];
  requiresRationale: boolean;
}

interface KeywordRule {
  keyword: string;
  label: string;
}

/** Ineligible under BOTH funds — never payable from program funds. */
const UNIVERSAL_INELIGIBLE: KeywordRule[] = [
  { keyword: 'cash loan', label: 'personal cash loans' },
  { keyword: 'cash advance', label: 'personal cash loans' },
  { keyword: 'loan to', label: 'personal cash loans' },
  { keyword: 'traffic ticket', label: 'traffic tickets / fines' },
  { keyword: 'parking ticket', label: 'traffic tickets / fines' },
  { keyword: 'speeding', label: 'traffic tickets / fines' },
  { keyword: 'bail', label: 'bail / bond payments' },
  { keyword: 'bond payment', label: 'bail / bond payments' },
  { keyword: 'legal defense', label: 'legal defense fees' },
  { keyword: 'attorney', label: 'legal defense fees' },
  { keyword: 'lawyer', label: 'legal defense fees' },
  { keyword: 'entertainment', label: 'entertainment' },
  { keyword: 'concert', label: 'entertainment' },
  { keyword: 'tobacco', label: 'tobacco / alcohol' },
  { keyword: 'cigarette', label: 'tobacco / alcohol' },
  { keyword: 'alcohol', label: 'tobacco / alcohol' },
  { keyword: 'gift card', label: 'gift cards without itemized receipts' },
  { keyword: 'vacation', label: 'non-essential travel' },
  { keyword: 'secondary party', label: 'secondary party transfers' },
];

const BARRIER_INELIGIBLE: KeywordRule[] = [];

const ALUMNI_INELIGIBLE: KeywordRule[] = [
  { keyword: 'monthly bill', label: 'reoccurring monthly personal bills' },
  { keyword: 'recurring bill', label: 'reoccurring monthly personal bills' },
  { keyword: 'subscription', label: 'reoccurring monthly personal bills' },
];

const BARRIER_ELIGIBLE: KeywordRule[] = [
  { keyword: 'state id', label: 'State ID / birth certificate' },
  { keyword: 'birth certificate', label: 'State ID / birth certificate' },
  { keyword: 'id card', label: 'State ID / birth certificate' },
  { keyword: 'work boot', label: 'work tools / boots' },
  { keyword: 'boots', label: 'work tools / boots' },
  { keyword: 'tool', label: 'work tools / boots' },
  { keyword: 'uniform', label: 'initial work uniforms' },
  { keyword: 'transit', label: 'transportation passes' },
  { keyword: 'bus pass', label: 'transportation passes' },
  { keyword: 'ventra', label: 'transportation passes' },
  { keyword: 'transportation', label: 'transportation passes' },
  { keyword: 'background check', label: 'background check / expungement filing fees' },
  { keyword: 'expungement', label: 'background check / expungement filing fees' },
  { keyword: 'utility', label: 'emergency food / utilities' },
  { keyword: 'utilities', label: 'emergency food / utilities' },
  { keyword: 'groceries', label: 'emergency food / utilities' },
  { keyword: 'food', label: 'emergency food / utilities' },
];

const ALUMNI_ELIGIBLE: KeywordRule[] = [
  { keyword: 'licens', label: 'professional licensing fees' },
  { keyword: 'certification', label: 'advanced training / licensing' },
  { keyword: 'tuition', label: 'advanced training tuition' },
  { keyword: 'training', label: 'advanced training tuition' },
  { keyword: 'auto repair', label: 'auto repairs for commuting' },
  { keyword: 'car repair', label: 'auto repairs for commuting' },
  { keyword: 'mechanic', label: 'auto repairs for commuting' },
  { keyword: 'equipment', label: 'specialized equipment' },
  { keyword: 'rent', label: 'emergency rental assistance' },
  { keyword: 'rental assistance', label: 'emergency rental assistance' },
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

function matchKeywords(haystack: string, list: KeywordRule[]) {
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
  alumni: 'Alumni Support Fund (post-placement)',
};

export const FUND_ELIGIBLE_SUMMARY: Record<FundType, string> = {
  barrier:
    'State ID / birth certificates, work tools and boots, transportation passes, background check or expungement filing fees, initial work uniforms, emergency food and utilities.',
  alumni:
    'Professional licensing fees, advanced training tuition, auto repairs for commuting, specialized equipment, emergency rental assistance.',
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
    monthsSinceGraduation = null,
    lineItems = [],
  } = input;

  const amount = typeof requestedAmount === 'number' && requestedAmount > 0 ? requestedAmount : null;
  const haystack = [title, description, fundingPurpose].filter(Boolean).join(' \n ').toLowerCase();

  const findings: PolicyFinding[] = [];

  const usedLifetime = Math.max(0, priorApprovedTotal);
  const remainingLifetime = Math.max(0, LIFETIME_CAP - usedLifetime);
  const requestAmount = amount ?? 0;
  const projectedTotal = usedLifetime + requestAmount;
  const exceedsLifetimeCap = amount !== null && projectedTotal > LIFETIME_CAP;
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
          ? 'The request is dated on or after the participant’s graduation date, so it draws on the post-placement Alumni Support Fund. The two funds are separate and non-transferable.'
          : 'The request is dated before the participant’s graduation date, so it draws on the Barrier Mitigation Fund for active enrollment. The two funds are separate and non-transferable.',
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

  const alumniWindowExpired =
    fundType === 'alumni' &&
    typeof monthsSinceGraduation === 'number' &&
    monthsSinceGraduation > ALUMNI_WINDOW_MONTHS;

  if (alumniWindowExpired) {
    findings.push({
      id: 'alumni-window-expired',
      severity: 'critical',
      title: `Outside the ${ALUMNI_WINDOW_MONTHS}-month Alumni Support window`,
      detail: `Alumni Support is allocated up to ${ALUMNI_WINDOW_MONTHS} months after graduation. This request is dated about ${monthsSinceGraduation} months post-graduation, so it is not eligible for program funds.`,
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

  // --- Eligibility: what is being requested, judged against the active fund ---
  const activeIneligible = matchKeywords(haystack, [
    ...UNIVERSAL_INELIGIBLE,
    ...(fundType === 'alumni' ? ALUMNI_INELIGIBLE : BARRIER_INELIGIBLE),
  ]);
  const otherFundIneligible = matchKeywords(
    haystack,
    fundType === 'alumni' ? BARRIER_INELIGIBLE : ALUMNI_INELIGIBLE
  );
  const ineligible = Array.from(new Set([...activeIneligible, ...otherFundIneligible]));

  const sameFundEligible = matchKeywords(
    haystack,
    fundType === 'alumni' ? ALUMNI_ELIGIBLE : BARRIER_ELIGIBLE
  );
  const otherFundEligible = matchKeywords(
    haystack,
    fundType === 'alumni' ? BARRIER_ELIGIBLE : ALUMNI_ELIGIBLE
  );

  let eligibility: EligibilityVerdict;
  let eligibilityDetail: string;
  let matchedCategories: string[];

  if (ineligible.length > 0) {
    eligibility = 'ineligible';
    matchedCategories = ineligible;
    eligibilityDetail = `Language in this request matches strictly ineligible categories: ${ineligible.join(
      ', '
    )}. Program funds cannot cover these under either fund.`;
    findings.push({
      id: 'ineligible-expense',
      severity: 'critical',
      title: 'Strictly ineligible expense indicated',
      detail: eligibilityDetail,
    });
  } else if (sameFundEligible.length > 0) {
    eligibility = 'eligible';
    matchedCategories = sameFundEligible;
    eligibilityDetail = `Consistent with ${FUND_LABELS[fundType]} eligible expenses: ${sameFundEligible.join(
      ', '
    )}.`;
    findings.push({
      id: 'eligible-expense',
      severity: 'info',
      title: 'Matches an eligible expense for this fund',
      detail: eligibilityDetail,
    });
  } else if (otherFundEligible.length > 0) {
    eligibility = 'wrong_fund';
    matchedCategories = otherFundEligible;
    eligibilityDetail = `The expense (${otherFundEligible.join(', ')}) is listed under the ${
      fundType === 'alumni' ? FUND_LABELS.barrier : FUND_LABELS.alumni
    }, not the fund this request draws on. Confirm the participant’s enrollment status and the correct fund before approving.`;
    findings.push({
      id: 'wrong-fund-expense',
      severity: 'warning',
      title: 'Expense belongs to the other fund',
      detail: eligibilityDetail,
    });
  } else {
    eligibility = 'unclear';
    matchedCategories = [];
    eligibilityDetail = `This request does not clearly match a listed eligible expense for the ${FUND_LABELS[fundType]}. Eligible expenses are: ${FUND_ELIGIBLE_SUMMARY[fundType]} Needs reviewer confirmation.`;
    findings.push({
      id: 'unclassified-expense',
      severity: 'warning',
      title: 'Expense category unclear — needs reviewer confirmation',
      detail: eligibilityDetail,
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

  // --- Line items / qualifying portion ---
  const hasLineItems = lineItems.length > 0;
  const eligibleLineTotal = lineItems
    .filter((li) => li.isEligible)
    .reduce((sum, li) => sum + (Number(li.amount) || 0), 0);
  const ineligibleLineTotal = lineItems
    .filter((li) => !li.isEligible)
    .reduce((sum, li) => sum + (Number(li.amount) || 0), 0);

  if (hasLineItems && ineligibleLineTotal > 0) {
    findings.push({
      id: 'partially-eligible',
      severity: 'warning',
      title: 'Only part of the request qualifies',
      detail: `${formatUsd(
        ineligibleLineTotal
      )} of the itemized request was marked ineligible, leaving ${formatUsd(
        eligibleLineTotal
      )} that can be considered.`,
    });
  }

  const baseAmount = hasLineItems ? eligibleLineTotal : amount;
  const qualifyingAmount =
    baseAmount === null ? null : Math.max(0, Math.min(baseAmount, remainingLifetime));

  // --- Approval tier (based on what would actually be disbursed) ---
  const tierBasis = qualifyingAmount ?? amount;
  let tier: ApprovalTier = 'none';
  let tierLabel = 'Confirm amount to determine the approval tier';
  if (tierBasis !== null && tierBasis > 0) {
    if (tierBasis <= DIRECTOR_TIER_MAX) {
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
  let decision: PolicyDecision;
  let decisionLabel: string;
  let decisionReason: string;
  let decisionAmount: number | null = null;
  let reductionReason: string | null = null;

  const fullyIneligible = eligibility === 'ineligible' && !hasLineItems;

  if (cashHit) {
    decision = 'deny';
    decisionLabel = 'Do not approve as submitted';
    decisionReason =
      'A direct cash payment to the participant is prohibited — restructure as a vendor payment before reconsidering.';
  } else if (alumniWindowExpired) {
    decision = 'deny';
    decisionLabel = 'Do not approve';
    decisionReason = `The request falls outside the ${ALUMNI_WINDOW_MONTHS}-month Alumni Support window, so no program funds are available.`;
  } else if (fullyIneligible) {
    decision = 'deny';
    decisionLabel = 'Do not approve';
    decisionReason =
      'The expense appears to fall in a strictly ineligible category. Itemize the request if only part of it is ineligible.';
  } else if (baseAmount === null) {
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
  } else if (eligibility === 'unclear' || eligibility === 'wrong_fund' || attachmentCount === 0) {
    decision = 'needs_more_info';
    decisionLabel = 'Needs more information before a decision';
    decisionReason =
      eligibility === 'wrong_fund'
        ? 'Confirm the participant’s enrollment status so the expense is charged to the correct fund, then re-review.'
        : eligibility === 'unclear'
        ? `Confirm what the funds will buy and that it matches an eligible expense for this fund (${FUND_ELIGIBLE_SUMMARY[fundType]}).`
        : 'Third-party documentation (invoice, estimate, or vendor bill) is required before any disbursement can be pre-approved.';
    decisionAmount = Math.min(qualifyingAmount ?? 0, maxPolicyCompliantAmount) || null;
  } else if (qualifyingAmount !== null && amount !== null && qualifyingAmount < amount) {
    decision = 'approve_reduced';
    decisionAmount = Math.min(qualifyingAmount, SINGLE_DISBURSEMENT_CAP);
    decisionLabel = `Approve a reduced amount of ${formatUsd(decisionAmount)}`;
    reductionReason =
      hasLineItems && ineligibleLineTotal > 0 && eligibleLineTotal > remainingLifetime
        ? `${formatUsd(ineligibleLineTotal)} is ineligible and the remaining balance for this fund is ${formatUsd(
            remainingLifetime
          )}.`
        : hasLineItems && ineligibleLineTotal > 0
        ? `${formatUsd(ineligibleLineTotal)} of the itemized request is ineligible under this fund.`
        : `The request is ${formatUsd(overageAmount)} over the remaining balance of ${formatUsd(
            remainingLifetime
          )} for this fund.`;
    if (decisionAmount < qualifyingAmount) {
      reductionReason += ` The ${formatUsd(
        SINGLE_DISBURSEMENT_CAP
      )} single-transaction limit also applies without Executive Leadership approval.`;
    }
    decisionReason = reductionReason;
  } else if ((qualifyingAmount ?? 0) > SINGLE_DISBURSEMENT_CAP) {
    decision = 'approve_with_executive';
    decisionAmount = qualifyingAmount;
    decisionLabel = 'Approve only with Executive Leadership sign-off';
    decisionReason = `${formatUsd(
      qualifyingAmount ?? 0
    )} is within the remaining balance of ${formatUsd(remainingLifetime)} but above the ${formatUsd(
      SINGLE_DISBURSEMENT_CAP
    )} single-transaction limit, so it needs Tier 2 approval. Reducing it to ${formatUsd(
      maxPolicyCompliantAmount
    )} would keep it at Tier 1.`;
  } else {
    decision = 'approve';
    decisionAmount = qualifyingAmount;
    decisionLabel = `Approve ${formatUsd(qualifyingAmount ?? 0)}`;
    decisionReason =
      blockers.length > 0
        ? `Within the caps for this fund; ${formatUsd(
            Math.max(0, remainingLifetime - (qualifyingAmount ?? 0))
          )} would remain. Resolve the open items below first.`
        : `Eligible, documented, and within the caps for this fund; ${formatUsd(
            Math.max(0, remainingLifetime - (qualifyingAmount ?? 0))
          )} would remain.`;
  }

  const remainingAfter = Math.max(
    0,
    remainingLifetime - (decisionAmount ?? qualifyingAmount ?? requestAmount)
  );

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
    eligibility,
    eligibilityDetail,
    matchedCategories,
    qualifyingAmount,
    ineligibleLineTotal,
    hasLineItems,
    recommendation,
    recommendationLabel,
    decision,
    decisionLabel,
    decisionReason,
    decisionAmount,
    reductionReason,
    blockers,
    requiresRationale: decision !== 'approve',
  };
}
