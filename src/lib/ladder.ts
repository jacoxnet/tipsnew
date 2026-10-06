import type { CpiPoint, Holding, LadderYear, Specs, Tips } from './types';
import { cpiAt, latestCpi } from './data';
import { yearOf } from './dates';

/** Factor to inflate the base cash flow from its as-of date to the latest CPI */
export function inflationFactor(specs: Specs, cpi: CpiPoint[]): number {
  if (!specs.inflate_base_cf) return 1.0;
  const latest = latestCpi(cpi)?.cpi_value;
  const asOf = cpiAt(cpi, specs.base_cash_flow_date);
  return latest && asOf ? latest / asOf : 1.0;
}

/** Year-by-year cash flow, tax drag and surplus/shortfall for a ladder */
export function calculateLadder(
  specs: Specs,
  holdings: Holding[],
  tipsByCusip: Map<string, Tips>,
  cpi: CpiPoint[],
): LadderYear[] {
  const taxRate = specs.tax_rate / 100.0;
  const assumedInflationRate = specs.assumed_inflation_rate / 100.0;
  const additionalFlows = new Map(specs.additional_flows.map((f) => [f.year, f.amount]));
  const factor = inflationFactor(specs, cpi);

  const owned = holdings
    .map((h) => ({ h, tips: tipsByCusip.get(h.cusip) }))
    .filter((o): o is { h: Holding; tips: Tips } => o.tips !== undefined);

  const ladderYears: LadderYear[] = [];
  for (let y = specs.start_year; y <= specs.end_year; y++) {
    const target = (additionalFlows.get(y) ?? specs.base_cash_flow) * factor;
    let coupon_income = 0.0;
    let principal_income = 0.0;
    let tax_drag = 0.0;
    let principal_adjustment = 0.0;

    for (const { h, tips } of owned) {
      const maturityYear = yearOf(tips.maturity_date);
      // skip if matured before this year
      if (maturityYear < y) continue;

      const inflatedPrincipal = tips.index_ratio * h.quantity * 1000.0;
      // TIPS pay semi-annually; assume the full annual coupon is received in the year
      const annualCoupon = inflatedPrincipal * (tips.coupon_rate / 100.0);
      coupon_income += annualCoupon;

      if (h.account_type === 'pretax' || h.account_type === 'taxable') {
        tax_drag += annualCoupon * taxRate;
      }
      // tax effect on inflation-adjusted principal in taxable accounts
      if (specs.tax_effect_inflation && h.account_type === 'taxable') {
        principal_adjustment += inflatedPrincipal * assumedInflationRate;
        tax_drag += inflatedPrincipal * assumedInflationRate * taxRate;
      }
      // principal received in the maturity year
      if (maturityYear === y) {
        principal_income += inflatedPrincipal;
        if (h.account_type === 'pretax') tax_drag += inflatedPrincipal * taxRate;
      }
    }

    const pretax_cash_flow = coupon_income + principal_income;
    const pretax_balance = pretax_cash_flow - target;
    const net_flow = pretax_cash_flow - tax_drag;
    ladderYears.push({
      year: y,
      target,
      coupon_income,
      principal_income,
      tax_drag,
      principal_adjustment,
      pretax_cash_flow,
      pretax_balance,
      pretax_shortfall: pretax_balance < 0 ? target - pretax_cash_flow : 0,
      net_flow,
      shortfall: target - net_flow,
      balance: net_flow - target,
    });
  }
  return ladderYears;
}

export interface LadderTotals {
  total_balance: number;
  total_pretax_balance: number;
  total_shortfall: number;
  total_pretax_shortfall: number;
}

export function ladderTotals(years: LadderYear[]): LadderTotals {
  const total_balance = years.reduce((s, r) => s + r.balance, 0);
  const total_pretax_balance = years.reduce((s, r) => s + r.pretax_balance, 0);
  return {
    total_balance,
    total_pretax_balance,
    total_shortfall: total_balance < 0 ? -total_balance : 0,
    total_pretax_shortfall: total_pretax_balance < 0 ? -total_pretax_balance : 0,
  };
}
