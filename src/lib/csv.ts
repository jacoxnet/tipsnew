import type { AccountType, CashFlow, Holding, Specs, TipsIssue } from './types';
import { ACCOUNT_TYPES } from './types';
import { yearOf } from './dates';

/** Split CSV text into rows of fields, honoring double-quoted fields */
export function tokenizeCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface ParsedCsv {
  /** the last maturity year of the owned TIPS (at least the current year) */
  endYear: number;
  /** parameters read from an old-format save file (empty if none) */
  specs: Partial<Specs>;
  holdings: Holding[];
}

function parseParamValue(value: string): number | boolean | string {
  if (value === 'true' || value === 'false') return value === 'true';
  if (/^[0-9]{4}-[0-9]{2}$/.test(value)) return `${value}-01`; // date like 2025-02
  if (value !== '' && !isNaN(Number(value))) return Number(value);
  return value;
}

/**
 * Parse owned TIPS (and possibly parameters) from one of several CSV formats:
 *
 *  1. Kevin M's file: headers cusip, qty[, excess]. Only the first two columns are used.
 *  2. tipsladder.com's portfolio file: no headers; cusip, quantity, ladder year.
 *     Only the first two columns are used.
 *  3. This app's sample ladder file: headers cusip, quantity, account
 *     (account is one of roth, taxable, pretax).
 *  4. The old version of this app's save file, where the first column says
 *     what kind of row it is:
 *       - PARAM: second column is the field name, third is the value.
 *       - ADD_FLOW: second column is the year, third is the amount.
 *       - OWNED_TIP: second column is "cusip" or "coupon_maturity". For cusip the
 *         third column is the cusip; for coupon_maturity it is a quoted
 *         coupon/maturity combo like "1.750000%,2028-01-15" and the cusip is looked
 *         up. The fourth column is the account and the fifth the quantity.
 *
 * Rows naming an unknown TIPS or with an invalid quantity are skipped.
 */
export function parseCsv(text: string, tips: TipsIssue[], thisYear: number): ParsedCsv {
  const holdings: Holding[] = [];
  const specs: Partial<Specs> & Record<string, unknown> = {};
  let endYear = thisYear;

  const cusipYears = new Map<string, number>();
  const couponMaturity = new Map<string, string>();
  for (const t of tips) {
    cusipYears.set(t.cusip.toLowerCase(), yearOf(t.maturity_date));
    couponMaturity.set(`${t.coupon_rate}|${t.maturity_date}`, t.cusip.toLowerCase());
  }

  for (const row of tokenizeCsv(text)) {
    const cols = row.map((c) => c.trim().toLowerCase());
    if (cols.length === 0 || cols[0] === '') continue;
    // skip header rows
    if (cols[0] === 'cusip' || cols[0] === 'type') continue;

    if (cols[0] === 'param') {
      if (cols[1]) specs[cols[1]] = parseParamValue(cols[2] ?? '');
      continue;
    }
    if (cols[0] === 'add_flow') {
      const flow: CashFlow = { year: parseInt(cols[1], 10), amount: parseFloat(cols[2]) };
      if (!isNaN(flow.year) && !isNaN(flow.amount)) {
        specs.additional_flows = [...(specs.additional_flows ?? []), flow];
      }
      continue;
    }

    let cusip: string | undefined;
    let quantity: string;
    let account: string;
    if (cols[0] === 'owned_tip') {
      if (cols[1] === 'cusip') {
        cusip = cols[2];
      } else {
        // coupon_maturity, e.g. "1.750000%,2028-01-15"
        const [coupon, maturity] = (cols[2] ?? '').split('%,');
        cusip = couponMaturity.get(`${parseFloat(coupon)}|${maturity}`);
      }
      account = cols[3] ?? '';
      quantity = cols[4] ?? '';
    } else {
      // cusip, quantity[, account]
      cusip = cols[0];
      quantity = cols[1] ?? '';
      account = cols[2] ?? '';
    }

    if (!cusip || !cusipYears.has(cusip)) continue;
    if (!/^\d+$/.test(quantity) || parseInt(quantity, 10) <= 0) continue;
    holdings.push({
      cusip: cusip.toUpperCase(),
      quantity: parseInt(quantity, 10),
      account_type: ACCOUNT_TYPES.includes(account as AccountType) ? (account as AccountType) : 'pretax',
    });
    endYear = Math.max(endYear, cusipYears.get(cusip)!);
  }
  return { endYear, specs, holdings };
}
