import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../test-utils/test-providers';
import PatientSearchFilters from '../PatientSearchFilters';

const mockOnFiltersChange = jest.fn();

describe('PatientSearchFilters', () => {
  beforeEach(() => {
    mockOnFiltersChange.mockClear();
  });

  it('renders all filter options', () => {
    render(
      <TestProviders>
        <PatientSearchFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
          showAdvanced={true}
        />
      </TestProviders>
    );

    expect(screen.getByLabelText(/search patients/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/patient status filter/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gender filter/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/age range filter/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last visit after date/i)).toBeInTheDocument();
  });

  it('calls onFiltersChange when search input changes', async () => {
    render(
      <TestProviders>
        <PatientSearchFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
          showAdvanced={true}
        />
      </TestProviders>
    );

    const searchInput = screen.getByLabelText(/search patients/i);
    fireEvent.change(searchInput, { target: { value: 'John Doe' } });

    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          searchQuery: 'John Doe'
        })
      );
    });
  });

  it('applies mobile-responsive styles correctly', () => {
    const { container } = render(
      <TestProviders>
        <PatientSearchFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
          showAdvanced={true}
        />
      </TestProviders>
    );

    // Check for responsive grid classes
    const filterContainer = container.querySelector('[data-testid="patient-filters"]');
    expect(filterContainer).toHaveClass('responsive-grid');
  });

  it('filters by patient status', async () => {
    render(
      <TestProviders>
        <PatientSearchFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
          showAdvanced={true}
        />
      </TestProviders>
    );

    const statusSelect = screen.getByLabelText(/patient status filter/i);
    fireEvent.change(statusSelect, { target: { value: 'active' } });

    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active'
        })
      );
    });
  });

  it('filters by age range', async () => {
    render(
      <TestProviders>
        <PatientSearchFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
          showAdvanced={true}
        />
      </TestProviders>
    );

    const ageSelect = screen.getByLabelText(/age range filter/i);
    fireEvent.change(ageSelect, { target: { value: '18-64' } });

    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          ageRange: '18-64'
        })
      );
    });
  });

  it('handles date filter changes', async () => {
    render(
      <TestProviders>
        <PatientSearchFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
          showAdvanced={true}
        />
      </TestProviders>
    );

    const dateInput = screen.getByLabelText(/last visit after date/i);
    
    fireEvent.change(dateInput, { target: { value: '2024-01-01' } });

    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          lastVisitAfter: expect.any(Date)
        })
      );
    });
  });
});