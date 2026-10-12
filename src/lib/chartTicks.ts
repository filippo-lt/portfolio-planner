const DAY = 24 * 3600 * 1000;
const toMs = (d: string) => Date.parse(d + 'T00:00:00Z');
const MAX_MONTH_TICKS = 8;

export interface ChartTicks {
  ticks: string[];
  /** 'year' labels as "2023", 'month' labels as "gen 23" */
  unit: 'year' | 'month';
}

/** First date of each distinct key (year or month) in a sorted date list. */
function firstOf(dates: string[], len: number): string[] {
  const out: string[] = [];
  let prev = '';
  for (const d of dates) {
    const k = d.slice(0, len);
    if (k !== prev) out.push(d);
    prev = k;
  }
  return out;
}

/**
 * Picks x-axis tick dates from the chart dates (which must be the dates actually plotted).
 * Span over ~3 years: one tick per year. Otherwise one per month, thinned to at most 8.
 */
export function chartTicks(dates: string[]): ChartTicks {
  if (dates.length === 0) return { ticks: [], unit: 'month' };
  const spanYears = (toMs(dates[dates.length - 1]) - toMs(dates[0])) / (365.25 * DAY);
  if (spanYears > 3) return { ticks: firstOf(dates, 4), unit: 'year' };
  const months = firstOf(dates, 7);
  const step = Math.ceil(months.length / MAX_MONTH_TICKS);
  return { ticks: months.filter((_, i) => i % step === 0), unit: 'month' };
}
