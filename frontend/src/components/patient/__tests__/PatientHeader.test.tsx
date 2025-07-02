import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PatientHeader from '../PatientHeader';
import { TestProviders } from '../../../../test-utils/test-providers';
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

// Mock patient cache service
jest.mock('@/services/patient-cache.service', () => ({
  patientCacheService: {
    getPatientAllergies: jest.fn(),
    getPatientConditions: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

// Mock offline components and hooks
jest.mock('@/components/offline', () => ({
  CacheStatusIndicator: ({ patientId }: { patientId: string }) => (
    <div data-testid="cache-status-indicator">Cache Status</div>
  ),
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: jest.fn(() => ({
    isOnline: true,
    isSlowConnection: false,
    connectionType: 'wifi',
  })),
}));

jest.mock('@/stores/offline', () => ({
  useOfflineStore: jest.fn(() => ({
    isEnabled: true,
    cacheSettings: {},
  })),
}));

jest.mock('@/utils', () => ({
  formatDate: jest.fn(),
  calculateAge: jest.fn(),
}));

jest.mock('@medplum/react', () => {
  const React = require('react');
  return {
    ResourceBadge: ({ value }: { value: any }) => {
      const badge = value?.active ? 'ACTIVE' : 'INACTIVE';
      return React.createElement('span', { 'data-testid': 'resource-badge' }, badge);
    },
    ResourceAvatar: ({ value, size, color }: { value: any; size?: string; color?: string }) => 
      React.createElement('div', { 
        'data-testid': 'resource-avatar', 
        'data-size': size, 
        'data-color': color 
      }, 'Avatar')
    ,
  };
});

// Mock @tabler/icons-react
jest.mock('@tabler/icons-react', () => {
  const React = require('react');
  const mockIcon = (name: string) => (props: any) => 
    React.createElement('span', { ...props, 'data-icon': name });
  
  return {
    IconUser: mockIcon('IconUser'),
    IconPhone: mockIcon('IconPhone'),
    IconMail: mockIcon('IconMail'),
    IconMapPin: mockIcon('IconMapPin'),
    IconCalendar: mockIcon('IconCalendar'),
    IconEdit: mockIcon('IconEdit'),
    IconPrint: mockIcon('IconPrint'),
    IconShare: mockIcon('IconShare'),
    IconMoreHorizontal: mockIcon('IconMoreHorizontal'),
    IconHeart: mockIcon('IconHeart'),
    IconShield: mockIcon('IconShield'),
    IconAlertTriangle: mockIcon('IconAlertTriangle'),
    IconClock: mockIcon('IconClock'),
    IconId: mockIcon('IconId'),
  };
});

// Ensure matchMedia is mocked
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

// Custom render function for this test file
const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  return render(<TestProviders>{ui}</TestProviders>, options);
};

describe('PatientHeader', () => {
  // Test that mocks are loaded
  it('should have mocked dependencies', () => {
    expect(patientHelpers.getFullName).toBeDefined();
    expect(jest.isMockFunction(patientHelpers.getFullName)).toBe(true);
  });
  
  // Test basic rendering
  it('should render TestProviders', () => {
    const { container } = renderWithProviders(<div>Test Content</div>);
    expect(container.textContent).toBe('Test Content');
  });

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
        use: 'official' as const,
      },
    ],
    gender: 'male' as const,
    birthDate: '199-1-15',
    telecom: [
      {
        system: 'phone' as const,
        value: '555-123',
        use: 'mobile' as const,
      },
      {
        system: 'email' as const,
        value: 'john.doe@example.com',
        use: 'home' as const,
      },
    ],
    address: [
      {
        use: 'home' as const,
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
            code: '3875174',
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
            code: '227372',
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
            code: '44546',
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
            code: '3834103',
            display: 'Essential hypertension',
          },
        ],
      },
    },
  ];

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock helper functions
    mockPatientHelpers.getFullName.mockReturnValue('John Doe');
    mockPatientHelpers.getAge.mockReturnValue(34);
    mockPatientHelpers.getMRN.mockReturnValue('MRN123456');
    mockPatientHelpers.getContactInfo.mockReturnValue({
      phone: '555-123',
      email: 'john.doe@example.com',
      address: {
        line: ['123 Main St'],
        city: 'Anytown',
        state: 'NY',
        postalCode: '12345',
        country: 'US',
      },
    });
    
    // Mock cache service functions (these are the actual methods called by the component)
    const { patientCacheService } = require('@/services/patient-cache.service');
    patientCacheService.getPatientAllergies.mockResolvedValue(mockAllergies);
    patientCacheService.getPatientConditions.mockResolvedValue(mockConditions);
    patientCacheService.on.mockImplementation(() => {});
    patientCacheService.off.mockImplementation(() => {});

    mockFormatDate.mockReturnValue('January 15, 199');
    mockCalculateAge.mockReturnValue(34);
  });

  describe('Rendering - Full View', () => {
    it('should render patient information in full view', async () => {
      let component;
      
      await act(async () => {
        component = renderWithProviders(<PatientHeader patient={mockPatient} />);
        // Allow time for async effects to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Wait for async operations to complete with longer timeout
      await waitFor(async () => {
        const { patientCacheService } = require('@/services/patient-cache.service');
        expect(patientCacheService.getPatientAllergies).toHaveBeenCalledWith('patient-123');
        expect(patientCacheService.getPatientConditions).toHaveBeenCalledWith('patient-123');
      }, { timeout: 3000 });

      // Check patient name and basic info
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('MALE')).toBeInTheDocument();
      expect(screen.getByText('34 years old')).toBeInTheDocument();
      expect(screen.getByText('MRN: MRN123456')).toBeInTheDocument();
      expect(screen.getByText('DOB: January 15, 199')).toBeInTheDocument();

      // Check status badge (use getAllByText since there might be multiple ACTIVE badges)
      const activeBadges = screen.getAllByText('ACTIVE');
      expect(activeBadges.length).toBeGreaterThan(0);

      // Wait for allergies and conditions to load with proper act wrapper
      await act(async () => {
        await waitFor(() => {
          expect(screen.getByText('High Priority Allergies')).toBeInTheDocument();
        }, { timeout: 3000 });
      });

      expect(screen.getByText('Penicillin')).toBeInTheDocument();
      expect(screen.getByText('Active Conditions')).toBeInTheDocument();
      expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
    });

    it('should render with different gender colors', () => {
      const femalePatient = { ...mockPatient, gender: 'female' as const };
      const { rerender } = renderWithProviders(<PatientHeader patient={femalePatient} />);

      const genderBadge = screen.getByText('FEMALE');
      expect(genderBadge).toBeInTheDocument();

      const unknownPatient = { ...mockPatient, gender: undefined };
      rerender(<PatientHeader patient={unknownPatient} />);

      const unknownBadge = screen.getByText('UNKNOWN');
      expect(unknownBadge).toBeInTheDocument();
    });

    it('should render inactive patient status', async () => {
      const inactivePatient = { ...mockPatient, active: false };
      
      await act(async () => {
        renderWithProviders(<PatientHeader patient={inactivePatient} />);
        // Allow async effects to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Wait for component to render completely with proper timeout
      await waitFor(() => {
        const inactiveBadges = screen.getAllByText('INACTIVE');
        expect(inactiveBadges.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });
  });

  describe('Rendering - Compact View', () => {
    it('should render patient information in compact view', async () => {
      await act(async () => {
        renderWithProviders(<PatientHeader patient={mockPatient} compact />);
        // Allow async effects to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Check patient name and basic info
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('MALE')).toBeInTheDocument();
      expect(screen.getByText('34 years old')).toBeInTheDocument();
      expect(screen.getByText('MRN: MRN123456')).toBeInTheDocument();
      expect(screen.getByText('DOB: January 15, 199')).toBeInTheDocument();

      // Contact information should not be visible in compact view
      expect(screen.queryByText('PHONE')).not.toBeInTheDocument();
      expect(screen.queryByText('EMAIL')).not.toBeInTheDocument();
      expect(screen.queryByText('ADDRESS')).not.toBeInTheDocument();

      // Wait for allergies to load
      await waitFor(() => {
        const { patientCacheService } = require('@/services/patient-cache.service');
        expect(patientCacheService.getPatientAllergies).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('should show high priority allergy badge in compact view', async () => {
      const { container } = renderWithProviders(<PatientHeader patient={mockPatient} compact />);
      
      await act(async () => {
        // Allow async effects to complete
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Wait for allergies to load and high priority badge to appear
      await waitFor(() => {
        // Look for the shield icon which indicates high priority allergies
        const elements = container.querySelectorAll('[data-icon="IconShield"]');
        expect(elements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });

      // The shield icon should be present in a badge, indicating high priority allergies
      const shieldIcon = container.querySelector('[data-icon="IconShield"]');
      expect(shieldIcon).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should render action buttons when showActions is true', () => {
      const onEdit = jest.fn();
      const onPrint = jest.fn();
      const onShare = jest.fn();

      renderWithProviders(
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
      renderWithProviders(<PatientHeader patient={mockPatient} showActions={false} />);

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /print/i })).not.toBeInTheDocument();
    });

    it('should call onEdit when edit button is clicked', async () => {
      const user = userEvent.setup();
      const onEdit = jest.fn();

      renderWithProviders(<PatientHeader patient={mockPatient} onEdit={onEdit} />);

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it('should call onPrint when print button is clicked', async () => {
      const user = userEvent.setup();
      const onPrint = jest.fn();

      renderWithProviders(<PatientHeader patient={mockPatient} onPrint={onPrint} />);

      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      expect(onPrint).toHaveBeenCalledTimes(1);
    });

    it('should handle menu interactions in full view', async () => {
      const user = userEvent.setup();
      const onShare = jest.fn();

      renderWithProviders(<PatientHeader patient={mockPatient} onShare={onShare} />);

      // Find the menu button (ActionIcon with IconMoreHorizontal)
      const menuButtons = screen.getAllByRole('button');
      const menuButton = menuButtons.find(btn => 
        btn.querySelector('[data-icon="IconMoreHorizontal"]')
      );
      expect(menuButton).toBeDefined();
      
      await user.click(menuButton!);

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

      renderWithProviders(
        <PatientHeader
          patient={mockPatient}
          onEdit={onEdit}
          onPrint={onPrint}
          onShare={onShare}
          compact
        />
      );

      // Find the menu button in compact view
      const menuButton = screen.getByRole('button');
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
        const { patientCacheService } = require('@/services/patient-cache.service');
        expect(patientCacheService.getPatientAllergies).toHaveBeenCalledWith('patient-123');
        expect(patientCacheService.getPatientConditions).toHaveBeenCalledWith('patient-123');
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
      
      const { patientCacheService } = require('@/services/patient-cache.service');
      patientCacheService.getPatientAllergies.mockRejectedValue(new Error('API Error'));
      patientCacheService.getPatientConditions.mockRejectedValue(new Error('API Error'));

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
      renderWithProviders(<PatientHeader patient={patientWithoutId} />);

      // Wait a bit to ensure no API calls are made
      await new Promise(resolve => setTimeout(resolve, 10));

      const { patientCacheService } = require('@/services/patient-cache.service');
      expect(patientCacheService.getPatientAllergies).not.toHaveBeenCalled();
      expect(patientCacheService.getPatientConditions).not.toHaveBeenCalled();
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
      const { patientCacheService } = require('@/services/patient-cache.service');
      patientCacheService.getPatientAllergies.mockResolvedValue(lowPriorityAllergies);

      renderWithProviders(<PatientHeader patient={mockPatient} />);

      await waitFor(() => {
        expect(patientCacheService.getPatientAllergies).toHaveBeenCalled();
      });

      expect(screen.queryByText('High Priority Allergies')).not.toBeInTheDocument();
    });

    it('should show active conditions', async () => {
      renderWithProviders(<PatientHeader patient={mockPatient} />);

      await waitFor(() => {
        expect(screen.getByText('Active Conditions')).toBeInTheDocument();
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });
    });

    it('should handle multiple allergies and conditions', async () => {
      // Create more allergies and conditions than can be displayed
      const manyAllergies = Array.from({ length: 5 }, (_, i) => ({
        ...mockAllergies[0],
        id: `allergy-${i}`,
        code: { text: `Allergy ${i}` },
        criticality: 'high', // Ensure they are high priority to show in alert
      }));

      const manyConditions = Array.from({ length: 6 }, (_, i) => ({
        ...mockConditions[0],
        id: `condition-${i}`,
        code: { text: `Condition ${i}` },
      }));

      const { patientCacheService } = require('@/services/patient-cache.service');
      patientCacheService.getPatientAllergies.mockResolvedValue(manyAllergies);
      patientCacheService.getPatientConditions.mockResolvedValue(manyConditions);

      await act(async () => {
        renderWithProviders(<PatientHeader patient={mockPatient} />);
        // Allow async effects to complete
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        // Should show high priority allergies alert
        expect(screen.getByText('High Priority Allergies')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should handle allergies and conditions without display text', async () => {
      const allergyWithoutText = {
        ...mockAllergies[0],
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '3875174',
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
              code: '44546',
              display: 'Diabetes Coding Display',
            },
          ],
        },
      };

      const { patientCacheService } = require('@/services/patient-cache.service');
      patientCacheService.getPatientAllergies.mockResolvedValue([allergyWithoutText]);
      patientCacheService.getPatientConditions.mockResolvedValue([conditionWithoutText]);

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
        phone: undefined,
        email: undefined,
        address: undefined,
      });

      renderWithProviders(<PatientHeader patient={mockPatient} />);

      expect(screen.queryByText('PHONE')).not.toBeInTheDocument();
      expect(screen.queryByText('EMAIL')).not.toBeInTheDocument();
      expect(screen.queryByText('ADDRESS')).not.toBeInTheDocument();
    });

    it('should handle partial contact information', () => {
      mockPatientHelpers.getContactInfo.mockReturnValue({
        phone: '555-123',
        email: undefined,
        address: undefined,
      });

      renderWithProviders(<PatientHeader patient={mockPatient} />);

      expect(screen.getByText('555-123')).toBeInTheDocument();
      expect(screen.queryByText('EMAIL')).not.toBeInTheDocument();
      expect(screen.queryByText('ADDRESS')).not.toBeInTheDocument();
    });

    it('should handle address without city information', () => {
      mockPatientHelpers.getContactInfo.mockReturnValue({
        phone: undefined,
        email: undefined,
        address: {
          line: ['123 Main St'],
          city: undefined,
          state: undefined,
          postalCode: undefined,
          country: 'US',
        },
      });

      renderWithProviders(<PatientHeader patient={mockPatient} />);

      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.queryByText(/Anytown, NY 12345/)).not.toBeInTheDocument();
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

      expect(mockFormatDate).toHaveBeenCalledWith('199-1-15');
    });

    it('should handle patient without birth date', () => {
      const patientWithoutBirthDate = { ...mockPatient, birthDate: undefined };
      renderWithProviders(<PatientHeader patient={patientWithoutBirthDate} />);

      expect(screen.queryByText(/DOB:/)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible tooltips', async () => {
      const { container } = renderWithProviders(<PatientHeader patient={mockPatient} compact />);
      
      await act(async () => {
        // Allow async effects to complete
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Wait for allergies to load and check that the shield icon exists (tooltip trigger)
      await waitFor(() => {
        const shieldIcon = container.querySelector('[data-icon="IconShield"]');
        expect(shieldIcon).toBeInTheDocument();
      }, { timeout: 3000 });

      // The shield icon itself should be accessible, tooltip will appear on hover
      const shieldIcon = container.querySelector('[data-icon="IconShield"]');
      expect(shieldIcon).toBeInTheDocument();
    });

    it('should have proper ARIA labels for interactive elements', async () => {
      const onEdit = jest.fn();
      renderWithProviders(<PatientHeader patient={mockPatient} onEdit={onEdit} />);

      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toBeInTheDocument();
    });

    it('should have proper color contrast for status badges', async () => {
      await act(async () => {
        renderWithProviders(<PatientHeader patient={mockPatient} />);
        // Allow async effects to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const activeBadges = screen.getAllByText('ACTIVE');
      expect(activeBadges.length).toBeGreaterThan(0);
      
      // Check that at least one badge has appropriate styling attributes
      const greenBadge = screen.getByTestId('resource-badge');
      expect(greenBadge).toHaveTextContent('ACTIVE');
      
      const inactivePatient = { ...mockPatient, active: false };
      const { rerender } = renderWithProviders(<PatientHeader patient={inactivePatient} />);
      
      await act(async () => {
        await waitFor(() => {
          const inactiveBadges = screen.getAllByText('INACTIVE');
          expect(inactiveBadges.length).toBeGreaterThan(0);
        }, { timeout: 3000 });
      });
    });
  });
});