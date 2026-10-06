export const TIMEZONE = 'America/New_York';

/** Today's date in New York as {year, month (1-12), day} */
export function todayNY(now: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function currentYear(now: Date = new Date()): number {
  return todayNY(now).year;
}

/** ISO first-of-month date for (year, month) offset by `delta` months */
export function firstOfMonth(year: number, month: number, delta = 0): string {
  const idx = year * 12 + (month - 1) + delta;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function yearOf(isoDate: string): number {
  return parseInt(isoDate.slice(0, 4), 10);
}
