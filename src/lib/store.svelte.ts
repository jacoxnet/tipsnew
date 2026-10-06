import type { CpiPoint, Holding, Specs, Tips } from './types';
import { ACCOUNT_TYPES } from './types';
import { defaultSpecs, normalizeSpecs } from './specs';
import { applyUpdate, buildHoldingRows, mergeDuplicates, snapshotOf, type HoldingSnapshot } from './holdings';
import { calculateLadder } from './ladder';
import { parseCsv } from './csv';
import { currentYear } from './dates';
import { loadMarketData, type MarketData } from './data';

const STORAGE_KEY = 'tipsLadderState';

interface PersistedState {
  specs: Specs;
  holdings: Holding[];
  snapshot: HoldingSnapshot;
}

function loadPersisted(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return { specs: normalizeSpecs(s.specs ?? {}), holdings: s.holdings ?? [], snapshot: s.snapshot ?? {} };
  } catch {
    return null;
  }
}

function sanitizeHoldings(input: unknown): Holding[] {
  if (!Array.isArray(input)) return [];
  const out: Holding[] = [];
  for (const item of input) {
    const cusip = String(item?.cusip ?? '').trim().toUpperCase();
    const quantity = parseInt(String(item?.quantity ?? ''), 10);
    const account = String(item?.account_type ?? '').toLowerCase();
    if (!cusip || !isFinite(quantity) || quantity <= 0) continue;
    out.push({
      cusip,
      quantity,
      account_type: ACCOUNT_TYPES.includes(account as Holding['account_type'])
        ? (account as Holding['account_type'])
        : 'pretax',
    });
  }
  return out;
}

class AppState {
  specs = $state<Specs>(defaultSpecs());
  /** working set of owned TIPS, including qty-0 rows for positions removed since the last confirm */
  holdings = $state<Holding[]>([]);
  /** quantities as of the last confirmed ladder / import */
  snapshot = $state<HoldingSnapshot>({});

  market = $state<MarketData | null>(null);
  marketError = $state<string | null>(null);

  tips = $derived<Tips[]>(this.market?.tips ?? []);
  cpi = $derived<CpiPoint[]>(this.market?.cpi ?? []);
  tipsByCusip = $derived(new Map(this.tips.map((t) => [t.cusip, t])));
  holdingRows = $derived(buildHoldingRows(this.holdings, this.snapshot, this.tipsByCusip));
  ladderYears = $derived(calculateLadder(this.specs, this.holdings, this.tipsByCusip, this.cpi));

  constructor() {
    const saved = loadPersisted();
    if (saved) {
      this.specs = saved.specs;
      this.holdings = saved.holdings;
      this.snapshot = saved.snapshot;
    }
  }

  persist() {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ specs: this.specs, holdings: this.holdings, snapshot: this.snapshot }),
      );
    } catch {
      // storage unavailable (private mode etc.): state lasts for this page only
    }
  }

  async loadMarket() {
    try {
      this.market = await loadMarketData(import.meta.env.BASE_URL);
    } catch (e) {
      this.marketError = e instanceof Error ? e.message : String(e);
    }
  }

  resetAll() {
    this.specs = defaultSpecs();
    this.holdings = [];
    this.snapshot = {};
    this.persist();
  }

  setSpecs(specs: Specs) {
    this.specs = specs;
    this.persist();
  }

  /** Replace the working holdings (keeps sold positions from the snapshot at qty 0) */
  updateHoldings(incoming: Holding[]) {
    this.holdings = applyUpdate(this.snapshot, incoming.filter((h) => this.tipsByCusip.has(h.cusip)));
    this.persist();
  }

  /** Confirm the ladder: drop sold positions and start a fresh change list */
  confirmLadder() {
    this.holdings = mergeDuplicates(this.holdings).filter((h) => h.quantity > 0);
    this.snapshot = snapshotOf(this.holdings);
    this.persist();
  }

  private replaceHoldings(holdings: Holding[]) {
    this.holdings = mergeDuplicates(holdings.filter((h) => this.tipsByCusip.has(h.cusip)));
    this.snapshot = snapshotOf(this.holdings);
  }

  /** Load a JSON save file ({specsData, otipsData}) */
  importJson(text: string): string {
    let data: { specsData?: unknown; otipsData?: unknown };
    try {
      data = JSON.parse(text);
    } catch {
      return 'Error: file is not valid JSON';
    }
    if (!data || typeof data !== 'object' || !data.specsData || !Array.isArray(data.otipsData)) {
      return 'Error: file is not a saved TIPS ladder data file';
    }
    this.specs = normalizeSpecs(data.specsData as Partial<Record<keyof Specs, unknown>>);
    this.replaceHoldings(sanitizeHoldings(data.otipsData));
    this.persist();
    return 'Load successful';
  }

  /** Load owned TIPS (and, for old save files, parameters) from CSV */
  importCsv(text: string, label = 'Import'): string {
    const parsed = parseCsv(text, this.tips, currentYear());
    if (parsed.holdings.length === 0) return `Error: ${label.toLowerCase()} failure (no recognized TIPS found)`;
    if (Object.keys(parsed.specs).length > 0) {
      this.specs = normalizeSpecs(parsed.specs, this.specs);
    } else {
      this.specs = { ...this.specs, start_year: currentYear(), end_year: parsed.endYear };
    }
    this.replaceHoldings(parsed.holdings);
    this.persist();
    return `${label} successful (${parsed.holdings.length} TIPS loaded)`;
  }

  /** Data for a JSON save file, in the same shape the Django app produced */
  exportJson(): string {
    const otipsData = mergeDuplicates(this.holdings)
      .filter((h) => h.quantity > 0)
      .map((h) => {
        const t = this.tipsByCusip.get(h.cusip);
        return { ...h, maturity_date: t?.maturity_date, coupon_rate: t?.coupon_rate };
      });
    return JSON.stringify({ specsData: this.specs, otipsData });
  }
}

export const app = new AppState();
