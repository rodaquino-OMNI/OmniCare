'use client';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import { LazyVirtualizedPatientList } from '@/components/lazy/LazyComponents';
import { ClientOnly } from '@/components/ClientOnly';

export default function PatientsPage() {
  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse', 'admin']}>
      <AppLayout
        title="Patients"
        subtitle="Patient management and records"
      >
        <ClientOnly fallback={<div>Loading patient list...</div>}>
          <LazyVirtualizedPatientList 
            maxPatients={1000}
            enablePerformanceMonitoring={true}
          />
        </ClientOnly>
      </AppLayout>
    </ProtectedRoute>
  );
}