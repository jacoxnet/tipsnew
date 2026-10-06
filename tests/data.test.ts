import { describe, expect, it } from 'vitest';
import { computeDailyCpi, withIndexRatios } from '../src/lib/data';
import { firstOfMonth, todayNY } from '../src/lib/dates';

const cpi = [
  { as_of_date: '2026-06-01', cpi_value: 330.0 },
  { as_of_date: '2026-07-01', cpi_value: 331.55 },
  { as_of_date: '2026-08-01', cpi_value: 332.0 },
];

describe('computeDailyCpi', () => {
  it('interpolates between the CPI from three and two months ago', () => {
    // 2026-10-16 in New York: uses July (3 months ago) and August (2 months ago), 31 days in October
    const now = new Date('2026-10-16T16:00:00Z');
    const result = computeDailyCpi(cpi, now);
    expect(result.warning).toBeUndefined();
    expect(result.value).toBeCloseTo(331.55 + (15 * (332.0 - 331.55)) / 31, 10);
  });

  it('uses the New York date, not UTC', () => {
    // 02:00 UTC on Oct 1 is still Sept 30 in New York: June and July CPI, 30 days in September
    const result = computeDailyCpi(cpi, new Date('2026-10-01T02:00:00Z'));
    expect(result.value).toBeCloseTo(330.0 + (29 * (331.55 - 330.0)) / 30, 10);
  });

  it('falls back to the latest two months with a warning when CPI is missing', () => {
    const result = computeDailyCpi(cpi, new Date('2026-12-05T16:00:00Z'));
    expect(result.warning).toMatch(/not yet available/);
    expect(result.value).toBeCloseTo(331.55 + (4 * (332.0 - 331.55)) / 31, 10);
  });
});

describe('index ratios and dates', () => {
  it('rounds index ratios to 5 places', () => {
    const [t] = withIndexRatios(
      [{ cusip: 'X', dated_date: '2020-01-15', maturity_date: '2030-01-15', coupon_rate: 0.125, ref_cpi: 257.97 }],
      331.123456,
    );
    expect(t.index_ratio).toBe(1.28357);
  });

  it('computes month offsets across year boundaries', () => {
    expect(firstOfMonth(2026, 2, -3)).toBe('2025-11-01');
    expect(firstOfMonth(2026, 12, 1)).toBe('2027-01-01');
    expect(todayNY(new Date('2026-01-01T03:00:00Z'))).toEqual({ year: 2025, month: 12, day: 31 });
  });
});
