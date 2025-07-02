// Patient component exports

// Core patient components (with proper export types)
export { default as PatientList } from './PatientList';
export { default as PatientSummary } from './PatientSummary';
export { default as PatientHeader } from './PatientHeader';
export { PatientChart } from './PatientChart';
export { PatientDashboard } from './PatientDashboard';
export { default as PatientTimeline } from './PatientTimeline';
export { PatientCard } from './PatientCard';

// Enhanced patient components
export { default as EnhancedPatientList, EnhancedPatientList as EnhancedPatientListComponent } from './EnhancedPatientList';
export { default as VirtualizedPatientList } from './VirtualizedPatientList';

// Search and filter components
export { PatientSearch } from './PatientSearch';
export { default as PatientSearchFilters } from './PatientSearchFilters';
export { default as SimplePatientSearchFilters } from './SimplePatientSearchFilters';

// Re-export types if needed
export type { PatientFilters } from './SimplePatientSearchFilters';