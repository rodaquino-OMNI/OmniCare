'use client';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { useAuth } from '@/stores/auth';

export default function AdminPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute requiredRoles={['admin', 'system_admin']}>
      <AppLayout
        title="Administration"
        subtitle="System administration and management"
      >
        <AdminDashboard 
          userRole={user?.role || 'admin'} 
          userName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Administrator'}
        />
      </AppLayout>
    </ProtectedRoute>
  );
}