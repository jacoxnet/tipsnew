import type { Specs } from './types';
import { currentYear } from './dates';

export function defaultSpecs(): Specs {
  return {
    tax_rate: 15.0,
    start_year: currentYear(),
    end_year: 2030,
    base_cash_flow: 10000.0,
    inflate_base_cf: false,
    base_cash_flow_date: '2024-01-01',
    tax_effect_inflation: false,
    assumed_inflation_rate: 0.0,
    use_pretax: false,
    additional_flows: [],
  };
}

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && isFinite(n) ? n : fallback;
};

/** Build a complete, well-typed Specs from (possibly partial or loosely typed) input */
export function normalizeSpecs(input: Partial<Record<keyof Specs, unknown>>, base: Specs = defaultSpecs()): Specs {
  const flows = Array.isArray(input.additional_flows) ? input.additional_flows : base.additional_flows;
  const date = typeof input.base_cash_flow_date === 'string' && /^\d{4}-\d{2}/.test(input.base_cash_flow_date)
    ? `${input.base_cash_flow_date.slice(0, 7)}-01`
    : base.base_cash_flow_date;
  return {
    tax_rate: num(input.tax_rate, base.tax_rate),
    start_year: Math.trunc(num(input.start_year, base.start_year)),
    end_year: Math.trunc(num(input.end_year, base.end_year)),
    base_cash_flow: num(input.base_cash_flow, base.base_cash_flow),
    inflate_base_cf: typeof input.inflate_base_cf === 'boolean' ? input.inflate_base_cf : base.inflate_base_cf,
    base_cash_flow_date: date,
    tax_effect_inflation:
      typeof input.tax_effect_inflation === 'boolean' ? input.tax_effect_inflation : base.tax_effect_inflation,
    assumed_inflation_rate: num(input.assumed_inflation_rate, base.assumed_inflation_rate),
    use_pretax: typeof input.use_pretax === 'boolean' ? input.use_pretax : base.use_pretax,
    additional_flows: flows
      .map((f: { year?: unknown; amount?: unknown }) => ({
        year: Math.trunc(num(f?.year, NaN)),
        amount: num(f?.amount, NaN),
      }))
      .filter((f) => isFinite(f.year) && isFinite(f.amount)),
  };
}
