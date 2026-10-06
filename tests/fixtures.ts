import reference from './fixtures/python-reference.json';
import type { CpiPoint, Holding, Specs, Tips } from '../src/lib/types';

/**
 * Synthetic TIPS/CPI data (not real Treasury data) with expected outputs
 * recorded from the original Django implementation (core/ladder_calc.py and
 * core/dbstuff.py:parse_csv) before it was replaced.
 */
export const ref = reference as unknown as {
  generated_in_year: number;
  tips: Tips[];
  cpi: CpiPoint[];
  holdings: Holding[];
  ladder_scenarios: { name: string; specs: Specs; expected: Record<string, number>[] }[];
  csv_cases: {
    name: string;
    input: string;
    ok: boolean;
    end_year?: number;
    specs?: Record<string, unknown>;
    holdings?: Holding[];
  }[];
};

export const tipsByCusip = new Map(ref.tips.map((t) => [t.cusip, t]));
