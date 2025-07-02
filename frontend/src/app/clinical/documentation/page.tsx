'use client';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import ClinicalNoteInput from '@/components/clinical/ClinicalNoteInput';

export default function ClinicalDocumentationPage() {
  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse']}>
      <AppLayout
        title="Clinical Documentation"
        subtitle="Create and manage clinical notes"
      >
        <ClinicalNoteInput />
      </AppLayout>
    </ProtectedRoute>
  );
}