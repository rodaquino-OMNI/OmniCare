'use client';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import LabResults from '@/components/results/LabResults';

export default function LabResultsPage() {
  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse', 'lab_tech']}>
      <AppLayout
        title="Laboratory Results"
        subtitle="View and analyze laboratory test results"
      >
        <LabResults />
      </AppLayout>
    </ProtectedRoute>
  );
}