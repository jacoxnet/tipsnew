import { describe, expect, it } from 'vitest';
import { calculateLadder, inflationFactor, ladderTotals } from '../src/lib/ladder';
import { ref, tipsByCusip } from './fixtures';

describe('calculateLadder matches the original Python implementation', () => {
  for (const scenario of ref.ladder_scenarios) {
    it(scenario.name, () => {
      const actual = calculateLadder(scenario.specs, ref.holdings, tipsByCusip, ref.cpi);
      expect(actual).toHaveLength(scenario.expected.length);
      actual.forEach((row, i) => {
        const expected = scenario.expected[i];
        expect(Object.keys(row).sort()).toEqual(Object.keys(expected).sort());
        for (const [key, value] of Object.entries(expected)) {
          expect(row[key as keyof typeof row], `${scenario.name} ${row.year} ${key}`).toBeCloseTo(value, 6);
        }
      });
    });
  }
});

describe('ladder helpers', () => {
  const base = ref.ladder_scenarios[0].specs;

  it('ignores holdings whose CUSIP is unknown', () => {
    const withUnknown = [...ref.holdings, { cusip: 'NOPE', account_type: 'roth' as const, quantity: 99 }];
    expect(calculateLadder(base, withUnknown, tipsByCusip, ref.cpi)).toEqual(
      calculateLadder(base, ref.holdings, tipsByCusip, ref.cpi),
    );
  });

  it('uses an inflation factor of 1 when the as-of CPI is missing', () => {
    expect(inflationFactor({ ...base, inflate_base_cf: true, base_cash_flow_date: '1990-01-01' }, ref.cpi)).toBe(1);
  });

  it('totals balances and shortfalls', () => {
    const years = calculateLadder(base, ref.holdings, tipsByCusip, ref.cpi);
    const totals = ladderTotals(years);
    const sum = years.reduce((s, r) => s + r.balance, 0);
    expect(totals.total_balance).toBeCloseTo(sum, 9);
    expect(totals.total_shortfall).toBeCloseTo(sum < 0 ? -sum : 0, 9);
  });
});
