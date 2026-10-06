export type AccountType = 'taxable' | 'pretax' | 'roth';
export const ACCOUNT_TYPES: AccountType[] = ['roth', 'pretax', 'taxable'];

/** A TIPS issue as stored in the data snapshot (data/tips.json) */
export interface TipsIssue {
  cusip: string;
  dated_date: string; // YYYY-MM-DD
  maturity_date: string; // YYYY-MM-DD
  coupon_rate: number; // percent
  ref_cpi: number;
}

/** A TIPS issue with today's index ratio applied */
export interface Tips extends TipsIssue {
  index_ratio: number;
}

export interface CpiPoint {
  as_of_date: string; // YYYY-MM-01
  cpi_value: number;
}

export interface Snapshot<T> {
  fetched: string; // ISO date the snapshot was taken
  data: T[];
}

export interface CashFlow {
  year: number;
  amount: number;
}

export interface Specs {
  tax_rate: number;
  start_year: number;
  end_year: number;
  base_cash_flow: number;
  inflate_base_cf: boolean;
  base_cash_flow_date: string; // YYYY-MM-01
  tax_effect_inflation: boolean;
  assumed_inflation_rate: number;
  use_pretax: boolean;
  additional_flows: CashFlow[];
}

/** An owned TIPS position */
export interface Holding {
  cusip: string;
  account_type: AccountType;
  quantity: number; // $1000 blocks
}

/** An owned TIPS position as shown on the Build Your Ladder page */
export interface HoldingRow extends Holding {
  maturity_date: string;
  coupon_rate: number;
  prev_quantity: number;
}

export interface LadderYear {
  year: number;
  target: number;
  coupon_income: number;
  principal_income: number;
  tax_drag: number;
  principal_adjustment: number;
  pretax_cash_flow: number;
  pretax_balance: number;
  pretax_shortfall: number;
  net_flow: number;
  shortfall: number;
  balance: number;
}
