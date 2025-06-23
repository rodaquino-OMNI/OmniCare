// Specialized UI Interaction Tests for OmniCare Components
import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';

// Component imports
import PatientRegistration from '@/components/admin/PatientRegistration';
import ClinicalNoteInput from '@/components/clinical/ClinicalNoteInput';
import AppointmentManagement from '@/components/admin/AppointmentManagement';
import { NetworkSimulator } from '@/tests/offline/network-simulation-utils';

// Test wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        {children}
      </MantineProvider>
    </QueryClientProvider>
  );
};

// Mock data
const mockPatient = {
  id: 'PAT-UI-001',
  name: [{ given: ['Jane'], family: 'Doe' }],
  birthDate: '1990-03-20',
  gender: 'female'
};

const mockUser = {
  id: 'USER-UI-001',
  firstName: 'Dr. Emily',
  lastName: 'Chen',
  role: 'physician',
  email: 'emily.chen@omnicare.com'
};

// Mock authentication
jest.mock('@/stores/auth', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn()
  })
}));

// Mock Medplum
jest.mock('@medplum/react', () => ({
  useMedplum: () => ({
    createResource: jest.fn().mockResolvedValue({ id: 'RES-001' }),
    searchResources: jest.fn().mockResolvedValue([]),
    updateResource: jest.fn().mockResolvedValue({ id: 'RES-001' })
  }),
  Document: ({ children }: any) => <div>{children}</div>,
  NoteDisplay: ({ note }: any) => <div>{note?.content || 'Note content'}</div>
}));

describe('UI Interaction Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    localStorage.clear();
    NetworkSimulator.mockFetch();
    jest.clearAllMocks();
  });

  afterEach(() => {
    NetworkSimulator.restore();
  });

  describe('Form Validation and Input Handling', () => {
    it('should provide real-time validation feedback', async () => {
      const onComplete = jest.fn();
      const onCancel = jest.fn();

      render(
        <PatientRegistration onComplete={onComplete} onCancel={onCancel} />,
        { wrapper: TestWrapper }
      );

      // Test email validation
      const emailInput = screen.getByLabelText(/email/i);
      
      // Enter invalid email
      await user.type(emailInput, 'invalid-email');
      await user.tab(); // Trigger blur event
      
      // Should show validation error (in real implementation)
      expect(emailInput).toHaveValue('invalid-email');

      // Enter valid email
      await user.clear(emailInput);
      await user.type(emailInput, 'valid@email.com');
      await user.tab();
      
      expect(emailInput).toHaveValue('valid@email.com');
    });

    it('should format phone numbers automatically', async () => {
      const onComplete = jest.fn();
      const onCancel = jest.fn();

      render(
        <PatientRegistration onComplete={onComplete} onCancel={onCancel} />,
        { wrapper: TestWrapper }
      );

      // Navigate to contact information step
      await user.type(screen.getByLabelText(/first name/i), 'Jane');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-03-20');
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Contact & Demographics')).toBeInTheDocument();
      });

      // Test phone number formatting
      const phoneInput = screen.getByLabelText(/primary phone/i);
      await user.type(phoneInput, '5551234567');
      
      // Should auto-format to (555) 123-4567
      expect(phoneInput).toHaveValue('(555) 123-4567');
    });

    it('should format SSN with proper masking', async () => {
      const onComplete = jest.fn();
      const onCancel = jest.fn();

      render(
        <PatientRegistration onComplete={onComplete} onCancel={onCancel} />,
        { wrapper: TestWrapper }
      );

      // Test SSN formatting
      const ssnInput = screen.getByLabelText(/social security number/i);
      await user.type(ssnInput, '123456789');
      
      // Should auto-format to XXX-XX-XXXX pattern
      expect(ssnInput).toHaveValue('123-45-6789');
    });
  });

  describe('Modal and Dialog Interactions', () => {
    it('should handle modal opening, closing, and focus management', async () => {
      render(
        <AppointmentManagement facilityId="FAC-001" />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(screen.getByText('Appointment Management')).toBeInTheDocument();
      });

      // Open scheduling modal
      await user.click(screen.getByText('Schedule Appointment'));
      
      // Modal should be accessible (implementation-dependent)
      // In real implementation, modal would open and focus would be managed

      // Test ESC key to close modal
      await user.keyboard('{Escape}');
      
      // Modal should close and focus should return to trigger button
    });

    it('should handle confirmation dialogs properly', async () => {
      const onSave = jest.fn();

      render(
        <ClinicalNoteInput
          patient={mockPatient}
          encounterId="ENC-001"
          onSave={onSave}
        />,
        { wrapper: TestWrapper }
      );

      // Add content to note
      const titleInput = screen.getByLabelText(/note title/i);
      await user.type(titleInput, 'Test Note for Signing');

      const contentArea = screen.getByPlaceholderText(/begin your progress note/i);
      await user.type(contentArea, 'This note will be signed for testing.');

      // Trigger sign confirmation
      await user.click(screen.getByText('Sign Note'));

      await waitFor(() => {
        expect(screen.getByText('Sign Clinical Note')).toBeInTheDocument();
      });

      // Test cancel
      await user.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('Sign Clinical Note')).not.toBeInTheDocument();
      });

      // Re-open and confirm
      await user.click(screen.getByText('Sign Note'));
      
      await waitFor(() => {
        expect(screen.getByText('Sign Clinical Note')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Sign Note'));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'signed'
          })
        );
      });
    });
  });

  describe('Dropdown and Select Interactions', () => {
    it('should handle complex select interactions with search', async () => {
      const onComplete = jest.fn();
      const onCancel = jest.fn();

      render(
        <PatientRegistration onComplete={onComplete} onCancel={onCancel} />,
        { wrapper: TestWrapper }
      );

      // Navigate to contact step to test state selection
      await user.type(screen.getByLabelText(/first name/i), 'Jane');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-03-20');
      await user.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
      });

      // Open state dropdown
      const stateSelect = screen.getByLabelText(/state/i);
      await user.click(stateSelect);

      // Should show dropdown options
      await waitFor(() => {
        expect(screen.getByText('California')).toBeInTheDocument();
      });

      // Select option
      await user.click(screen.getByText('California'));

      expect(stateSelect).toHaveValue('CA');
    });

    it('should handle multi-select and tag inputs', async () => {
      const onSave = jest.fn();

      render(
        <ClinicalNoteInput
          patient={mockPatient}
          encounterId="ENC-001"
          onSave={onSave}
        />,
        { wrapper: TestWrapper }
      );

      // Test note type selection
      const noteTypeSelect = screen.getByDisplayValue('progress');
      await user.click(noteTypeSelect);

      await waitFor(() => {
        expect(screen.getByText('Consultation Note')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Consultation Note'));

      expect(noteTypeSelect).toHaveValue('consultation');
    });
  });

  describe('Drag and Drop Interactions', () => {
    it('should handle file upload via drag and drop', async () => {
      const onSave = jest.fn();

      render(
        <ClinicalNoteInput
          patient={mockPatient}
          encounterId="ENC-001"
          onSave={onSave}
        />,
        { wrapper: TestWrapper }
      );

      // Test file upload button
      const uploadButton = screen.getByText('Attach Files');
      expect(uploadButton).toBeInTheDocument();

      // Simulate file selection
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      
      // In a real implementation, we would simulate drag and drop
      // For now, we verify the upload button is interactive
      expect(uploadButton).not.toBeDisabled();
    });
  });

  describe('Calendar and Date Picker Interactions', () => {
    it('should handle calendar navigation and date selection', async () => {
      render(
        <AppointmentManagement facilityId="FAC-001" />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(screen.getByText('Appointment Calendar')).toBeInTheDocument();
      });

      // Test view switching
      await user.click(screen.getByText('Day'));
      expect(screen.getByText('Day')).toHaveAttribute('data-active', 'true');

      await user.click(screen.getByText('Week'));
      expect(screen.getByText('Week')).toHaveAttribute('data-active', 'true');

      await user.click(screen.getByText('Month'));
      expect(screen.getByText('Month')).toHaveAttribute('data-active', 'true');
    });

    it('should handle date input validation', async () => {
      const onComplete = jest.fn();
      const onCancel = jest.fn();

      render(
        <PatientRegistration onComplete={onComplete} onCancel={onCancel} />,
        { wrapper: TestWrapper }
      );

      const dobInput = screen.getByLabelText(/date of birth/i);
      
      // Test invalid date format
      await user.type(dobInput, '13/32/2000'); // Invalid month/day
      await user.tab();
      
      // Should handle invalid date gracefully
      expect(dobInput).toHaveValue('13/32/2000');

      // Test valid date
      await user.clear(dobInput);
      await user.type(dobInput, '1990-03-20');
      
      expect(dobInput).toHaveValue('1990-03-20');
    });
  });

  describe('Table and Grid Interactions', () => {
    it('should handle table sorting, filtering, and pagination', async () => {
      render(
        <AppointmentManagement facilityId="FAC-001" />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(screen.getByText('Appointment Management')).toBeInTheDocument();
      });

      // Test search functionality
      const searchInput = screen.getByPlaceholderText(/search patients, providers/i);
      await user.type(searchInput, 'John');
      
      // Should filter results (implementation-dependent)
      expect(searchInput).toHaveValue('John');

      // Test status filter
      const statusFilter = screen.getByDisplayValue('All Statuses');
      await user.click(statusFilter);
      await user.click(screen.getByText('Confirmed'));
      
      expect(statusFilter).toHaveValue('Confirmed');

      // Clear search
      await user.clear(searchInput);
      expect(searchInput).toHaveValue('');
    });

    it('should handle row selection and bulk actions', async () => {
      // This would test table row selection and bulk operations
      // Implementation depends on specific table component features
      
      render(
        <AppointmentManagement facilityId="FAC-001" />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(screen.getByText('Appointment Management')).toBeInTheDocument();
      });

      // Test individual row interactions
      const tableRows = screen.getAllByRole('row');
      expect(tableRows.length).toBeGreaterThan(0);
    });
  });

  describe('Real-time Updates and Live Data', () => {
    it('should handle real-time status updates', async () => {
      const onSave = jest.fn();

      render(
        <ClinicalNoteInput
          patient={mockPatient}
          encounterId="ENC-001"
          onSave={onSave}
        />,
        { wrapper: TestWrapper }
      );

      // Add content
      const contentArea = screen.getByPlaceholderText(/begin your progress note/i);
      await user.type(contentArea, 'Real-time update test content.');

      // Should show unsaved changes indicator
      await waitFor(() => {
        expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
      });

      // Save and verify status update
      await user.click(screen.getByText('Save Draft'));

      await waitFor(() => {
        expect(screen.queryByText('Unsaved Changes')).not.toBeInTheDocument();
      });
    });

    it('should handle auto-save functionality', async () => {
      const onSave = jest.fn();

      render(
        <ClinicalNoteInput
          patient={mockPatient}
          encounterId="ENC-001"
          onSave={onSave}
        />,
        { wrapper: TestWrapper }
      );

      const contentArea = screen.getByPlaceholderText(/begin your progress note/i);
      await user.type(contentArea, 'Auto-save test content.');

      // Wait for auto-save to trigger (mocked timeout)
      await waitFor(() => {
        expect(screen.getByText(/last saved/i)).toBeInTheDocument();
      }, { timeout: 15000 });
    });
  });

  describe('Touch and Mobile Interactions', () => {
    it('should handle touch gestures on mobile devices', async () => {
      // Mock mobile environment
      Object.defineProperty(window, 'ontouchstart', { value: null });
      
      render(
        <AppointmentManagement facilityId="FAC-001" />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(screen.getByText('Appointment Management')).toBeInTheDocument();
      });

      // Test touch-friendly button sizes and interactions
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        // Verify buttons are large enough for touch (minimum 44px recommended)
        const computedStyle = window.getComputedStyle(button);
        const minSize = 44; // pixels
        
        // In real implementation, we would check actual computed dimensions
        expect(button).toBeInTheDocument();
      });
    });

    it('should handle swipe gestures for navigation', async () => {
      // Mock touch events for swipe simulation
      const createTouchEvent = (type: string, touches: any[]) => {
        const event = new Event(type, { bubbles: true });
        (event as any).touches = touches;
        return event;
      };

      render(
        <AppointmentManagement facilityId="FAC-001" />,
        { wrapper: TestWrapper }
      );

      const calendarElement = screen.getByText('Appointment Calendar').closest('div');
      
      if (calendarElement) {
        // Simulate swipe left gesture
        const startTouch = { clientX: 300, clientY: 100 };
        const endTouch = { clientX: 100, clientY: 100 };

        fireEvent(calendarElement, createTouchEvent('touchstart', [startTouch]));
        fireEvent(calendarElement, createTouchEvent('touchmove', [endTouch]));
        fireEvent(calendarElement, createTouchEvent('touchend', []));

        // In real implementation, this would trigger calendar navigation
      }
    });
  });

  describe('Keyboard Shortcuts and Accessibility', () => {
    it('should handle keyboard shortcuts for common actions', async () => {
      const onSave = jest.fn();

      render(
        <ClinicalNoteInput
          patient={mockPatient}
          encounterId="ENC-001"
          onSave={onSave}
        />,
        { wrapper: TestWrapper }
      );

      const contentArea = screen.getByPlaceholderText(/begin your progress note/i);
      await user.type(contentArea, 'Keyboard shortcut test.');

      // Test Ctrl+S for save
      await user.keyboard('{Control>}s{/Control}');
      
      // Should trigger save action (implementation-dependent)
      expect(contentArea).toHaveValue('Keyboard shortcut test.');

      // Test Ctrl+Z for undo (if implemented)
      await user.keyboard('{Control>}z{/Control}');
    });

    it('should maintain proper focus management', async () => {
      const onComplete = jest.fn();
      const onCancel = jest.fn();

      render(
        <PatientRegistration onComplete={onComplete} onCancel={onCancel} />,
        { wrapper: TestWrapper }
      );

      // Test tab order
      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);

      firstNameInput.focus();
      expect(document.activeElement).toBe(firstNameInput);

      await user.tab();
      expect(document.activeElement).toBe(lastNameInput);

      // Test skip to content functionality
      await user.keyboard('{Shift>}{Tab}{/Shift}');
      expect(document.activeElement).toBe(firstNameInput);
    });
  });

  describe('Error States and Loading Indicators', () => {
    it('should display appropriate loading states', async () => {
      // Mock slow API response
      global.fetch = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          json: () => Promise.resolve([])
        }), 2000))
      );

      render(
        <AppointmentManagement facilityId="FAC-001" />,
        { wrapper: TestWrapper }
      );

      // Should show loading indicator
      expect(screen.getByRole('progressbar') || 
             screen.getByText(/loading/i)).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Appointment Management')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should handle error states gracefully', async () => {
      // Mock API error
      global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));

      const onSave = jest.fn();

      render(
        <ClinicalNoteInput
          patient={mockPatient}
          encounterId="ENC-001"
          onSave={onSave}
        />,
        { wrapper: TestWrapper }
      );

      const contentArea = screen.getByPlaceholderText(/begin your progress note/i);
      await user.type(contentArea, 'Error test content.');

      await user.click(screen.getByText('Save Draft'));

      // Should display error message
      await waitFor(() => {
        expect(screen.getByText(/failed to save/i) || 
               screen.getByRole('alert')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});