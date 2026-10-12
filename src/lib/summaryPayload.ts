import type { Report } from './report';

/** The report without the series the summary never reads (chart, monthly closes, FX and distribution data): they make the request huge. */
export function summaryReport(report: Report): Omit<Report, 'chart' | 'monthly' | 'dist' | 'fx'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { chart, monthly, dist, fx, ...slim } = report;
  return slim;
}
