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

  it('warns when documentation, justification, and fund type are missing', () => {
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
    expect(ids).toContain('missing-fund-type');
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
