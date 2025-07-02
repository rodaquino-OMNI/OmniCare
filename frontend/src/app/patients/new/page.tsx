'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import PatientRegistration from '@/components/admin/PatientRegistration';
import { Patient } from '@/types/administrative';

export default function NewPatientPage() {
  const router = useRouter();

  const handleComplete = (patient: Patient) => {
    // TODO: Implement patient save logic
    // Patient registered successfully
    router.push('/patients');
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <ProtectedRoute requiredRoles={['admin', 'nurse']}>
      <AppLayout
        title="New Patient Registration"
        subtitle="Register a new patient in the system"
      >
        <PatientRegistration 
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      </AppLayout>
    </ProtectedRoute>
  );
}