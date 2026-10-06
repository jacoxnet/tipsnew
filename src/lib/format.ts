const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1234.5 -> "1,234.50" */
export function formatMoney(value: number): string {
  return money.format(value);
}

/** Signed dollar amount: "+$1.00" / "-$1.00" / "$0.00" */
export function formatBalance(value: number, plusSign = false): string {
  if (value > 0) return `${plusSign ? '+' : ''}$${formatMoney(value)}`;
  if (value < 0) return `-$${formatMoney(Math.abs(value))}`;
  return '$0.00';
}

export function balanceClass(value: number): string {
  return value > 0 ? 'text-success' : value < 0 ? 'text-danger' : '';
}

export function fixed(value: number, places: number): string {
  return value.toFixed(places);
}

export function accountTypeLabel(val: string): string {
  if (val === 'roth') return 'Roth';
  if (val === 'pretax') return 'Pretax (e.g., 401k/IRA)';
  if (val === 'taxable') return 'Taxable Brokerage';
  return val;
}
