import { describe, it, expect } from 'vitest';
import {
  evaluateFinancialAssistance,
  LIFETIME_CAP,
  SINGLE_DISBURSEMENT_CAP,
} from './financialAssistancePolicy';

const clean = {
  requestedAmount: 250,
  title: 'Work boots for placement',
  description: 'Steel toe work boots required by the employer for the first shift.',
  fundingPurpose:
    'Barrier Mitigation fund: employer requires steel toe boots before the participant can start work.',
  attachmentCount: 1,
  priorApprovedTotal: 0,
};

describe('evaluateFinancialAssistance', () => {
  it('recommends a clean, documented, eligible request', () => {
    const result = evaluateFinancialAssistance(clean);
    expect(result.recommendation).toBe('recommended');
    expect(result.requiresRationale).toBe(false);
    expect(result.tier).toBe('director');
  });

  it('computes remaining lifetime balance and flags cap overruns', () => {
    const result = evaluateFinancialAssistance({ ...clean, requestedAmount: 400, priorApprovedTotal: 800 });
    expect(result.remainingLifetime).toBe(200);
    expect(result.projectedTotal).toBe(1200);
    expect(result.exceedsLifetimeCap).toBe(true);
    expect(result.findings.some((f) => f.id === 'lifetime-cap' && f.severity === 'critical')).toBe(true);
    expect(result.recommendation).toBe('not_recommended');
  });

  it('does not flag a request that exactly reaches the lifetime cap', () => {
    const result = evaluateFinancialAssistance({
      ...clean,
      requestedAmount: 200,
      priorApprovedTotal: LIFETIME_CAP - 200,
    });
    expect(result.exceedsLifetimeCap).toBe(false);
    expect(result.findings.some((f) => f.id === 'lifetime-cap')).toBe(false);
  });

  it('keeps Tier 1 at the $500 boundary and escalates just above it', () => {
    expect(evaluateFinancialAssistance({ ...clean, requestedAmount: SINGLE_DISBURSEMENT_CAP }).tier).toBe(
      'director'
    );
    const above = evaluateFinancialAssistance({ ...clean, requestedAmount: 500.01 });
    expect(above.tier).toBe('executive');
    expect(above.findings.some((f) => f.id === 'single-disbursement-cap')).toBe(true);
  });

  it('treats $1,000 as Tier 2 requiring executive approval', () => {
    const result = evaluateFinancialAssistance({ ...clean, requestedAmount: 1000 });
    expect(result.tier).toBe('executive');
    expect(result.tierLabel).toContain('Executive Leadership');
  });

  it('flags strictly ineligible expenses', () => {
    const result = evaluateFinancialAssistance({
      ...clean,
      description: 'Needs help paying a traffic ticket and bail bond.',
    });
    expect(result.findings.some((f) => f.id === 'ineligible-expense' && f.severity === 'critical')).toBe(true);
    expect(result.recommendation).toBe('not_recommended');
  });

  it('flags direct cash payment language', () => {
    const result = evaluateFinancialAssistance({
      ...clean,
      description: 'Please send a direct cash payment to the participant via Cash App.',
    });
    expect(result.findings.some((f) => f.id === 'direct-cash')).toBe(true);
  });

  it('warns when documentation and justification are missing', () => {
    const result = evaluateFinancialAssistance({
      requestedAmount: 120,
      title: 'Help needed',
      description: 'Support please',
      fundingPurpose: null,
      attachmentCount: 0,
      priorApprovedTotal: 0,
    });
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('missing-documentation');
    expect(ids).toContain('missing-justification');
    expect(result.recommendation).toBe('conditional');
    expect(result.requiresRationale).toBe(true);
  });

  it('warns when no amount is recorded and reports no tier', () => {
    const result = evaluateFinancialAssistance({ ...clean, requestedAmount: null });
    expect(result.findings.some((f) => f.id === 'missing-amount')).toBe(true);
    expect(result.tier).toBe('none');
  });

  it('notes when prior history could not be confirmed', () => {
    const result = evaluateFinancialAssistance({ ...clean, priorHistoryKnown: false });
    expect(result.findings.some((f) => f.id === 'history-unknown')).toBe(true);
  });
});

describe('legacy money requests', () => {
  const legacyBase = {
    fundingPurpose:
      'Barrier Mitigation Fund: work boots required before the participant starts their placement.',
    title: 'Work boots',
    description: 'Vendor invoice attached for steel-toe work boots.',
    attachmentCount: 1,
  };

  it('notes when the amount came from the approved disbursement', () => {
    const result = evaluateFinancialAssistance({
      ...legacyBase,
      requestedAmount: 200,
      amountFromApprovedRecord: true,
    });
    expect(result.findings.some((f) => f.id === 'legacy-amount-source')).toBe(true);
    expect(result.tier).toBe('director');
    expect(result.projectedTotal).toBe(200);
  });

  it('does not add the legacy note for normal requests', () => {
    const result = evaluateFinancialAssistance({ ...legacyBase, requestedAmount: 200 });
    expect(result.findings.some((f) => f.id === 'legacy-amount-source')).toBe(false);
  });

  it('does not add the legacy note when no amount is known', () => {
    const result = evaluateFinancialAssistance({
      ...legacyBase,
      requestedAmount: null,
      amountFromApprovedRecord: true,
    });
    expect(result.findings.some((f) => f.id === 'legacy-amount-source')).toBe(false);
  });
});

describe('balance math', () => {
  it('reports before/after balances and clamps at zero', () => {
    const result = evaluateFinancialAssistance({ ...clean, requestedAmount: 300, priorApprovedTotal: 600 });
    expect(result.remainingLifetime).toBe(400);
    expect(result.requestAmount).toBe(300);
    expect(result.remainingAfter).toBe(100);
    expect(result.overageAmount).toBe(0);

    const over = evaluateFinancialAssistance({ ...clean, requestedAmount: 300, priorApprovedTotal: 900 });
    expect(over.remainingAfter).toBe(0);
    expect(over.overageAmount).toBe(200);
  });

  it('caps the policy-compliant amount at the single-transaction limit', () => {
    expect(evaluateFinancialAssistance({ ...clean, priorApprovedTotal: 0 }).maxPolicyCompliantAmount).toBe(
      SINGLE_DISBURSEMENT_CAP
    );
    expect(
      evaluateFinancialAssistance({ ...clean, priorApprovedTotal: 850 }).maxPolicyCompliantAmount
    ).toBe(150);
  });

  it('only flags the near-cap note when the request stays within the cap', () => {
    const within = evaluateFinancialAssistance({ ...clean, requestedAmount: 400, priorApprovedTotal: 550 });
    expect(within.findings.some((f) => f.id === 'lifetime-near-cap')).toBe(true);
    const over = evaluateFinancialAssistance({ ...clean, requestedAmount: 400, priorApprovedTotal: 800 });
    expect(over.findings.some((f) => f.id === 'lifetime-near-cap')).toBe(false);
  });
});

describe('final recommended decision', () => {
  it('approves a clean request', () => {
    expect(evaluateFinancialAssistance(clean).decision).toBe('approve');
  });

  it('recommends a reduced amount when over the remaining balance', () => {
    const result = evaluateFinancialAssistance({ ...clean, requestedAmount: 400, priorApprovedTotal: 800 });
    expect(result.decision).toBe('approve_reduced');
    expect(result.decisionAmount).toBe(200);
  });

  it('requires executive sign-off above the single-transaction limit', () => {
    const result = evaluateFinancialAssistance({ ...clean, requestedAmount: 750 });
    expect(result.decision).toBe('approve_with_executive');
    expect(result.decisionAmount).toBe(SINGLE_DISBURSEMENT_CAP);
  });

  it('denies when the fund allocation is exhausted', () => {
    const result = evaluateFinancialAssistance({
      ...clean,
      requestedAmount: 100,
      priorApprovedTotal: LIFETIME_CAP,
    });
    expect(result.decision).toBe('deny');
  });

  it('denies ineligible expenses and direct cash', () => {
    expect(
      evaluateFinancialAssistance({ ...clean, description: 'Pay a traffic ticket' }).decision
    ).toBe('deny');
    expect(
      evaluateFinancialAssistance({ ...clean, description: 'Send a direct cash payment via Zelle' })
        .decision
    ).toBe('deny');
  });

  it('asks to confirm the amount when none is recorded', () => {
    expect(evaluateFinancialAssistance({ ...clean, requestedAmount: null }).decision).toBe(
      'needs_amount'
    );
  });
});

describe('fund routing', () => {
  it('labels the alumni fund and notes the barrier fund by default', () => {
    const alumni = evaluateFinancialAssistance({ ...clean, fundType: 'alumni' });
    expect(alumni.fundType).toBe('alumni');
    expect(alumni.fundLabel).toContain('Alumni');
    expect(alumni.findings.some((f) => f.id === 'fund-type')).toBe(true);

    const barrier = evaluateFinancialAssistance(clean);
    expect(barrier.fundType).toBe('barrier');
    expect(barrier.fundLabel).toContain('Barrier');
  });

  it('warns when no graduation date is recorded', () => {
    const result = evaluateFinancialAssistance({ ...clean, graduationDateKnown: false });
    expect(result.findings.some((f) => f.id === 'graduation-unknown')).toBe(true);
    expect(result.recommendation).toBe('conditional');
  });
});
