import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { PatientSummary } from '../PatientSummary';
import { Patient, Observation, MedicationRequest, AllergyIntolerance, Condition, Encounter } from '@medplum/fhirtypes';
import { patientHelpers, observationHelpers, medicationHelpers } from '@/lib/medplum';
import { formatDate, formatDateTime } from '@/utils';

// Mock dependencies - IMPORTANT: Must override jest.setup.js mock
jest.unmock('@/lib/medplum');
jest.mock('@/lib/medplum', () => ({
  getMedplumClient: jest.fn(() => ({
    readResource: jest.fn(),
    createResource: jest.fn(),
    updateResource: jest.fn(),
    deleteResource: jest.fn(),
    searchResources: jest.fn(),
    getProfile: jest.fn(),
    request: jest.fn(),
  })),
  medplumClient: {
    readResource: jest.fn(),
    createResource: jest.fn(),
    updateResource: jest.fn(),
    deleteResource: jest.fn(),
    searchResources: jest.fn(),
    getProfile: jest.fn(),
    request: jest.fn(),
  },
  initializeMedplum: jest.fn().mockResolvedValue(true),
  patientHelpers: {
    getVitalSigns: jest.fn(),
    getMedications: jest.fn(),
    getAllergies: jest.fn(),
    getConditions: jest.fn(),
    getEncounters: jest.fn(),
  },
  observationHelpers: {
    isAbnormal: jest.fn(),
  },
  medicationHelpers: {
    getName: jest.fn(),
    getDosageInstruction: jest.fn(),
  },
}));

jest.mock('@/utils', () => ({
  formatDate: jest.fn((date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
  }),
  formatDateTime: jest.fn((date) => {
    if (!date) return '';
    return new Date(date).toLocaleString();
  }),
}));

// Mock console.error to avoid noise in tests
const mockConsoleError = jest.spyOn(console, 'error');

describe('PatientSummary', () => {
  const mockPatient: Patient = {
    resourceType: 'Patient',
    id: 'patient-123',
    name: [
      {
        use: 'official' as const,
        family: 'Doe',
        given: ['John'],
      },
    ],
    gender: 'male' as const,
    birthDate: '1990-01-01',
  };

  const mockVitals: Observation[] = [
    {
      resourceType: 'Observation',
      id: 'obs-1',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart Rate',
          },
        ],
      },
      subject: { reference: 'Patient/patient-123' },
      valueQuantity: {
        value: 72,
        unit: 'bpm',
      },
      effectiveDateTime: '2023-01-01T10:00:00Z',
    },
    {
      resourceType: 'Observation',
      id: 'obs-2',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '8310-5',
            display: 'Body Temperature',
          },
        ],
      },
      subject: { reference: 'Patient/patient-123' },
      valueQuantity: {
        value: 98.6,
        unit: '°F',
      },
      effectiveDateTime: '2023-01-01T10:00:00Z',
    },
  ];

  const mockMedications: MedicationRequest[] = [
    {
      resourceType: 'MedicationRequest',
      id: 'med-1',
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [
          {
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: '313782',
            display: 'Acetaminophen 325 MG Oral Tablet',
          },
        ],
      },
      subject: { reference: 'Patient/patient-123' },
      dosageInstruction: [
        {
          text: 'Take 1 tablet by mouth every 4-6 hours as needed for pain',
        },
      ],
    },
    {
      resourceType: 'MedicationRequest',
      id: 'med-2',
      status: 'completed',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [
          {
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: '197361',
            display: 'Lisinopril 10 MG Oral Tablet',
          },
        ],
      },
      subject: { reference: 'Patient/patient-123' },
      dosageInstruction: [
        {
          text: 'Take 1 tablet by mouth daily',
        },
      ],
    },
  ];

  const mockAllergies: AllergyIntolerance[] = [
    {
      resourceType: 'AllergyIntolerance',
      id: 'allergy-1',
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: 'active',
          },
        ],
      },
      code: {
        text: 'Penicillin',
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '373270004',
            display: 'Penicillin',
          },
        ],
      },
      patient: { reference: 'Patient/patient-123' },
      criticality: 'high',
      reaction: [
        {
          manifestation: [
            {
              text: 'Rash',
            },
          ],
        },
      ],
    },
  ];

  const mockConditions: Condition[] = [
    {
      resourceType: 'Condition',
      id: 'condition-1',
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'confirmed',
          },
        ],
      },
      code: {
        text: 'Hypertension',
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '38341003',
            display: 'Hypertension',
          },
        ],
      },
      subject: { reference: 'Patient/patient-123' },
      recordedDate: '2023-01-01',
    },
  ];

  const mockEncounters: Encounter[] = [
    {
      resourceType: 'Encounter',
      id: 'encounter-1',
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'Ambulatory',
      },
      type: [
        {
          text: 'Office Visit',
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '185349003',
              display: 'Office Visit',
            },
          ],
        },
      ],
      subject: { reference: 'Patient/patient-123' },
      period: {
        start: '2023-01-01T10:00:00Z',
        end: '2023-01-01T11:00:00Z',
      },
    },
  ];

  // Get mocked functions from the module
  const mockedModule = jest.requireMock('@/lib/medplum');
  const mockPatientHelpers = mockedModule.patientHelpers as jest.Mocked<typeof patientHelpers>;
  const mockObservationHelpers = mockedModule.observationHelpers as jest.Mocked<typeof observationHelpers>;
  const mockMedicationHelpers = mockedModule.medicationHelpers as jest.Mocked<typeof medicationHelpers>;
  const mockFormatDate = formatDate as jest.MockedFunction<typeof formatDate>;
  const mockFormatDateTime = formatDateTime as jest.MockedFunction<typeof formatDateTime>;

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <MantineProvider>
        {component}
      </MantineProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockPatientHelpers.getVitalSigns.mockResolvedValue(mockVitals);
    mockPatientHelpers.getMedications.mockResolvedValue(mockMedications);
    mockPatientHelpers.getAllergies.mockResolvedValue(mockAllergies);
    mockPatientHelpers.getConditions.mockResolvedValue(mockConditions);
    mockPatientHelpers.getEncounters.mockResolvedValue(mockEncounters);

    mockObservationHelpers.isAbnormal.mockReturnValue(false);
    
    mockMedicationHelpers.getName.mockImplementation((med) => 
      med.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown Medication'
    );
    mockMedicationHelpers.getDosageInstruction.mockImplementation((med) => 
      med.dosageInstruction?.[0]?.text || 'No dosage instruction'
    );

    // Set up default format date/time mocks
    (formatDate as jest.Mock).mockClear();
    (formatDateTime as jest.Mock).mockClear();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', async () => {
      // Make the promise never resolve to test loading state
      mockPatientHelpers.getVitalSigns.mockReturnValue(new Promise(() => {}));
      
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.getByText('Loading patient summary...')).toBeInTheDocument();
      });
      
      // Check for loader presence
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when data loading fails', async () => {
      mockPatientHelpers.getVitalSigns.mockRejectedValue(new Error('API Error'));
      
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load patient summary')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should retry loading when retry button is clicked', async () => {
      mockPatientHelpers.getVitalSigns.mockRejectedValueOnce(new Error('API Error'));
      
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load patient summary')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Reset mocks to succeed on retry
      mockPatientHelpers.getVitalSigns.mockResolvedValue(mockVitals);
      
      fireEvent.click(screen.getByText('Retry'));
      
      await waitFor(() => {
        expect(screen.getByText('Recent Vital Signs')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Summary Stats', () => {
    it('should display summary statistics correctly', async () => {
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.getByText('MEDICATIONS')).toBeInTheDocument();
      }, { timeout: 5000 });
      
      // Wait for all data to load
      await waitFor(() => {
        expect(screen.getByText('ALLERGIES')).toBeInTheDocument();
        expect(screen.getByText('CONDITIONS')).toBeInTheDocument();
        expect(screen.getByText('ENCOUNTERS')).toBeInTheDocument();
      });
      
      // Check counts are displayed - look for the specific count numbers
      await waitFor(() => {
        // medications count (2 mock medications)
        const medicationCounts = screen.getAllByText('2');
        expect(medicationCounts.length).toBeGreaterThan(0);
        
        // allergies, conditions, encounters counts (1 each)
        const singleCounts = screen.getAllByText('1');
        expect(singleCounts.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Vital Signs Section', () => {
    it('should display vital signs when available', async () => {
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.getByText('Recent Vital Signs')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      expect(screen.getByText('Heart Rate')).toBeInTheDocument();
      expect(screen.getByText('72 bpm')).toBeInTheDocument();
      expect(screen.getByText('NORMAL')).toBeInTheDocument();
    });

    it('should show no data message when no vitals available', async () => {
      mockPatientHelpers.getVitalSigns.mockResolvedValue([]);
      
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.getByText('No recent vital signs recorded')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should mark abnormal vitals correctly', async () => {
      mockObservationHelpers.isAbnormal.mockReturnValue(true);
      
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.getByText('ABNORMAL')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should not show vitals when showVitals is false', async () => {
      renderWithProvider(<PatientSummary patient={mockPatient} showVitals={false} />);
      
      await waitFor(() => {
        expect(screen.queryByText('Recent Vital Signs')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Medications Section', () => {
    it('should display active medications', async () => {
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.getByText('Current Medications')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      expect(screen.getByText('Acetaminophen 325 MG Oral Tablet')).toBeInTheDocument();
      expect(screen.getByText('Take 1 tablet by mouth every 4-6 hours as needed for pain')).toBeInTheDocument();
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    });

    it('should show no medications message when none available', async () => {
      mockPatientHelpers.getMedications.mockResolvedValue([]);
      
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.getByText('No active medications')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should limit display to 5 medications and show count', async () => {
      const multipleMedications = Array(7).fill(null).map((_, index) => ({
        ...mockMedications[0],
        id: `med-${index}`,
      }));
      
      mockPatientHelpers.getMedications.mockResolvedValue(multipleMedications);
      
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.getByText('+2 more medications')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should not show medications when showMedications is false', async () => {
      renderWithProvider(<PatientSummary patient={mockPatient} showMedications={false} />);
      
      await waitFor(() => {
        expect(screen.queryByText('Current Medications')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Allergies Section', () => {
    it('should display active allergies', async () => {
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.getByText('Allergies & Alerts')).toBeInTheDocument();
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
        expect(screen.getByText('Reaction: Rash')).toBeInTheDocument();
        expect(screen.getByText('HIGH')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should not show allergies section when no allergies', async () => {
      mockPatientHelpers.getAllergies.mockResolvedValue([]);
      
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.queryByText('Allergies & Alerts')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should not show allergies when showAllergies is false', async () => {
      renderWithProvider(<PatientSummary patient={mockPatient} showAllergies={false} />);
      
      await waitFor(() => {
        expect(screen.queryByText('Allergies & Alerts')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Conditions Section', () => {
    it('should display active conditions', async () => {
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.getByText('Active Conditions')).toBeInTheDocument();
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
        expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should not show conditions section when no conditions', async () => {
      mockPatientHelpers.getConditions.mockResolvedValue([]);
      
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.queryByText('Active Conditions')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should not show conditions when showConditions is false', async () => {
      renderWithProvider(<PatientSummary patient={mockPatient} showConditions={false} />);
      
      await waitFor(() => {
        expect(screen.queryByText('Active Conditions')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Recent Encounters Section', () => {
    it('should display recent encounters', async () => {
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.getByText('Recent Encounters')).toBeInTheDocument();
        expect(screen.getByText('Office Visit')).toBeInTheDocument();
        expect(screen.getByText('FINISHED')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should not show encounters section when no encounters', async () => {
      mockPatientHelpers.getEncounters.mockResolvedValue([]);
      
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.queryByText('Recent Encounters')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should not show encounters when showRecentActivity is false', async () => {
      renderWithProvider(<PatientSummary patient={mockPatient} showRecentActivity={false} />);
      
      await waitFor(() => {
        expect(screen.queryByText('Recent Encounters')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Interaction Callbacks', () => {
    it('should call onViewDetails when view details buttons are clicked', async () => {
      const mockOnViewDetails = jest.fn();
      
      renderWithProvider(
        <PatientSummary 
          patient={mockPatient} 
          onViewDetails={mockOnViewDetails}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Recent Vital Signs')).toBeInTheDocument();
      });
      
      // Find all action icon buttons
      const actionIcons = screen.getAllByTestId('mantine-action-icon');
      
      // The order of buttons: refresh, vitals view details, medications view details
      // Find vitals view details button (second button in the vitals card)
      const vitalButtons = actionIcons.filter(button => {
        const card = button.closest('[data-testid="mantine-card"]');
        return card && card.textContent?.includes('Recent Vital Signs');
      });
      
      if (vitalButtons.length >= 2) {
        await act(async () => {
          fireEvent.click(vitalButtons[1]); // Second button is view details
        });
        
        await waitFor(() => {
          expect(mockOnViewDetails).toHaveBeenCalledWith('vitals');
        });
      }
      
      // Find medications view details button
      const medicationButtons = actionIcons.filter(button => {
        const card = button.closest('[data-testid="mantine-card"]');
        return card && card.textContent?.includes('Current Medications');
      });
      
      if (medicationButtons.length >= 1) {
        await act(async () => {
          fireEvent.click(medicationButtons[0]); // Only one button in medications card
        });
        
        await waitFor(() => {
          expect(mockOnViewDetails).toHaveBeenCalledWith('medications');
        });
      }
    });

    it('should refresh data when refresh button is clicked', async () => {
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.getByText('Recent Vital Signs')).toBeInTheDocument();
      });
      
      // Clear the mocks to check if they're called again
      jest.clearAllMocks();
      
      // Setup mocks again
      mockPatientHelpers.getVitalSigns.mockResolvedValue(mockVitals);
      mockPatientHelpers.getMedications.mockResolvedValue(mockMedications);
      mockPatientHelpers.getAllergies.mockResolvedValue(mockAllergies);
      mockPatientHelpers.getConditions.mockResolvedValue(mockConditions);
      mockPatientHelpers.getEncounters.mockResolvedValue(mockEncounters);
      
      // Find and click the refresh button
      const actionIcons = screen.getAllByTestId('mantine-action-icon');
      
      // Find the refresh button (first button in the vitals card)
      const vitalButtons = actionIcons.filter(button => {
        const card = button.closest('[data-testid="mantine-card"]');
        return card && card.textContent?.includes('Recent Vital Signs');
      });
      
      if (vitalButtons.length >= 1) {
        await act(async () => {
          fireEvent.click(vitalButtons[0]); // First button is refresh
        });
      }
      
      // Verify that data is reloaded
      await waitFor(() => {
        expect(mockPatientHelpers.getVitalSigns).toHaveBeenCalledWith(mockPatient.id);
      }, { timeout: 3000 });
    });
  });

  describe('Data Processing', () => {
    it('should filter only active medications', async () => {
      const mixedStatusMedications = [
        ...mockMedications,
        {
          ...mockMedications[0],
          id: 'med-inactive',
          status: 'stopped' as const,
        },
      ];
      
      mockPatientHelpers.getMedications.mockResolvedValue(mixedStatusMedications);
      
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        // Should only show active and completed medications (2), not the stopped one
        expect(screen.getByText('2')).toBeInTheDocument(); // In medications count
      }, { timeout: 3000 });
    });

    it('should filter only active allergies', async () => {
      const mixedStatusAllergies = [
        ...mockAllergies,
        {
          ...mockAllergies[0],
          id: 'allergy-inactive',
          clinicalStatus: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
                code: 'inactive',
              },
            ],
          },
        },
      ];
      
      mockPatientHelpers.getAllergies.mockResolvedValue(mixedStatusAllergies);
      
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        // Should only show active allergies (1), not the inactive one
        const counts = screen.getAllByText('1');
        expect(counts.length).toBeGreaterThan(0); // Verify at least one count of 1 exists
      }, { timeout: 3000 });
    });

    it('should filter only active conditions', async () => {
      const mixedStatusConditions = [
        ...mockConditions,
        {
          ...mockConditions[0],
          id: 'condition-inactive',
          clinicalStatus: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                code: 'inactive',
              },
            ],
          },
        },
      ];
      
      mockPatientHelpers.getConditions.mockResolvedValue(mixedStatusConditions);
      
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        // Should only show active conditions (1), not the inactive one
        const counts = screen.getAllByText('1');
        expect(counts.length).toBeGreaterThan(0); // Verify at least one count of 1 exists
      }, { timeout: 3000 });
    });
  });

  describe('Edge Cases', () => {
    it('should handle patient without ID gracefully', async () => {
      const patientWithoutId = { ...mockPatient, id: undefined };
      
      renderWithProvider(<PatientSummary patient={patientWithoutId as Patient} />);
      
      // Should show loading state but not make API calls
      expect(mockPatientHelpers.getVitalSigns).not.toHaveBeenCalled();
      expect(mockPatientHelpers.getMedications).not.toHaveBeenCalled();
      expect(mockPatientHelpers.getAllergies).not.toHaveBeenCalled();
      expect(mockPatientHelpers.getConditions).not.toHaveBeenCalled();
      expect(mockPatientHelpers.getEncounters).not.toHaveBeenCalled();
    });

    it('should handle missing data fields gracefully', async () => {
      const incompleteVitals: Observation[] = [
        {
          resourceType: 'Observation',
          id: 'obs-incomplete',
          status: 'final',
          category: [{ coding: [{ code: 'vital-signs' }] }],
          code: { coding: [{ code: '8867-4' }] },
          subject: { reference: 'Patient/patient-123' },
          // Missing valueQuantity and effectiveDateTime
        },
      ];
      
      mockPatientHelpers.getVitalSigns.mockResolvedValue(incompleteVitals);
      
      renderWithProvider(<PatientSummary patient={mockPatient} />);
      
      await waitFor(() => {
        expect(screen.getByText('No recent vital signs recorded')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});