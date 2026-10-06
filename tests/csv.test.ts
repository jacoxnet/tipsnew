import { describe, expect, it } from 'vitest';
import { parseCsv, tokenizeCsv } from '../src/lib/csv';
import { normalizeSpecs } from '../src/lib/specs';
import { ref } from './fixtures';

const YEAR = ref.generated_in_year;

describe('parseCsv matches the original Python implementation', () => {
  for (const c of ref.csv_cases.filter((c) => c.ok)) {
    it(c.name, () => {
      const parsed = parseCsv(c.input, ref.tips, YEAR);
      expect(parsed.endYear).toBe(c.end_year);
      expect(parsed.holdings).toEqual(c.holdings);
      // Python kept PARAM/ADD_FLOW values loosely typed; compare after normalizing
      expect(normalizeSpecs(parsed.specs)).toEqual(normalizeSpecs(c.specs as object));
    });
  }

  it('skips rows with an invalid quantity instead of failing (Python raised)', () => {
    const failing = ref.csv_cases.find((c) => !c.ok)!;
    expect(parseCsv(failing.input, ref.tips, YEAR).holdings).toEqual([]);
  });
});

describe('parseCsv details', () => {
  const [t0, t1] = ref.tips;

  it('handles CRLF line endings, blank lines and missing account types', () => {
    const parsed = parseCsv(`CUSIP,Qty\r\n${t0.cusip},2\r\n\r\n${t1.cusip.toLowerCase()} , 3 ,ROTH\r\n`, ref.tips, YEAR);
    expect(parsed.holdings).toEqual([
      { cusip: t0.cusip, quantity: 2, account_type: 'pretax' },
      { cusip: t1.cusip, quantity: 3, account_type: 'roth' },
    ]);
  });

  it('parses typed parameters from old save files', () => {
    const parsed = parseCsv('PARAM,tax_rate,22.5,,\nPARAM,use_pretax,TRUE,,\nPARAM,base_cash_flow_date,2023-07,,\nADD_FLOW,2031,5000,,\n', ref.tips, YEAR);
    expect(parsed.specs).toEqual({
      tax_rate: 22.5,
      use_pretax: true,
      base_cash_flow_date: '2023-07-01',
      additional_flows: [{ year: 2031, amount: 5000 }],
    });
  });
});

describe('tokenizeCsv', () => {
  it('handles quoted fields with commas and escaped quotes', () => {
    expect(tokenizeCsv('a,"b,c","d ""e"""\n1,2')).toEqual([
      ['a', 'b,c', 'd "e"'],
      ['1', '2'],
    ]);
  });
});
