import type { Holding, HoldingRow, Tips } from './types';

/** Quantities keyed by `${cusip}_${account_type}` */
export type HoldingSnapshot = Record<string, number>;

export function holdingKey(h: Pick<Holding, 'cusip' | 'account_type'>): string {
  return `${h.cusip}_${h.account_type}`;
}

/** Sum the quantities of positions with the same CUSIP and account type */
export function mergeDuplicates(holdings: Holding[]): Holding[] {
  const merged = new Map<string, Holding>();
  for (const h of holdings) {
    const key = holdingKey(h);
    const existing = merged.get(key);
    if (existing) existing.quantity += h.quantity;
    else merged.set(key, { ...h });
  }
  return [...merged.values()];
}

export function snapshotOf(holdings: Holding[]): HoldingSnapshot {
  const snap: HoldingSnapshot = {};
  for (const h of mergeDuplicates(holdings)) if (h.quantity > 0) snap[holdingKey(h)] = h.quantity;
  return snap;
}

/**
 * Replace the working holdings with `incoming`. A position that was in the
 * snapshot (the last confirmed ladder) but is no longer present is kept with
 * quantity 0 so the change list can show it was sold; any other missing
 * position is dropped.
 */
export function applyUpdate(snapshot: HoldingSnapshot, incoming: Holding[]): Holding[] {
  const result = mergeDuplicates(incoming);
  const present = new Set(result.map(holdingKey));
  for (const key of Object.keys(snapshot)) {
    if (present.has(key)) continue;
    const sep = key.indexOf('_');
    result.push({
      cusip: key.slice(0, sep),
      account_type: key.slice(sep + 1) as Holding['account_type'],
      quantity: 0,
    });
  }
  return result;
}

/** Rows for the Build Your Ladder table, with previous (snapshot) quantities, sorted by maturity */
export function buildHoldingRows(
  holdings: Holding[],
  snapshot: HoldingSnapshot,
  tipsByCusip: Map<string, Tips>,
): HoldingRow[] {
  const current = new Map(mergeDuplicates(holdings).map((h) => [holdingKey(h), h]));
  const keys = new Set([...Object.keys(snapshot), ...current.keys()]);
  const rows: HoldingRow[] = [];
  for (const key of keys) {
    const sep = key.indexOf('_');
    const cusip = key.slice(0, sep);
    const account_type = key.slice(sep + 1) as Holding['account_type'];
    const prev_quantity = snapshot[key] ?? 0;
    const quantity = current.get(key)?.quantity ?? 0;
    if (quantity === 0 && prev_quantity === 0) continue;
    const tips = tipsByCusip.get(cusip);
    if (!tips) continue;
    rows.push({
      cusip,
      account_type,
      quantity,
      prev_quantity,
      maturity_date: tips.maturity_date,
      coupon_rate: tips.coupon_rate,
    });
  }
  return rows.sort((a, b) => a.maturity_date.localeCompare(b.maturity_date));
}

export interface Change {
  action: 'Buy' | 'Sell';
  row: HoldingRow;
  quantity: number; // signed difference
}

export function changeList(rows: HoldingRow[]): Change[] {
  return rows
    .filter((r) => r.quantity !== r.prev_quantity)
    .map((r) => {
      const diff = r.quantity - r.prev_quantity;
      return { action: diff < 0 ? 'Sell' : 'Buy', row: r, quantity: diff };
    });
}

export function changeListCsv(changes: Change[]): string {
  let csv = 'cusip,maturity_date,coupon_rate,account_type,quantity\n';
  for (const c of changes) {
    csv += `${c.row.cusip},${c.row.maturity_date},${c.row.coupon_rate},${c.row.account_type},${c.quantity}\n`;
  }
  return csv;
}
