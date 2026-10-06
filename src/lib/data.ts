import type { CpiPoint, Snapshot, Tips, TipsIssue } from './types';
import { daysInMonth, firstOfMonth, todayNY } from './dates';

export interface DailyCpi {
  value: number;
  /** set when the CPI months needed for today's reference CPI were missing */
  warning?: string;
}

/**
 * Today's reference CPI, as used for TIPS index ratios: the CPI from three
 * months ago, plus (day - 1) / days-in-month of the change between the CPI
 * from three months ago and two months ago.
 */
export function computeDailyCpi(cpi: CpiPoint[], now: Date = new Date()): DailyCpi {
  const { year, month, day } = todayNY(now);
  const byDate = new Map(cpi.map((c) => [c.as_of_date, c.cpi_value]));
  let cpi3 = byDate.get(firstOfMonth(year, month, -3));
  let cpi2 = byDate.get(firstOfMonth(year, month, -2));
  let warning: string | undefined;
  if (cpi3 === undefined || cpi2 === undefined) {
    // fall back to the latest two published months
    const sorted = [...cpi].sort((a, b) => a.as_of_date.localeCompare(b.as_of_date));
    if (sorted.length < 2) throw new Error('Not enough CPI data to compute index ratios');
    cpi3 = sorted[sorted.length - 2].cpi_value;
    cpi2 = sorted[sorted.length - 1].cpi_value;
    warning = `CPI for ${firstOfMonth(year, month, -2).slice(0, 7)} is not yet available; index ratios use the latest published CPI (${sorted[sorted.length - 1].as_of_date.slice(0, 7)}).`;
  }
  const value = cpi3 + ((day - 1) * (cpi2 - cpi3)) / daysInMonth(year, month);
  return { value, warning };
}

export function round(value: number, places: number): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

export function withIndexRatios(tips: TipsIssue[], dailyCpi: number): Tips[] {
  return tips.map((t) => ({ ...t, index_ratio: round(dailyCpi / t.ref_cpi, 5) }));
}

export function latestCpi(cpi: CpiPoint[]): CpiPoint | undefined {
  let latest: CpiPoint | undefined;
  for (const c of cpi) if (!latest || c.as_of_date > latest.as_of_date) latest = c;
  return latest;
}

export function cpiAt(cpi: CpiPoint[], date: string): number | undefined {
  return cpi.find((c) => c.as_of_date === date)?.cpi_value;
}

export interface MarketData {
  tips: Tips[];
  cpi: CpiPoint[];
  tipsFetched: string;
  cpiFetched: string;
  warning?: string;
}

async function fetchJson<T>(url: string): Promise<Snapshot<T>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return res.json();
}

/** Load the TIPS and CPI snapshots published with the site */
export async function loadMarketData(baseUrl: string): Promise<MarketData> {
  const [tipsSnap, cpiSnap] = await Promise.all([
    fetchJson<TipsIssue>(`${baseUrl}data/tips.json`),
    fetchJson<CpiPoint>(`${baseUrl}data/cpi.json`),
  ]);
  const daily = computeDailyCpi(cpiSnap.data);
  const tips = withIndexRatios(tipsSnap.data, daily.value).sort((a, b) =>
    a.maturity_date.localeCompare(b.maturity_date),
  );
  return {
    tips,
    cpi: cpiSnap.data,
    tipsFetched: tipsSnap.fetched,
    cpiFetched: cpiSnap.fetched,
    warning: daily.warning,
  };
}
