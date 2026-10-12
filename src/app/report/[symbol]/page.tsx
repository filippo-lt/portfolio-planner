import { Suspense } from 'react';
import { ReportRoute } from '@/components/ReportRoute';

export default function ReportPage() {
  return (
    <Suspense fallback={<p role="status">Caricamento…</p>}>
      <ReportRoute />
    </Suspense>
  );
}
