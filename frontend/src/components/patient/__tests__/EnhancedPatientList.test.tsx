import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../test-utils/test-providers';
import { EnhancedPatientList } from '../EnhancedPatientList';

const mockPatients = [
  {
    id: '1',
    resourceType: 'Patient' as const,
    name: [{ given: ['John'], family: 'Doe' }],
    birthDate: '1990-01-01',
    gender: 'male' as const,
    active: true,
    identifier: [{ system: 'MRN', value: '123456' }],
    telecom: [
      { system: 'phone' as const, value: '555-1234' },
      { system: 'email' as const, value: 'john.doe@example.com' }
    ]
  },
  {
    id: '2',
    resourceType: 'Patient' as const,
    name: [{ given: ['Jane'], family: 'Smith' }],
    birthDate: '1985-05-15',
    gender: 'female' as const,
    active: true,
    identifier: [{ system: 'MRN', value: '654321' }],
    telecom: [
      { system: 'phone' as const, value: '555-5678' }
    ]
  }
];

describe('EnhancedPatientList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders patient list with search functionality', async () => {
    render(
      <TestProviders>
        <EnhancedPatientList />
      </TestProviders>
    );

    expect(screen.getByPlaceholderText(/search patients/i)).toBeInTheDocument();
    expect(screen.getByText(/patient management/i)).toBeInTheDocument();
  });

  it('displays patients in a mobile-responsive layout', () => {
    render(
      <TestProviders>
        <EnhancedPatientList />
      </TestProviders>
    );

    const patientContainer = screen.getByTestId('patient-list-container');
    expect(patientContainer).toHaveClass('responsive-layout');
  });

  it('shows advanced filters when requested', async () => {
    render(
      <TestProviders>
        <EnhancedPatientList />
      </TestProviders>
    );

    const showFiltersButton = screen.getByText(/show filters/i);
    fireEvent.click(showFiltersButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/age range/i)).toBeInTheDocument();
    });
  });

  it('handles search input changes', async () => {
    render(
      <TestProviders>
        <EnhancedPatientList />
      </TestProviders>
    );

    const searchInput = screen.getByPlaceholderText(/search patients/i);
    fireEvent.change(searchInput, { target: { value: 'John' } });

    await waitFor(() => {
      // Should trigger search API call
      expect(searchInput).toHaveValue('John');
    });
  });

  it('displays patient cards with essential information', () => {
    render(
      <TestProviders>
        <EnhancedPatientList initialPatients={mockPatients} />
      </TestProviders>
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('123456')).toBeInTheDocument(); // MRN
    expect(screen.getByText('555-1234')).toBeInTheDocument(); // Phone
  });

  it('provides quick action buttons for each patient', () => {
    render(
      <TestProviders>
        <EnhancedPatientList initialPatients={mockPatients} />
      </TestProviders>
    );

    const viewButtons = screen.getAllByText(/view/i);
    const scheduleButtons = screen.getAllByText(/schedule/i);
    const messageButtons = screen.getAllByText(/message/i);

    expect(viewButtons).toHaveLength(2);
    expect(scheduleButtons).toHaveLength(2);
    expect(messageButtons).toHaveLength(2);
  });

  it('handles loading states correctly', () => {
    render(
      <TestProviders>
        <EnhancedPatientList isLoading={true} />
      </TestProviders>
    );

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('handles empty state appropriately', () => {
    render(
      <TestProviders>
        <EnhancedPatientList initialPatients={[]} />
      </TestProviders>
    );

    expect(screen.getByText(/no patients found/i)).toBeInTheDocument();
    expect(screen.getByText(/add new patient/i)).toBeInTheDocument();
  });
});