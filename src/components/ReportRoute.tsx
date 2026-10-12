'use client';

import { useParams } from 'next/navigation';
import { ReportView } from './ReportView';

// useParams returns the raw (still percent-encoded) segment here: decode exactly once.
function decodeOnce(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function ReportRoute() {
  const { symbol } = useParams<{ symbol: string }>();
  return <ReportView symbol={decodeOnce(symbol)} />;
}
