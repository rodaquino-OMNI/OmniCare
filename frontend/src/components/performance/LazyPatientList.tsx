import React, { lazy, Suspense } from 'react';
import { Loader, Center, Stack, Text } from '@mantine/core';
import { ErrorBoundary } from 'react-error-boundary';

// Performance optimization example: Lazy loading with code splitting
const PatientList = lazy(() => 
  import('../patient/PatientList').then(module => ({
    default: module.PatientList
  }))
);

const PatientListDashboard = lazy(() => 
  import('../patient/PatientList').then(module => ({
    default: module.PatientListDashboard
  }))
);

// Loading component with skeleton UI
function PatientListSkeleton() {
  return (
    <Center h={400}>
      <Stack align="center" gap="md">
        <Loader size="lg" />
        <Text c="dimmed" size="sm">Loading patient list...</Text>
      </Stack>
    </Center>
  );
}

// Error fallback component
function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <Center h={400}>
      <Stack align="center" gap="md">
        <Text size="lg" fw={500} c="red">Failed to load patient list</Text>
        <Text size="sm" c="dimmed">{error.message}</Text>
        <button onClick={resetErrorBoundary}>Try again</button>
      </Stack>
    </Center>
  );
}

// Lazy-loaded patient list with error boundary
export function LazyPatientList() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={<PatientListSkeleton />}>
        <PatientList />
      </Suspense>
    </ErrorBoundary>
  );
}

// Lazy-loaded dashboard variant
export function LazyPatientListDashboard() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={<PatientListSkeleton />}>
        <PatientListDashboard />
      </Suspense>
    </ErrorBoundary>
  );
}

// Performance optimization: Route-based code splitting
export const patientRoutes = {
  list: lazy(() => import('@/app/patients/page')),
  detail: lazy(() => import('@/app/patients/[id]/page')),
  new: lazy(() => import('@/app/patients/new/page')),
  edit: lazy(() => import('@/app/patients/[id]/edit/page'))
};