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

export interface PolicyEvaluationInput {
  requestedAmount?: number | null;
  fundingPurpose?: string | null;
  title?: string | null;
  description?: string | null;
  attachmentCount?: number;
  /** Sum of previously approved amounts for this participant's financial requests. */
  priorApprovedTotal?: number;
  priorHistoryKnown?: boolean;
  /**
   * True when `requestedAmount` was taken from an already-approved amount because the
   * record has no requested amount (legacy request predating the structured fields).
   */
  amountFromApprovedRecord?: boolean;
}

export interface PolicyEvaluation {
  findings: PolicyFinding[];
  tier: ApprovalTier;
  tierLabel: string;
  usedLifetime: number;
  remainingLifetime: number;
  projectedTotal: number;
  exceedsLifetimeCap: boolean;
  recommendation: Recommendation;
  recommendationLabel: string;
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

const FUND_TYPE_KEYWORDS = ['barrier mitigation', 'alumni support', 'alumni fund', 'barrier fund'];

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
  } = input;

  const amount = typeof requestedAmount === 'number' && requestedAmount > 0 ? requestedAmount : null;
  const haystack = [title, description, fundingPurpose].filter(Boolean).join(' \n ').toLowerCase();

  const findings: PolicyFinding[] = [];

  const usedLifetime = Math.max(0, priorApprovedTotal);
  const remainingLifetime = Math.max(0, LIFETIME_CAP - usedLifetime);
  const projectedTotal = usedLifetime + (amount ?? 0);
  const exceedsLifetimeCap = amount !== null && projectedTotal > LIFETIME_CAP;

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
        title: `Exceeds the ${formatUsd(LIFETIME_CAP)} lifetime cap`,
        detail: `${formatUsd(usedLifetime)} already approved for this participant. Remaining balance is ${formatUsd(
          remainingLifetime
        )}, but this request would bring the total to ${formatUsd(projectedTotal)}.`,
      });
    } else if (remainingLifetime - amount <= 100) {
      findings.push({
        id: 'lifetime-near-cap',
        severity: 'info',
        title: 'Nearly exhausts the lifetime allocation',
        detail: `After this disbursement the participant would have ${formatUsd(
          Math.max(0, remainingLifetime - amount)
        )} left of the ${formatUsd(LIFETIME_CAP)} lifetime cap.`,
      });
    }

    if (amount > SINGLE_DISBURSEMENT_CAP) {
      findings.push({
        id: 'single-disbursement-cap',
        severity: 'warning',
        title: `Single transaction over ${formatUsd(SINGLE_DISBURSEMENT_CAP)}`,
        detail:
          'Single transactions cannot exceed $500 without prior Executive Leadership approval, regardless of the remaining balance.',
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

  const fundTypeStated = FUND_TYPE_KEYWORDS.some((k) => haystack.includes(k));
  if (!fundTypeStated) {
    findings.push({
      id: 'missing-fund-type',
      severity: 'warning',
      title: 'Fund type not indicated',
      detail:
        'Confirm whether this draws on the Barrier Mitigation Fund (active enrollment) or the Alumni Support Fund (post-placement). The funds are separate and non-transferable.',
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

  return {
    findings,
    tier,
    tierLabel,
    usedLifetime,
    remainingLifetime,
    projectedTotal,
    exceedsLifetimeCap,
    recommendation,
    recommendationLabel,
    requiresRationale: recommendation !== 'recommended',
  };
}
