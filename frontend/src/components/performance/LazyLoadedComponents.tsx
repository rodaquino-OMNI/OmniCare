'use client';

import { lazy, Suspense, memo } from 'react';
import { Skeleton, Stack, Card } from '@mantine/core';

// Lazy loaded components for code splitting
export const LazyPatientList = lazy(() => 
  import('../patient/PatientList').then(module => ({ default: module.PatientList }))
);

export const LazyVirtualizedPatientList = lazy(() => 
  import('../patient/VirtualizedPatientList')
);

export const LazyPatientDashboard = lazy(() => 
  import('../patient/PatientDashboard').then(module => ({ default: module.PatientDashboard }))
);

export const LazyEnhancedPatientList = lazy(() => 
  import('../patient/EnhancedPatientList')
);

export const LazyClinicalNoteInput = lazy(() => 
  import('../clinical/ClinicalNoteInput')
);

export const LazyTaskBoard = lazy(() => 
  import('../clinical/TaskBoard')
);

export const LazyNoteComposer = lazy(() => 
  import('../clinical/NoteComposer')
);

export const LazyTemplateManager = lazy(() => 
  import('../clinical/TemplateManager')
);

// Loading skeletons for different component types
const PatientListSkeleton = memo(() => (
  <Stack gap="md">
    {Array.from({ length: 5 }).map((_, index) => (
      <Card key={index} withBorder p="md">
        <Stack gap="sm">
          <Skeleton height={20} width="60%" />
          <Skeleton height={16} width="40%" />
          <Skeleton height={14} width="80%" />
        </Stack>
      </Card>
    ))}
  </Stack>
));

const DashboardSkeleton = memo(() => (
  <Stack gap="md">
    <Skeleton height={60} />
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
      <Skeleton height={400} />
      <Skeleton height={400} />
    </div>
  </Stack>
));

const ClinicalInputSkeleton = memo(() => (
  <Card withBorder p="md">
    <Stack gap="md">
      <Skeleton height={40} />
      <Skeleton height={200} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <Skeleton height={32} width={80} />
        <Skeleton height={32} width={80} />
      </div>
    </Stack>
  </Card>
));

PatientListSkeleton.displayName = 'PatientListSkeleton';
DashboardSkeleton.displayName = 'DashboardSkeleton';
ClinicalInputSkeleton.displayName = 'ClinicalInputSkeleton';

// Wrapper components with appropriate loading states
export const LazyPatientListWithSkeleton = memo(() => (
  <Suspense fallback={<PatientListSkeleton />}>
    <LazyPatientList />
  </Suspense>
));

export const LazyVirtualizedPatientListWithSkeleton = memo(() => (
  <Suspense fallback={<PatientListSkeleton />}>
    <LazyVirtualizedPatientList />
  </Suspense>
));

export const LazyPatientDashboardWithSkeleton = memo(() => (
  <Suspense fallback={<DashboardSkeleton />}>
    <LazyPatientDashboard />
  </Suspense>
));

export const LazyEnhancedPatientListWithSkeleton = memo(() => (
  <Suspense fallback={<PatientListSkeleton />}>
    <LazyEnhancedPatientList />
  </Suspense>
));

export const LazyClinicalNoteInputWithSkeleton = memo(() => (
  <Suspense fallback={<ClinicalInputSkeleton />}>
    <LazyClinicalNoteInput />
  </Suspense>
));

export const LazyTaskBoardWithSkeleton = memo(() => (
  <Suspense fallback={<DashboardSkeleton />}>
    <LazyTaskBoard />
  </Suspense>
));

export const LazyNoteComposerWithSkeleton = memo(() => (
  <Suspense fallback={<ClinicalInputSkeleton />}>
    <LazyNoteComposer />
  </Suspense>
));

export const LazyTemplateManagerWithSkeleton = memo(() => (
  <Suspense fallback={<PatientListSkeleton />}>
    <LazyTemplateManager />
  </Suspense>
));

LazyPatientListWithSkeleton.displayName = 'LazyPatientListWithSkeleton';
LazyVirtualizedPatientListWithSkeleton.displayName = 'LazyVirtualizedPatientListWithSkeleton';
LazyPatientDashboardWithSkeleton.displayName = 'LazyPatientDashboardWithSkeleton';
LazyEnhancedPatientListWithSkeleton.displayName = 'LazyEnhancedPatientListWithSkeleton';
LazyClinicalNoteInputWithSkeleton.displayName = 'LazyClinicalNoteInputWithSkeleton';
LazyTaskBoardWithSkeleton.displayName = 'LazyTaskBoardWithSkeleton';
LazyNoteComposerWithSkeleton.displayName = 'LazyNoteComposerWithSkeleton';
LazyTemplateManagerWithSkeleton.displayName = 'LazyTemplateManagerWithSkeleton';

// Route-based lazy loading components
export const routes = {
  '/dashboard/patients': LazyPatientListWithSkeleton,
  '/dashboard/patients/enhanced': LazyEnhancedPatientListWithSkeleton,
  '/dashboard/patients/virtualized': LazyVirtualizedPatientListWithSkeleton,
  '/dashboard/patients/:id': LazyPatientDashboardWithSkeleton,
  '/clinical/notes': LazyClinicalNoteInputWithSkeleton,
  '/clinical/tasks': LazyTaskBoardWithSkeleton,
  '/clinical/composer': LazyNoteComposerWithSkeleton,
  '/clinical/templates': LazyTemplateManagerWithSkeleton,
} as const;

export type LazyRoute = keyof typeof routes;

// Dynamic component loader
export const loadRouteComponent = (route: LazyRoute) => {
  return routes[route] || (() => <div>Route not found</div>);
};