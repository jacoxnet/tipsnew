/**
 * Fetch TIPS (US Treasury Fiscal Data) and CPI-U (FRED) data and write the
 * snapshots the static site loads at runtime:
 *
 *   public/data/tips.json   { fetched, data: TipsIssue[] }
 *   public/data/cpi.json    { fetched, data: CpiPoint[] }
 *
 * Requires FRED_API_KEY in the environment (or in a .env file).
 * Run with: npm run fetch-data
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TIPS_URL =
  'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/tips_cpi_data_summary';
const CPI_URL = 'https://api.stlouisfed.org/fred/series/observations';
const CPI_START = '1997-01-01';

// FRED has no October 2025 CPI (government shutdown). Use the value midway
// between September 2025 (324.800) and November 2025 (324.122).
const HARD_CODED_CPI: Record<string, number> = { '2025-10-01': 324.461 };

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/data');

function loadDotEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${url.replace(/api_key=[^&]+/, 'api_key=***')}`);
  return res.json();
}

async function fetchTips() {
  const records: any[] = [];
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({
      'page[size]': '100',
      'page[number]': String(page),
      sort: '-maturity_date',
    });
    const body = await getJson(`${TIPS_URL}?${params}`);
    records.push(...(body.data ?? []));
    const totalPages = Number(body.meta?.['total-pages'] ?? 1);
    if (page >= totalPages) break;
  }
  const byCusip = new Map<string, object>();
  for (const r of records) {
    if (!r.cusip || byCusip.has(r.cusip)) continue;
    byCusip.set(r.cusip, {
      cusip: r.cusip,
      dated_date: r.dated_date,
      maturity_date: r.maturity_date,
      coupon_rate: parseFloat(r.interest_rate),
      ref_cpi: parseFloat(r.ref_cpi_on_dated_date),
    });
  }
  const tips = [...byCusip.values()] as { maturity_date: string; coupon_rate: number; ref_cpi: number }[];
  const valid = tips.filter((t) => t.maturity_date && isFinite(t.coupon_rate) && isFinite(t.ref_cpi) && t.ref_cpi > 0);
  return valid.sort((a, b) => a.maturity_date.localeCompare(b.maturity_date));
}

async function fetchCpi(apiKey: string) {
  const params = new URLSearchParams({
    series_id: 'CPIAUCNS',
    api_key: apiKey,
    file_type: 'json',
    sort_order: 'asc',
    observation_start: CPI_START,
  });
  const body = await getJson(`${CPI_URL}?${params}`);
  const cpi = new Map<string, number>();
  for (const obs of body.observations ?? []) {
    const value = parseFloat(obs.value);
    if (obs.date && isFinite(value)) cpi.set(obs.date, value);
  }
  for (const [date, value] of Object.entries(HARD_CODED_CPI)) if (!cpi.has(date)) cpi.set(date, value);
  return [...cpi.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([as_of_date, cpi_value]) => ({ as_of_date, cpi_value }));
}

async function main() {
  loadDotEnv();
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) throw new Error('FRED_API_KEY is not set (environment or .env)');

  const [tips, cpi] = await Promise.all([fetchTips(), fetchCpi(apiKey)]);
  if (tips.length === 0) throw new Error('No TIPS records returned');
  if (cpi.length === 0) throw new Error('No CPI observations returned');

  const fetched = new Date().toISOString().slice(0, 10);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'tips.json'), JSON.stringify({ fetched, data: tips }));
  writeFileSync(resolve(outDir, 'cpi.json'), JSON.stringify({ fetched, data: cpi }));
  console.log(`Wrote ${tips.length} TIPS and ${cpi.length} CPI observations to ${outDir}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
