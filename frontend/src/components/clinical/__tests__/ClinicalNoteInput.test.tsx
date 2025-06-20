import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClinicalNoteInput } from '../ClinicalNoteInput';
import { SmartTextService } from '../../../services/smarttext.service';
import { CDSService } from '../../../services/cds.service';
import { FHIRService } from '../../../services/fhir.service';
import { useAuthStore } from '../../../stores/auth';
import { usePatientStore } from '../../../stores/patient';
import { toast } from 'react-toastify';

// Mock dependencies
jest.mock('../../../services/smarttext.service');
jest.mock('../../../services/cds.service');
jest.mock('../../../services/fhir.service');
jest.mock('../../../stores/auth');
jest.mock('../../../stores/patient');
jest.mock('react-toastify');

describe('ClinicalNoteInput', () => {
  const mockUser = userEvent.setup();
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();
  
  const mockAuthUser = {
    id: 'practitioner-123',
    email: 'dr.smith@example.com',
    role: 'physician',
    name: 'Dr. Jane Smith'
  };
  
  const mockPatient = {
    id: 'patient-456',
    name: [{ given: ['John'], family: 'Doe' }],
    birthDate: '1990-01-01',
    gender: 'male'
  };
  
  const mockEncounter = {
    id: 'encounter-789',
    status: 'in-progress',
    subject: { reference: 'Patient/patient-456' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup store mocks
    (useAuthStore as jest.MockedFunction<typeof useAuthStore>).mockReturnValue({ user: mockAuthUser });
    (usePatientStore as jest.MockedFunction<typeof usePatientStore>).mockReturnValue({ 
      currentPatient: mockPatient,
      currentEncounter: mockEncounter 
    });
    
    // Setup service mocks
    (SmartTextService as jest.Mock).mockImplementation(() => ({
      processSmartText: jest.fn().mockResolvedValue({
        processedText: 'Processed clinical note',
        expansions: [
          { original: '.sob', expanded: 'shortness of breath' },
          { original: '.htn', expanded: 'hypertension' }
        ]
      }),
      getSuggestions: jest.fn().mockResolvedValue([
        { text: 'chest pain', score: 0.9 },
        { text: 'chest discomfort', score: 0.8 }
      ])
    }));
    
    (CDSService as jest.Mock).mockImplementation(() => ({
      checkClinicalAlerts: jest.fn().mockResolvedValue({
        alerts: [
          {
            severity: 'warning',
            message: 'Consider ordering chest X-ray',
            type: 'clinical-guideline'
          }
        ]
      })
    }));
    
    (FHIRService as jest.Mock).mockImplementation(() => ({
      createClinicalNote: jest.fn().mockResolvedValue({
        id: 'note-999',
        resourceType: 'DocumentReference',
        status: 'current'
      })
    }));
  });

  describe('Basic Functionality', () => {
    it('renders with all required sections', () => {
      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Clinical Note')).toBeInTheDocument();
      expect(screen.getByLabelText('Chief Complaint')).toBeInTheDocument();
      expect(screen.getByLabelText('History of Present Illness')).toBeInTheDocument();
      expect(screen.getByLabelText('Physical Examination')).toBeInTheDocument();
      expect(screen.getByLabelText('Assessment')).toBeInTheDocument();
      expect(screen.getByLabelText('Plan')).toBeInTheDocument();
      expect(screen.getByText('Save Note')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('allows text input in all fields', async () => {
      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const chiefComplaint = screen.getByLabelText('Chief Complaint');
      const hpi = screen.getByLabelText('History of Present Illness');
      const physicalExam = screen.getByLabelText('Physical Examination');
      const assessment = screen.getByLabelText('Assessment');
      const plan = screen.getByLabelText('Plan');

      await mockUser.type(chiefComplaint, 'Chest pain');
      await mockUser.type(hpi, 'Patient reports sudden onset chest pain');
      await mockUser.type(physicalExam, 'Vital signs stable');
      await mockUser.type(assessment, 'Possible angina');
      await mockUser.type(plan, 'Order ECG and cardiac enzymes');

      expect(chiefComplaint).toHaveValue('Chest pain');
      expect(hpi).toHaveValue('Patient reports sudden onset chest pain');
      expect(physicalExam).toHaveValue('Vital signs stable');
      expect(assessment).toHaveValue('Possible angina');
      expect(plan).toHaveValue('Order ECG and cardiac enzymes');
    });

    it('calls onCancel when cancel button is clicked', async () => {
      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      await mockUser.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('SmartText Integration', () => {
    it('processes SmartText abbreviations on blur', async () => {
      const smartTextService = new SmartTextService();
      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const hpiField = screen.getByLabelText('History of Present Illness');
      
      await mockUser.type(hpiField, 'Patient c/o .sob and .htn');
      await mockUser.tab(); // Trigger blur

      await waitFor(() => {
        expect(smartTextService.processSmartText).toHaveBeenCalledWith(
          'Patient c/o .sob and .htn'
        );
      });

      await waitFor(() => {
        expect(hpiField).toHaveValue('Processed clinical note');
      });
    });

    it('shows SmartText suggestions while typing', async () => {
      const smartTextService = new SmartTextService();
      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const chiefComplaint = screen.getByLabelText('Chief Complaint');
      
      await mockUser.type(chiefComplaint, 'chest');

      await waitFor(() => {
        expect(smartTextService.getSuggestions).toHaveBeenCalledWith('chest');
      });

      await waitFor(() => {
        expect(screen.getByText('chest pain')).toBeInTheDocument();
        expect(screen.getByText('chest discomfort')).toBeInTheDocument();
      });
    });

    it('applies selected suggestion', async () => {
      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const chiefComplaint = screen.getByLabelText('Chief Complaint');
      
      await mockUser.type(chiefComplaint, 'chest');
      
      await waitFor(() => {
        expect(screen.getByText('chest pain')).toBeInTheDocument();
      });

      const suggestion = screen.getByText('chest pain');
      await mockUser.click(suggestion);

      expect(chiefComplaint).toHaveValue('chest pain');
    });
  });

  describe('Clinical Decision Support', () => {
    it('shows CDS alerts when content changes', async () => {
      const cdsService = new CDSService();
      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const assessmentField = screen.getByLabelText('Assessment');
      
      await mockUser.type(assessmentField, 'Suspected pneumonia');
      await mockUser.tab();

      await waitFor(() => {
        expect(cdsService.checkClinicalAlerts).toHaveBeenCalledWith({
          patientId: mockPatient.id,
          noteContent: expect.objectContaining({
            assessment: 'Suspected pneumonia'
          })
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Consider ordering chest X-ray')).toBeInTheDocument();
      });
    });

    it('displays multiple alert severities correctly', async () => {
      const cdsService = new CDSService();
      (cdsService.checkClinicalAlerts as jest.Mock).mockResolvedValue({
        alerts: [
          {
            severity: 'error',
            message: 'Drug interaction detected',
            type: 'medication'
          },
          {
            severity: 'warning',
            message: 'Consider preventive screening',
            type: 'preventive-care'
          },
          {
            severity: 'info',
            message: 'Clinical guideline available',
            type: 'guideline'
          }
        ]
      });

      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const planField = screen.getByLabelText('Plan');
      await mockUser.type(planField, 'Start warfarin');
      await mockUser.tab();

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert', { name: /error/i });
        expect(errorAlert).toHaveTextContent('Drug interaction detected');
        
        const warningAlert = screen.getByRole('alert', { name: /warning/i });
        expect(warningAlert).toHaveTextContent('Consider preventive screening');
        
        const infoAlert = screen.getByRole('alert', { name: /info/i });
        expect(infoAlert).toHaveTextContent('Clinical guideline available');
      });
    });
  });

  describe('Note Templates', () => {
    it('provides note templates selection', () => {
      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const templateSelect = screen.getByLabelText('Note Template');
      expect(templateSelect).toBeInTheDocument();
      
      fireEvent.change(templateSelect, { target: { value: 'soap' } });
      
      expect(screen.getByText('Subjective')).toBeInTheDocument();
      expect(screen.getByText('Objective')).toBeInTheDocument();
      expect(screen.getByText('Assessment')).toBeInTheDocument();
      expect(screen.getByText('Plan')).toBeInTheDocument();
    });

    it('loads template content when selected', async () => {
      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const templateSelect = screen.getByLabelText('Note Template');
      
      fireEvent.change(templateSelect, { target: { value: 'annual-physical' } });

      await waitFor(() => {
        const hpiField = screen.getByLabelText('History of Present Illness');
        expect(hpiField).toHaveValue(expect.stringContaining('Annual physical examination'));
      });
    });
  });

  describe('Save Functionality', () => {
    it('validates required fields before saving', async () => {
      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByText('Save Note');
      await mockUser.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Chief complaint is required')).toBeInTheDocument();
        expect(screen.getByText('Assessment is required')).toBeInTheDocument();
        expect(screen.getByText('Plan is required')).toBeInTheDocument();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('saves note with all fields filled', async () => {
      const fhirService = new FHIRService();
      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Fill all required fields
      await mockUser.type(screen.getByLabelText('Chief Complaint'), 'Chest pain');
      await mockUser.type(screen.getByLabelText('History of Present Illness'), 'Sudden onset chest pain');
      await mockUser.type(screen.getByLabelText('Physical Examination'), 'Normal vital signs');
      await mockUser.type(screen.getByLabelText('Assessment'), 'Possible angina');
      await mockUser.type(screen.getByLabelText('Plan'), 'Order ECG');

      const saveButton = screen.getByText('Save Note');
      await mockUser.click(saveButton);

      await waitFor(() => {
        expect(fhirService.createClinicalNote).toHaveBeenCalledWith({
          encounterId: mockEncounter.id,
          patientId: mockPatient.id,
          practitionerId: mockAuthUser.id,
          sections: {
            chiefComplaint: 'Chest pain',
            historyOfPresentIllness: 'Sudden onset chest pain',
            physicalExamination: 'Normal vital signs',
            assessment: 'Possible angina',
            plan: 'Order ECG'
          },
          metadata: expect.objectContaining({
            noteType: 'progress-note',
            createdAt: expect.any(String)
          })
        });
      });

      expect(mockOnSave).toHaveBeenCalledWith({
        id: 'note-999',
        resourceType: 'DocumentReference',
        status: 'current'
      });

      expect(toast.success).toHaveBeenCalledWith('Clinical note saved successfully');
    });

    it('handles save errors gracefully', async () => {
      const fhirService = new FHIRService();
      (fhirService.createClinicalNote as jest.Mock).mockRejectedValue(
        new Error('Failed to save note')
      );

      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Fill required fields
      await mockUser.type(screen.getByLabelText('Chief Complaint'), 'Test');
      await mockUser.type(screen.getByLabelText('Assessment'), 'Test');
      await mockUser.type(screen.getByLabelText('Plan'), 'Test');

      const saveButton = screen.getByText('Save Note');
      await mockUser.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to save clinical note');
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Auto-save Functionality', () => {
    it('auto-saves draft after period of inactivity', async () => {
      jest.useFakeTimers();
      
      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          enableAutoSave
        />
      );

      const chiefComplaint = screen.getByLabelText('Chief Complaint');
      await mockUser.type(chiefComplaint, 'Auto-save test');

      // Fast-forward 30 seconds (auto-save interval)
      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(screen.getByText('Draft saved')).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('loads previously saved draft', async () => {
      const mockDraft = {
        chiefComplaint: 'Previous chest pain',
        assessment: 'Previous assessment',
        plan: 'Previous plan',
        savedAt: new Date().toISOString()
      };

      // Mock localStorage
      Storage.prototype.getItem = jest.fn(() => JSON.stringify(mockDraft));

      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          enableAutoSave
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Chief Complaint')).toHaveValue('Previous chest pain');
        expect(screen.getByLabelText('Assessment')).toHaveValue('Previous assessment');
        expect(screen.getByLabelText('Plan')).toHaveValue('Previous plan');
      });

      expect(screen.getByText(/Draft loaded from/)).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('saves note with Ctrl+S', async () => {
      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Fill required fields
      await mockUser.type(screen.getByLabelText('Chief Complaint'), 'Test');
      await mockUser.type(screen.getByLabelText('Assessment'), 'Test');
      await mockUser.type(screen.getByLabelText('Plan'), 'Test');

      // Trigger Ctrl+S
      fireEvent.keyDown(document, { key: 's', ctrlKey: true });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });
    });

    it('cancels with Escape key', () => {
      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Voice Dictation', () => {
    it('shows voice dictation button when supported', () => {
      // Mock speech recognition support
      window.webkitSpeechRecognition = jest.fn();

      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          enableVoiceDictation
        />
      );

      const dictationButtons = screen.getAllByLabelText(/Start voice dictation/);
      expect(dictationButtons.length).toBeGreaterThan(0);
    });

    it('starts and stops voice dictation', async () => {
      const mockRecognition = {
        start: jest.fn(),
        stop: jest.fn(),
        addEventListener: jest.fn()
      };
      
      window.webkitSpeechRecognition = jest.fn(() => mockRecognition);

      render(
        <ClinicalNoteInput 
          encounterId={mockEncounter.id}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          enableVoiceDictation
        />
      );

      const dictationButton = screen.getAllByLabelText(/Start voice dictation/)[0];
      
      await mockUser.click(dictationButton);
      expect(mockRecognition.start).toHaveBeenCalled();

      await mockUser.click(dictationButton);
      expect(mockRecognition.stop).toHaveBeenCalled();
    });
  });
});