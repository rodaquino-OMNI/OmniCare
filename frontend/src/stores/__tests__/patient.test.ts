import { renderHook, act, waitFor } from '@testing-library/react';
import { usePatientStore, useCurrentPatient, usePatientSearch } from '../patient';
import { Patient, VitalSigns, ClinicalNote, Encounter, MedicationOrder, LabResult } from '@/types';
import { patientCacheService } from '@/services/patient-cache.service';

// Mock dependencies
jest.mock('@/services/patient-cache.service', () => ({
  patientCacheService: {
    warmupCache: jest.fn()
  }
}));

// Mock fetch
global.fetch = jest.fn();

// Helper function to create test patient
const createTestPatient = (overrides?: Partial<Patient>): Patient => ({
  id: '1',
  mrn: 'MRN01',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '199-1-1',
  gender: 'male',
  email: 'john.doe@example.com',
  phone: '555-1234',
  address: {
    street: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    zipCode: '12345',
    country: 'USA'
  },
  status: 'active',
  createdAt: '2024-1-1T00:00:00Z',
  updatedAt: '2024-1-1T00:00:00Z',
  ...overrides
});

describe('Patient Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset zustand store
    usePatientStore.setState({
      currentPatient: null,
      currentEncounter: null,
      patients: [],
      filteredPatients: [],
      searchQuery: '',
      selectedPatients: [],
      patientVitals: [],
      patientNotes: [],
      patientEncounters: [],
      patientMedications: [],
      patientLabResults: [],
      isLoading: false,
      error: null,
      viewMode: 'list',
      sortBy: 'name',
      sortOrder: 'asc',
      filters: {
        status: 'all',
        department: '',
        provider: '',
        ageRange: null,
        gender: 'all',
      }
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => usePatientStore());

      expect(result.current.currentPatient).toBeNull();
      expect(result.current.currentEncounter).toBeNull();
      expect(result.current.patients).toEqual([]);
      expect(result.current.filteredPatients).toEqual([]);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.selectedPatients).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.viewMode).toBe('list');
      expect(result.current.sortBy).toBe('name');
      expect(result.current.sortOrder).toBe('asc');
    });
  });

  describe('Patient Management', () => {
    it('should add a patient', () => {
      const { result } = renderHook(() => usePatientStore());
      const newPatient = createTestPatient();

      act(() => {
        result.current.addPatient(newPatient);
      });

      expect(result.current.patients).toHaveLength(1);
      expect(result.current.patients[0]).toEqual(newPatient);
      expect(result.current.filteredPatients).toHaveLength(1);
    });

    it('should update a patient', () => {
      const { result } = renderHook(() => usePatientStore());
      const patient = createTestPatient();

      act(() => {
        result.current.addPatient(patient);
        result.current.updatePatient('1', { firstName: 'Jane' });
      });

      expect(result.current.patients[0].firstName).toBe('Jane');
      expect(result.current.filteredPatients[0].firstName).toBe('Jane');
    });

    it('should update current patient when updating its data', () => {
      const { result } = renderHook(() => usePatientStore());
      const patient = createTestPatient();

      act(() => {
        result.current.addPatient(patient);
        result.current.setCurrentPatient(patient);
        result.current.updatePatient('1', { firstName: 'Jane' });
      });

      expect(result.current.currentPatient?.firstName).toBe('Jane');
    });

    it('should remove a patient', () => {
      const { result } = renderHook(() => usePatientStore());
      const patient1 = createTestPatient();
      const patient2 = createTestPatient({ id: '2', mrn: 'MRN02' });

      act(() => {
        result.current.addPatient(patient1);
        result.current.addPatient(patient2);
        result.current.removePatient('1');
      });

      expect(result.current.patients).toHaveLength(1);
      expect(result.current.patients[0].id).toBe('2');
    });

    it('should clear current patient when removing it', () => {
      const { result } = renderHook(() => usePatientStore());
      const patient = createTestPatient();

      act(() => {
        result.current.addPatient(patient);
        result.current.setCurrentPatient(patient);
        result.current.removePatient('1');
      });

      expect(result.current.currentPatient).toBeNull();
    });

    it('should remove patient from selection when removing it', () => {
      const { result } = renderHook(() => usePatientStore());
      const patient = createTestPatient();

      act(() => {
        result.current.addPatient(patient);
        result.current.selectPatient('1');
        result.current.removePatient('1');
      });

      expect(result.current.selectedPatients).toEqual([]);
    });
  });

  describe('Current Patient and Encounter', () => {
    it('should set current patient and trigger loading details', async () => {
      const { result } = renderHook(() => usePatientStore());
      const patient = createTestPatient();
      
      // Mock API responses
      (fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => [] }) // vitals
        .mockResolvedValueOnce({ ok: true, json: async () => [] }) // notes
        .mockResolvedValueOnce({ ok: true, json: async () => [] }) // encounters
        .mockResolvedValueOnce({ ok: true, json: async () => [] }) // medications
        .mockResolvedValueOnce({ ok: true, json: async () => [] }); // lab results

      act(() => {
        result.current.setCurrentPatient(patient);
      });

      expect(result.current.currentPatient).toEqual(patient);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/patients/1/vitals');
        expect(fetch).toHaveBeenCalledWith('/api/patients/1/notes');
      });
    });

    it('should set current encounter', () => {
      const { result } = renderHook(() => usePatientStore());
      const encounter: Encounter = {
        id: 'enc-1',
        patientId: '1',
        date: '2024-1-1',
        type: 'routine',
        status: 'completed',
        providerId: 'doc-1',
        providerName: 'Dr. Smith',
        chiefComplaint: 'Annual checkup',
        diagnosis: [],
        notes: '',
        vitals: null,
        createdAt: '2024-1-1T00:00:00Z',
        updatedAt: '2024-1-1T00:00:00Z'
      };

      act(() => {
        result.current.setCurrentEncounter(encounter);
      });

      expect(result.current.currentEncounter).toEqual(encounter);
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(() => {
      const { result } = renderHook(() => usePatientStore());
      
      act(() => {
        result.current.addPatient(createTestPatient({ 
          id: '1', 
          firstName: 'John', 
          lastName: 'Doe',
          gender: 'male',
          status: 'active',
          dateOfBirth: '199-1-1'
        }));
        result.current.addPatient(createTestPatient({ 
          id: '2', 
          firstName: 'Jane', 
          lastName: 'Smith',
          mrn: 'MRN02',
          gender: 'female',
          status: 'inactive',
          dateOfBirth: '1985-1-1'
        }));
        result.current.addPatient(createTestPatient({ 
          id: '3', 
          firstName: 'Bob', 
          lastName: 'Johnson',
          mrn: 'MRN03',
          gender: 'male',
          status: 'active',
          email: 'bob@example.com',
          dateOfBirth: '200-1-1'
        }));
      });
    });

    it('should filter patients by search query (name)', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setSearchQuery('jane');
      });

      expect(result.current.filteredPatients).toHaveLength(1);
      expect(result.current.filteredPatients[0].firstName).toBe('Jane');
    });

    it('should filter patients by search query (MRN)', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setSearchQuery('MRN02');
      });

      expect(result.current.filteredPatients).toHaveLength(1);
      expect(result.current.filteredPatients[0].mrn).toBe('MRN02');
    });

    it('should filter patients by search query (email)', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setSearchQuery('bob@');
      });

      expect(result.current.filteredPatients).toHaveLength(1);
      expect(result.current.filteredPatients[0].email).toBe('bob@example.com');
    });

    it('should filter patients by status', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setFilter('status', 'active');
      });

      expect(result.current.filteredPatients).toHaveLength(2);
      expect(result.current.filteredPatients.every(p => p.status === 'active')).toBe(true);
    });

    it('should filter patients by gender', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setFilter('gender', 'female');
      });

      expect(result.current.filteredPatients).toHaveLength(1);
      expect(result.current.filteredPatients[0].gender).toBe('female');
    });

    it('should filter patients by age range', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setFilter('ageRange', [3, 4]);
      });

      // John (34 years old) and Jane (39 years old) should be included
      expect(result.current.filteredPatients).toHaveLength(2);
      expect(result.current.filteredPatients.map(p => p.id).sort()).toEqual(['1', '2']);
    });

    it('should apply multiple filters', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setFilter('status', 'active');
        result.current.setFilter('gender', 'male');
      });

      expect(result.current.filteredPatients).toHaveLength(2);
      expect(result.current.filteredPatients.every(p => 
        p.status === 'active' && p.gender === 'male'
      )).toBe(true);
    });

    it('should clear all filters', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setFilter('status', 'active');
        result.current.setSearchQuery('john');
        result.current.clearFilters();
      });

      expect(result.current.filteredPatients).toHaveLength(3);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.filters.status).toBe('all');
    });
  });

  describe('Sorting', () => {
    beforeEach(() => {
      const { result } = renderHook(() => usePatientStore());
      
      act(() => {
        result.current.addPatient(createTestPatient({ 
          id: '1', 
          firstName: 'Charlie', 
          lastName: 'Brown',
          mrn: 'MRN03',
          dateOfBirth: '199-1-1',
          updatedAt: '2024-1-3T00:00:00Z'
        }));
        result.current.addPatient(createTestPatient({ 
          id: '2', 
          firstName: 'Alice', 
          lastName: 'Anderson',
          mrn: 'MRN01',
          dateOfBirth: '1985-1-1',
          updatedAt: '2024-1-1T00:00:00Z'
        }));
        result.current.addPatient(createTestPatient({ 
          id: '3', 
          firstName: 'Bob', 
          lastName: 'Baker',
          mrn: 'MRN02',
          dateOfBirth: '1995-1-1',
          updatedAt: '2024-1-2T00:00:00Z'
        }));
      });
    });

    it('should sort by name ascending', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setSortBy('name');
        result.current.setSortOrder('asc');
      });

      expect(result.current.filteredPatients[0].lastName).toBe('Anderson');
      expect(result.current.filteredPatients[1].lastName).toBe('Baker');
      expect(result.current.filteredPatients[2].lastName).toBe('Brown');
    });

    it('should sort by name descending', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setSortBy('name');
        result.current.setSortOrder('desc');
      });

      expect(result.current.filteredPatients[0].lastName).toBe('Brown');
      expect(result.current.filteredPatients[1].lastName).toBe('Baker');
      expect(result.current.filteredPatients[2].lastName).toBe('Anderson');
    });

    it('should sort by MRN', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setSortBy('mrn');
        result.current.setSortOrder('asc');
      });

      expect(result.current.filteredPatients[0].mrn).toBe('MRN01');
      expect(result.current.filteredPatients[1].mrn).toBe('MRN02');
      expect(result.current.filteredPatients[2].mrn).toBe('MRN03');
    });

    it('should sort by date of birth', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setSortBy('dob');
        result.current.setSortOrder('asc');
      });

      expect(result.current.filteredPatients[0].id).toBe('2'); // Oldest first
      expect(result.current.filteredPatients[2].id).toBe('3'); // Youngest last
    });

    it('should sort by last visit', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setSortBy('lastVisit');
        result.current.setSortOrder('desc');
      });

      expect(result.current.filteredPatients[0].id).toBe('1'); // Most recent first
      expect(result.current.filteredPatients[2].id).toBe('2'); // Least recent last
    });
  });

  describe('Selection', () => {
    beforeEach(() => {
      const { result } = renderHook(() => usePatientStore());
      
      act(() => {
        result.current.addPatient(createTestPatient({ id: '1' }));
        result.current.addPatient(createTestPatient({ id: '2' }));
        result.current.addPatient(createTestPatient({ id: '3' }));
      });
    });

    it('should select a patient', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.selectPatient('1');
      });

      expect(result.current.selectedPatients).toContain('1');
    });

    it('should deselect a patient', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.selectPatient('1');
        result.current.selectPatient('2');
        result.current.deselectPatient('1');
      });

      expect(result.current.selectedPatients).toEqual(['2']);
    });

    it('should select all patients', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.selectAllPatients();
      });

      expect(result.current.selectedPatients).toHaveLength(3);
      expect(result.current.selectedPatients).toEqual(['1', '2', '3']);
    });

    it('should clear selection', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.selectAllPatients();
        result.current.clearSelection();
      });

      expect(result.current.selectedPatients).toEqual([]);
    });
  });

  describe('View Mode', () => {
    it('should set view mode', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setViewMode('cards');
      });

      expect(result.current.viewMode).toBe('cards');

      act(() => {
        result.current.setViewMode('timeline');
      });

      expect(result.current.viewMode).toBe('timeline');
    });
  });

  describe('Data Loading', () => {
    it('should load patients successfully', async () => {
      const { result } = renderHook(() => usePatientStore());
      const mockPatients = [
        createTestPatient({ id: '1', lastVisit: new Date().toISOString() }),
        createTestPatient({ id: '2' }),
      ];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPatients
      });

      await act(async () => {
        await result.current.loadPatients();
      });

      expect(result.current.patients).toEqual(mockPatients);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(patientCacheService.warmupCache).toHaveBeenCalledWith(['1']);
    });

    it('should handle patient loading error', async () => {
      const { result } = renderHook(() => usePatientStore());

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false
      });

      await act(async () => {
        await result.current.loadPatients();
      });

      expect(result.current.patients).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Failed to load patients');
    });

    it('should handle network error during patient loading', async () => {
      const { result } = renderHook(() => usePatientStore());
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await result.current.loadPatients();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Network error');
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should load patient details successfully', async () => {
      const { result } = renderHook(() => usePatientStore());
      
      const mockVitals: VitalSigns[] = [{
        id: 'v1',
        patientId: '1',
        encounterId: 'e1',
        dateTime: '2024-1-1T00:00:00Z',
        temperature: 98.6,
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 8,
        heartRate: 72,
        respiratoryRate: 16,
        oxygenSaturation: 98,
        recordedBy: 'nurse1',
        createdAt: '2024-1-1T00:00:00Z',
        updatedAt: '2024-1-1T00:00:00Z'
      }];
      
      const mockNotes: ClinicalNote[] = [{
        id: 'n1',
        patientId: '1',
        encounterId: 'e1',
        type: 'progress',
        content: 'Patient is doing well',
        authorId: 'doc1',
        authorName: 'Dr. Smith',
        createdAt: '2024-1-1T00:00:00Z',
        updatedAt: '2024-1-1T00:00:00Z'
      }];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => mockVitals })
        .mockResolvedValueOnce({ ok: true, json: async () => mockNotes })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      await act(async () => {
        await result.current.loadPatientDetails('1');
      });

      expect(result.current.patientVitals).toEqual(mockVitals);
      expect(result.current.patientNotes).toEqual(mockNotes);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle patient details loading error', async () => {
      const { result } = renderHook(() => usePatientStore());
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to load'));

      await act(async () => {
        await result.current.loadPatientDetails('1');
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Failed to load');
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Clinical Data Management', () => {
    it('should add vital signs', () => {
      const { result } = renderHook(() => usePatientStore());
      const vitals: VitalSigns = {
        id: 'v1',
        patientId: '1',
        encounterId: 'e1',
        dateTime: '2024-1-1T00:00:00Z',
        temperature: 98.6,
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 8,
        heartRate: 72,
        respiratoryRate: 16,
        oxygenSaturation: 98,
        recordedBy: 'nurse1',
        createdAt: '2024-1-1T00:00:00Z',
        updatedAt: '2024-1-1T00:00:00Z'
      };

      act(() => {
        result.current.addVitalSigns(vitals);
      });

      expect(result.current.patientVitals).toHaveLength(1);
      expect(result.current.patientVitals[0]).toEqual(vitals);
    });

    it('should add clinical note', () => {
      const { result } = renderHook(() => usePatientStore());
      const note: ClinicalNote = {
        id: 'n1',
        patientId: '1',
        encounterId: 'e1',
        type: 'progress',
        content: 'Patient is improving',
        authorId: 'doc1',
        authorName: 'Dr. Smith',
        createdAt: '2024-1-1T00:00:00Z',
        updatedAt: '2024-1-1T00:00:00Z'
      };

      act(() => {
        result.current.addClinicalNote(note);
      });

      expect(result.current.patientNotes).toHaveLength(1);
      expect(result.current.patientNotes[0]).toEqual(note);
    });

    it('should update clinical note', () => {
      const { result } = renderHook(() => usePatientStore());
      const note: ClinicalNote = {
        id: 'n1',
        patientId: '1',
        encounterId: 'e1',
        type: 'progress',
        content: 'Initial note',
        authorId: 'doc1',
        authorName: 'Dr. Smith',
        createdAt: '2024-1-1T00:00:00Z',
        updatedAt: '2024-1-1T00:00:00Z'
      };

      act(() => {
        result.current.addClinicalNote(note);
        result.current.updateClinicalNote('n1', { content: 'Updated note' });
      });

      expect(result.current.patientNotes[0].content).toBe('Updated note');
    });
  });

  describe('Utility Functions', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should set error state', () => {
      const { result } = renderHook(() => usePatientStore());

      act(() => {
        result.current.setError('Test error');
      });

      expect(result.current.error).toBe('Test error');

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });

    it('should get patient by ID', () => {
      const { result } = renderHook(() => usePatientStore());
      const patient = createTestPatient({ id: '123' });

      act(() => {
        result.current.addPatient(patient);
      });

      const foundPatient = result.current.getPatientById('123');
      expect(foundPatient).toEqual(patient);

      const notFound = result.current.getPatientById('999');
      expect(notFound).toBeUndefined();
    });

    it('should get patient by MRN', () => {
      const { result } = renderHook(() => usePatientStore());
      const patient = createTestPatient({ mrn: 'MRN12345' });

      act(() => {
        result.current.addPatient(patient);
      });

      const foundPatient = result.current.getPatientByMRN('MRN12345');
      expect(foundPatient).toEqual(patient);

      const notFound = result.current.getPatientByMRN('MRN99999');
      expect(notFound).toBeUndefined();
    });
  });

  describe('useCurrentPatient Hook', () => {
    it('should provide current patient data and actions', async () => {
      const { result } = renderHook(() => useCurrentPatient());
      const patient = createTestPatient();

      // Mock API responses for patient details
      (fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      expect(result.current.patient).toBeNull();

      act(() => {
        result.current.setPatient(patient);
      });

      expect(result.current.patient).toEqual(patient);
      expect(typeof result.current.setEncounter).toBe('function');
      expect(typeof result.current.loadDetails).toBe('function');
    });
  });

  describe('usePatientSearch Hook', () => {
    it('should provide search functionality and state', () => {
      const { result } = renderHook(() => usePatientSearch());

      expect(result.current.patients).toEqual([]);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.filters.status).toBe('all');
      expect(result.current.viewMode).toBe('list');
      expect(result.current.sortBy).toBe('name');
      expect(result.current.sortOrder).toBe('asc');
      expect(result.current.selectedPatients).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();

      // Check that all action functions are available
      expect(typeof result.current.setSearchQuery).toBe('function');
      expect(typeof result.current.setFilter).toBe('function');
      expect(typeof result.current.clearFilters).toBe('function');
      expect(typeof result.current.setViewMode).toBe('function');
      expect(typeof result.current.setSortBy).toBe('function');
      expect(typeof result.current.setSortOrder).toBe('function');
      expect(typeof result.current.selectPatient).toBe('function');
      expect(typeof result.current.deselectPatient).toBe('function');
      expect(typeof result.current.selectAll).toBe('function');
      expect(typeof result.current.clearSelection).toBe('function');
      expect(typeof result.current.loadPatients).toBe('function');
    });
  });
});

describe('calculateAge Helper', () => {
  it('should calculate age correctly', () => {
    // Since calculateAge is not exported, we test it indirectly through filtering
    const { result } = renderHook(() => usePatientStore());
    
    const today = new Date();
    const currentYear = today.getFullYear();
    
    act(() => {
      // Add patient who is exactly 3 years old
      result.current.addPatient(createTestPatient({ 
        id: '1',
        dateOfBirth: `${currentYear - 3}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      }));
      
      // Add patient who is 29 (birthday tomorrow)
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      result.current.addPatient(createTestPatient({ 
        id: '2',
        dateOfBirth: `${currentYear - 3}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
      }));
      
      result.current.setFilter('ageRange', [3, 3]);
    });

    expect(result.current.filteredPatients).toHaveLength(1);
    expect(result.current.filteredPatients[0].id).toBe('1');
  });
});