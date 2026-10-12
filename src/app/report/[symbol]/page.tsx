import { Suspense } from 'react';
import { ReportRoute } from '@/components/ReportRoute';
import { PageLoading } from '@/components/ui';

export default function ReportPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ReportRoute />
    </Suspense>
  );
}
