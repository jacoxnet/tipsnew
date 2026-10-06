import { describe, expect, it } from 'vitest';
import { applyUpdate, buildHoldingRows, changeList, changeListCsv, mergeDuplicates, snapshotOf } from '../src/lib/holdings';
import type { Holding } from '../src/lib/types';
import { ref, tipsByCusip } from './fixtures';

const [a, b, c] = ref.tips.map((t) => t.cusip);

describe('holdings', () => {
  it('merges duplicate positions by CUSIP and account type', () => {
    const merged = mergeDuplicates([
      { cusip: a, account_type: 'roth', quantity: 2 },
      { cusip: a, account_type: 'roth', quantity: 3 },
      { cusip: a, account_type: 'pretax', quantity: 1 },
    ]);
    expect(merged).toEqual([
      { cusip: a, account_type: 'roth', quantity: 5 },
      { cusip: a, account_type: 'pretax', quantity: 1 },
    ]);
  });

  it('keeps removed snapshot positions at quantity 0 and drops other removed positions', () => {
    const snapshot = snapshotOf([
      { cusip: a, account_type: 'roth', quantity: 2 },
      { cusip: b, account_type: 'taxable', quantity: 4 },
    ]);
    // b was deleted; c was added and then deleted again (it never reaches incoming)
    const updated = applyUpdate(snapshot, [{ cusip: a, account_type: 'roth', quantity: 5 }]);
    expect(updated).toEqual([
      { cusip: a, account_type: 'roth', quantity: 5 },
      { cusip: b, account_type: 'taxable', quantity: 0 },
    ]);

    const rows = buildHoldingRows(updated, snapshot, tipsByCusip);
    expect(rows.map((r) => [r.cusip, r.quantity, r.prev_quantity])).toEqual([
      [a, 5, 2],
      [b, 0, 4],
    ]);

    const changes = changeList(rows);
    expect(changes.map((ch) => [ch.action, ch.quantity])).toEqual([
      ['Buy', 3],
      ['Sell', -4],
    ]);
    expect(changeListCsv(changes).split('\n')[0]).toBe('cusip,maturity_date,coupon_rate,account_type,quantity');
  });

  it('omits rows with zero current and previous quantity, or unknown CUSIPs', () => {
    const holdings: Holding[] = [
      { cusip: c, account_type: 'roth', quantity: 0 },
      { cusip: 'UNKNOWN', account_type: 'roth', quantity: 1 },
    ];
    expect(buildHoldingRows(holdings, {}, tipsByCusip)).toEqual([]);
  });
});
