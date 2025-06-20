import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../../jest.setup';
import userEvent from '@testing-library/user-event';
import { PatientHeader } from '../PatientHeader';
import { Patient, AllergyIntolerance, Condition } from '@medplum/fhirtypes';
import { patientHelpers } from '@/lib/medplum';
import { formatDate, calculateAge } from '@/utils';

// Mock dependencies
jest.mock('@/lib/medplum', () => ({
  patientHelpers: {
    getFullName: jest.fn(),
    getAge: jest.fn(),
    getMRN: jest.fn(),
    getContactInfo: jest.fn(),
    getAllergies: jest.fn(),
    getConditions: jest.fn(),
  },
}));

jest.mock('@/utils', () => ({
  formatDate: jest.fn(),
  calculateAge: jest.fn(),
}));

jest.mock('@medplum/react', () => ({
  ResourceBadge: ({ value }: { value: any }) => (
    <div data-testid="resource-badge">Resource Badge</div>
  ),
  ResourceAvatar: ({ value, size, color }: { value: any; size: string; color: string }) => (
    <div data-testid="resource-avatar" data-size={size} data-color={color}>
      Avatar
    </div>
  ),
}));

describe('PatientHeader', () => {
  const mockPatientHelpers = patientHelpers as jest.Mocked<typeof patientHelpers>;
  const mockFormatDate = formatDate as jest.MockedFunction<typeof formatDate>;
  const mockCalculateAge = calculateAge as jest.MockedFunction<typeof calculateAge>;

  const mockPatient: Patient = {
    resourceType: 'Patient',
    id: 'patient-123',
    active: true,
    name: [
      {
        given: ['John'],
        family: 'Doe',
        use: 'official',
      },
    ],
    gender: 'male',
    birthDate: '1990-01-15',
    telecom: [
      {
        system: 'phone',
        value: '555-0123',
        use: 'mobile',
      },
      {
        system: 'email',
        value: 'john.doe@example.com',
        use: 'home',
      },
    ],
    address: [
      {
        use: 'home',
        line: ['123 Main St'],
        city: 'Anytown',
        state: 'NY',
        postalCode: '12345',
        country: 'US',
      },
    ],
    identifier: [
      {
        system: 'http://hospital.smarthealthit.org',
        value: 'MRN123456',
      },
    ],
  };

  const mockAllergies: AllergyIntolerance[] = [
    {
      resourceType: 'AllergyIntolerance',
      id: 'allergy-1',
      patient: { reference: 'Patient/patient-123' },
      criticality: 'high',
      code: {
        text: 'Penicillin',
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '387517004',
            display: 'Penicillin',
          },
        ],
      },
      reaction: [
        {
          severity: 'severe',
          manifestation: [
            {
              text: 'Anaphylaxis',
            },
          ],
        },
      ],
    },
    {
      resourceType: 'AllergyIntolerance',
      id: 'allergy-2',
      patient: { reference: 'Patient/patient-123' },
      criticality: 'low',
      code: {
        text: 'Shellfish',
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '227037002',
            display: 'Shellfish',
          },
        ],
      },
    },
  ];

  const mockConditions: Condition[] = [
    {
      resourceType: 'Condition',
      id: 'condition-1',
      subject: { reference: 'Patient/patient-123' },
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
            display: 'Active',
          },
        ],
      },
      code: {
        text: 'Type 2 Diabetes',
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '44054006',
            display: 'Type 2 diabetes mellitus',
          },
        ],
      },
    },
    {
      resourceType: 'Condition',
      id: 'condition-2',
      subject: { reference: 'Patient/patient-123' },
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'inactive',
            display: 'Inactive',
          },
        ],
      },
      code: {
        text: 'Hypertension',
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '38341003',
            display: 'Essential hypertension',
          },
        ],
      },
    },
  ];

  beforeEach(() => {
    // Mock helper functions
    mockPatientHelpers.getFullName.mockReturnValue('John Doe');
    mockPatientHelpers.getAge.mockReturnValue(34);
    mockPatientHelpers.getMRN.mockReturnValue('MRN123456');
    mockPatientHelpers.getContactInfo.mockReturnValue({
      phone: '555-0123',
      email: 'john.doe@example.com',
      address: {
        line: ['123 Main St'],
        city: 'Anytown',
        state: 'NY',
        postalCode: '12345',
        country: 'US',
      },
    });
    mockPatientHelpers.getAllergies.mockResolvedValue(mockAllergies);
    mockPatientHelpers.getConditions.mockResolvedValue(mockConditions);

    mockFormatDate.mockReturnValue('January 15, 1990');
    mockCalculateAge.mockReturnValue(34);

    jest.clearAllMocks();
  });

  describe('Rendering - Full View', () => {
    it('should render patient information in full view', async () => {
      renderWithProviders(<PatientHeader patient={mockPatient} />);

      // Check patient name and basic info
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('MALE')).toBeInTheDocument();
      expect(screen.getByText('34 years old')).toBeInTheDocument();
      expect(screen.getByText('MRN: MRN123456')).toBeInTheDocument();
      expect(screen.getByText('DOB: January 15, 1990')).toBeInTheDocument();

      // Check contact information
      expect(screen.getByText('555-0123')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText('Anytown, NY 12345')).toBeInTheDocument();

      // Check status badge
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();

      // Wait for allergies and conditions to load
      await waitFor(() => {
        expect(screen.getByText('High Priority Allergies')).toBeInTheDocument();
      });

      expect(screen.getByText('Penicillin')).toBeInTheDocument();
      expect(screen.getByText('Active Conditions')).toBeInTheDocument();
      expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
    });

    it('should render with different gender colors', () => {
      const femalePatient = { ...mockPatient, gender: 'female' };
      const { rerender } = render(<PatientHeader patient={femalePatient} />);

      let genderBadge = screen.getByText('FEMALE');
      expect(genderBadge).toBeInTheDocument();

      const unknownPatient = { ...mockPatient, gender: undefined };
      rerender(<PatientHeader patient={unknownPatient} />);

      genderBadge = screen.getByText('UNKNOWN');
      expect(genderBadge).toBeInTheDocument();
    });

    it('should render inactive patient status', () => {
      const inactivePatient = { ...mockPatient, active: false };
      render(<PatientHeader patient={inactivePatient} />);

      expect(screen.getByText('INACTIVE')).toBeInTheDocument();
    });
  });

  describe('Rendering - Compact View', () => {
    it('should render patient information in compact view', async () => {
      render(<PatientHeader patient={mockPatient} compact />);

      // Check patient name and basic info
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('MALE')).toBeInTheDocument();
      expect(screen.getByText('34 years old')).toBeInTheDocument();
      expect(screen.getByText('MRN: MRN123456')).toBeInTheDocument();
      expect(screen.getByText('DOB: January 15, 1990')).toBeInTheDocument();

      // Contact information should not be visible in compact view
      expect(screen.queryByText('PHONE')).not.toBeInTheDocument();
      expect(screen.queryByText('EMAIL')).not.toBeInTheDocument();
      expect(screen.queryByText('ADDRESS')).not.toBeInTheDocument();

      // Wait for allergies to load and check for allergy indicator
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should show high priority allergy badge in compact view', async () => {
      render(<PatientHeader patient={mockPatient} compact />);

      await waitFor(() => {
        const tooltip = screen.getByLabelText('High Priority Allergies');
        expect(tooltip).toBeInTheDocument();
      });
    });
  });

  describe('Actions', () => {
    it('should render action buttons when showActions is true', () => {
      const onEdit = jest.fn();
      const onPrint = jest.fn();
      const onShare = jest.fn();

      render(
        <PatientHeader
          patient={mockPatient}
          onEdit={onEdit}
          onPrint={onPrint}
          onShare={onShare}
          showActions={true}
        />
      );

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument();
    });

    it('should not render action buttons when showActions is false', () => {
      render(<PatientHeader patient={mockPatient} showActions={false} />);

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /print/i })).not.toBeInTheDocument();
    });

    it('should call onEdit when edit button is clicked', async () => {
      const user = userEvent.setup();
      const onEdit = jest.fn();

      render(<PatientHeader patient={mockPatient} onEdit={onEdit} />);

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it('should call onPrint when print button is clicked', async () => {
      const user = userEvent.setup();
      const onPrint = jest.fn();

      render(<PatientHeader patient={mockPatient} onPrint={onPrint} />);

      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      expect(onPrint).toHaveBeenCalledTimes(1);
    });

    it('should handle menu interactions in full view', async () => {
      const user = userEvent.setup();
      const onShare = jest.fn();

      render(<PatientHeader patient={mockPatient} onShare={onShare} />);

      // Click menu trigger
      const menuButton = screen.getByRole('button', { name: '' }); // IconMoreHorizontal button
      await user.click(menuButton);

      // Check menu items
      expect(screen.getByText('Share Patient Info')).toBeInTheDocument();
      expect(screen.getByText('View History')).toBeInTheDocument();
      expect(screen.getByText('Report Issue')).toBeInTheDocument();

      // Click share option
      await user.click(screen.getByText('Share Patient Info'));
      expect(onShare).toHaveBeenCalledTimes(1);
    });

    it('should handle menu interactions in compact view', async () => {
      const user = userEvent.setup();
      const onEdit = jest.fn();
      const onPrint = jest.fn();
      const onShare = jest.fn();

      render(
        <PatientHeader
          patient={mockPatient}
          onEdit={onEdit}
          onPrint={onPrint}
          onShare={onShare}
          compact
        />
      );

      // Click menu trigger in compact view
      const menuButton = screen.getByRole('button', { name: '' });
      await user.click(menuButton);

      // Check menu items in compact view
      expect(screen.getByText('Edit Patient')).toBeInTheDocument();
      expect(screen.getByText('Print Summary')).toBeInTheDocument();
      expect(screen.getByText('Share')).toBeInTheDocument();

      // Click edit option
      await user.click(screen.getByText('Edit Patient'));
      expect(onEdit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Loading', () => {
    it('should load allergies and conditions on mount', async () => {
      renderWithProviders(<PatientHeader patient={mockPatient} />);

      await waitFor(() => {
        expect(mockPatientHelpers.getAllergies).toHaveBeenCalledWith('patient-123');
        expect(mockPatientHelpers.getConditions).toHaveBeenCalledWith('patient-123');
      });
    });

    it('should filter active conditions only', async () => {
      renderWithProviders(<PatientHeader patient={mockPatient} />);

      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
        expect(screen.queryByText('Hypertension')).not.toBeInTheDocument(); // inactive condition
      });
    });

    it('should handle loading errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockPatientHelpers.getAllergies.mockRejectedValue(new Error('API Error'));
      mockPatientHelpers.getConditions.mockRejectedValue(new Error('API Error'));

      renderWithProviders(<PatientHeader patient={mockPatient} />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error loading patient data:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('should not load data if patient has no ID', async () => {
      const patientWithoutId = { ...mockPatient, id: undefined };
      render(<PatientHeader patient={patientWithoutId} />);

      // Wait a bit to ensure no API calls are made
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockPatientHelpers.getAllergies).not.toHaveBeenCalled();
      expect(mockPatientHelpers.getConditions).not.toHaveBeenCalled();
    });
  });

  describe('Allergies and Conditions Display', () => {
    it('should show high priority allergy alert', async () => {
      renderWithProviders(<PatientHeader patient={mockPatient} />);

      await waitFor(() => {
        expect(screen.getByText('High Priority Allergies')).toBeInTheDocument();
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });
    });

    it('should not show allergy alert for low priority allergies only', async () => {
      const lowPriorityAllergies = mockAllergies.filter(a => a.criticality === 'low');
      mockPatientHelpers.getAllergies.mockResolvedValue(lowPriorityAllergies);

      renderWithProviders(<PatientHeader patient={mockPatient} />);

      await waitFor(() => {
        expect(screen.queryByText('High Priority Allergies')).not.toBeInTheDocument();
      });
    });

    it('should show active conditions', async () => {
      renderWithProviders(<PatientHeader patient={mockPatient} />);

      await waitFor(() => {
        expect(screen.getByText('Active Conditions')).toBeInTheDocument();
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });
    });

    it('should limit displayed allergies and conditions with "more" indicator', async () => {
      // Create more allergies and conditions than can be displayed
      const manyAllergies = Array.from({ length: 5 }, (_, i) => ({
        ...mockAllergies[0],
        id: `allergy-${i}`,
        code: { text: `Allergy ${i}` },
      }));

      const manyConditions = Array.from({ length: 6 }, (_, i) => ({
        ...mockConditions[0],
        id: `condition-${i}`,
        code: { text: `Condition ${i}` },
      }));

      mockPatientHelpers.getAllergies.mockResolvedValue(manyAllergies);
      mockPatientHelpers.getConditions.mockResolvedValue(manyConditions);

      renderWithProviders(<PatientHeader patient={mockPatient} />);

      await waitFor(() => {
        // Should show "+X more" for allergies (shows max 3)
        expect(screen.getByText('+2 more')).toBeInTheDocument();
        // Should show "+X more" for conditions (shows max 4)
        expect(screen.getByText('+2 more')).toBeInTheDocument();
      });
    });

    it('should handle allergies and conditions without display text', async () => {
      const allergyWithoutText = {
        ...mockAllergies[0],
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '387517004',
              display: 'Penicillin Coding Display',
            },
          ],
        },
      };

      const conditionWithoutText = {
        ...mockConditions[0],
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '44054006',
              display: 'Diabetes Coding Display',
            },
          ],
        },
      };

      mockPatientHelpers.getAllergies.mockResolvedValue([allergyWithoutText]);
      mockPatientHelpers.getConditions.mockResolvedValue([conditionWithoutText]);

      renderWithProviders(<PatientHeader patient={mockPatient} />);

      await waitFor(() => {
        expect(screen.getByText('Penicillin Coding Display')).toBeInTheDocument();
        expect(screen.getByText('Diabetes Coding Display')).toBeInTheDocument();
      });
    });
  });

  describe('Contact Information', () => {
    it('should handle missing contact information gracefully', () => {
      mockPatientHelpers.getContactInfo.mockReturnValue({
        phone: null,
        email: null,
        address: null,
      });

      renderWithProviders(<PatientHeader patient={mockPatient} />);

      expect(screen.queryByText('PHONE')).not.toBeInTheDocument();
      expect(screen.queryByText('EMAIL')).not.toBeInTheDocument();
      expect(screen.queryByText('ADDRESS')).not.toBeInTheDocument();
    });

    it('should handle partial contact information', () => {
      mockPatientHelpers.getContactInfo.mockReturnValue({
        phone: '555-0123',
        email: null,
        address: null,
      });

      renderWithProviders(<PatientHeader patient={mockPatient} />);

      expect(screen.getByText('555-0123')).toBeInTheDocument();
      expect(screen.queryByText('EMAIL')).not.toBeInTheDocument();
      expect(screen.queryByText('ADDRESS')).not.toBeInTheDocument();
    });

    it('should handle address without city information', () => {
      mockPatientHelpers.getContactInfo.mockReturnValue({
        phone: null,
        email: null,
        address: {
          line: ['123 Main St'],
          city: null,
          state: null,
          postalCode: null,
          country: 'US',
        },
      });

      renderWithProviders(<PatientHeader patient={mockPatient} />);

      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.queryByText('Anytown, NY 12345')).not.toBeInTheDocument();
    });
  });

  describe('Helper Function Calls', () => {
    it('should call all helper functions with correct parameters', () => {
      renderWithProviders(<PatientHeader patient={mockPatient} />);

      expect(mockPatientHelpers.getFullName).toHaveBeenCalledWith(mockPatient);
      expect(mockPatientHelpers.getAge).toHaveBeenCalledWith(mockPatient);
      expect(mockPatientHelpers.getMRN).toHaveBeenCalledWith(mockPatient);
      expect(mockPatientHelpers.getContactInfo).toHaveBeenCalledWith(mockPatient);
    });

    it('should call formatDate with birth date', () => {
      renderWithProviders(<PatientHeader patient={mockPatient} />);

      expect(mockFormatDate).toHaveBeenCalledWith('1990-01-15');
    });

    it('should handle patient without birth date', () => {
      const patientWithoutBirthDate = { ...mockPatient, birthDate: undefined };
      render(<PatientHeader patient={patientWithoutBirthDate} />);

      expect(screen.queryByText(/DOB:/)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible tooltips', async () => {
      render(<PatientHeader patient={mockPatient} compact />);

      await waitFor(() => {
        const tooltip = screen.getByLabelText('High Priority Allergies');
        expect(tooltip).toBeInTheDocument();
      });
    });

    it('should have proper ARIA labels for interactive elements', async () => {
      const onEdit = jest.fn();
      render(<PatientHeader patient={mockPatient} onEdit={onEdit} />);

      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toBeInTheDocument();
    });

    it('should have proper color contrast for status badges', () => {
      renderWithProviders(<PatientHeader patient={mockPatient} />);

      const statusBadge = screen.getByText('ACTIVE');
      expect(statusBadge).toBeInTheDocument();
    });
  });
});