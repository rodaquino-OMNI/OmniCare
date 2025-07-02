'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { ClientOnly } from '@/components/ClientOnly';
import { useAuth, initializeAuthStore } from '@/stores/auth';
import { DashboardIntegration } from '@/components/dashboard/DashboardIntegration';

// Force dynamic rendering to avoid SSR issues
export const dynamic = 'force-dynamic';

function EnhancedDashboardContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  // Extract URL parameters
  const patientId = searchParams.get('patient') || searchParams.get('patientId');
  const mode = (searchParams.get('mode') as 'dashboard' | 'patient' | 'clinical') || 'dashboard';

  useEffect(() => {
    // Initialize auth store on client-side mount
    initializeAuthStore();
  }, []);

  return (
    <DashboardIntegration
      patientId={patientId || undefined}
      mode={mode}
      title={`Welcome back, ${user?.firstName}!`}
      subtitle="Enhanced four-panel clinical workflow system"
    />
  );
}

export default function EnhancedDashboardPage() {
  return (
    <ProtectedRoute requiredRoles={['physician', 'nurse', 'admin']}>
      <ClientOnly fallback={<div>Loading enhanced dashboard...</div>}>
        <EnhancedDashboardContent />
      </ClientOnly>
    </ProtectedRoute>
  );
}