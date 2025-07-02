'use client';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import { PatientList } from '@/components/patient/PatientList';

export default function PatientSearchPage() {
  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse', 'admin']}>
      <AppLayout
        title="Patient Search"
        subtitle="Search and manage patient records"
      >
        <PatientList />
      </AppLayout>
    </ProtectedRoute>
  );
}