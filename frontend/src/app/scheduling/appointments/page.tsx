'use client';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import AppointmentManagement from '@/components/admin/AppointmentManagement';

export default function AppointmentsPage() {
  // TODO: Get facility ID from user context or settings
  const facilityId = 'default-facility';

  return (
    <ProtectedRoute requiredRoles={['admin', 'nurse']}>
      <AppLayout
        title="Appointment Management"
        subtitle="Schedule and manage patient appointments"
      >
        <AppointmentManagement facilityId={facilityId} />
      </AppLayout>
    </ProtectedRoute>
  );
}