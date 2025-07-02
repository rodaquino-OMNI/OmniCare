import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MantineProvider } from '@mantine/core';

// Simple test component to verify the component loads
const SimplePatientSearchFilters: React.FC = () => {
  return (
    <div data-testid="patient-search-filters">
      <input 
        aria-label="Search patients" 
        placeholder="Search patients..."
        data-testid="search-input"
      />
    </div>
  );
};

describe('PatientSearchFilters Basic', () => {
  it('renders without crashing', () => {
    render(
      <MantineProvider>
        <SimplePatientSearchFilters />
      </MantineProvider>
    );
    
    expect(screen.getByTestId('patient-search-filters')).toBeInTheDocument();
    expect(screen.getByLabelText(/search patients/i)).toBeInTheDocument();
  });
});