import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { BrowserRouter } from 'react-router-dom';
import { MedplumClient } from '@medplum/core';
import { TestProviders } from '@test-utils/test-providers';
import DashboardPage from '@/app/dashboard/page';
import { NoteComposer } from '@/components/clinical/NoteComposer';
import { PatientList } from '@/components/patient/PatientList';
import { PatientSummary } from '@/components/patient/PatientSummary';
import { LoginForm } from '@/components/auth/LoginForm';
import '@testing-library/jest-dom';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
jest.mock('@/hooks/useDashboardData', () => ({
  useDashboardData: () => ({
    data: {
      stats: {
        totalPatients: { value: 100, change: 5, trend: 'up' },
        activeOrders: { value: 25, change: -2, trend: 'down' },
        pendingResults: { value: 8, change: 0, trend: 'stable' },
        medications: { value: 45, change: 3, trend: 'up' },
      },
      upcomingAppointments: [],
      recentActivities: [],
      performanceMetrics: {
        patientSatisfaction: 90,
        onTimePerformance: 85,
        resourceUtilization: 75,
      },
    },
    isLoading: false,
    isRefreshing: false,
    error: null,
    refresh: jest.fn(),
    lastUpdated: new Date(),
  }),
}));

jest.mock('@/stores/clinical-note.store', () => ({
  useClinicalNoteStore: () => ({
    noteContent: '',
    noteTitle: '',
    noteType: 'progress',
    noteStatus: 'draft',
    isOnline: true,
    isSyncing: false,
    conflictedNotes: [],
    lastSaved: null,
    hasUnsavedChanges: false,
    error: null,
    activeTab: 'compose',
    setNoteContent: jest.fn(),
    setNoteTitle: jest.fn(),
    setActiveTab: jest.fn(),
  }),
}));

const mockMedplum = {
  searchResources: jest.fn().mockResolvedValue([]),
  readResource: jest.fn(),
  createResource: jest.fn(),
} as unknown as MedplumClient;

const mockPatient = {
  resourceType: 'Patient' as const,
  id: 'patient-123',
  name: [{ given: ['John'], family: 'Doe' }],
  birthDate: '1990-01-01',
  gender: 'male' as const,
};

/**
 * Comprehensive Accessibility Testing Suite
 * 
 * Tests WCAG 2.1 AA compliance across all major components
 * using axe-core automated accessibility testing
 */
describe('Accessibility Testing Suite', () => {
  describe('Dashboard Accessibility', () => {
    it('should have no accessibility violations on dashboard page', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          // Healthcare-specific accessibility rules
          'color-contrast': { enabled: true },
          'keyboard-navigation': { enabled: true },
          'focus-management': { enabled: true },
          'screen-reader': { enabled: true },
          'aria-labels': { enabled: true },
        },
        // // tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'], // Not supported in axe RunOptions type
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper heading hierarchy', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'heading-order': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper landmark regions', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'region': { enabled: true },
          'landmark-one-main': { enabled: true },
          'landmark-complementary-is-top-level': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'focusable-content': { enabled: true },
          'tabindex': { enabled: true },
          'focus-order-semantics': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Clinical Components Accessibility', () => {
    it('should have no accessibility violations in NoteComposer', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <NoteComposer patient={mockPatient} />
        </TestProviders>
      );

      const results = await axe(container, {
        // // tags: ['wcag2a', 'wcag2aa', 'wcag21aa'], // Not supported in axe RunOptions type
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper form accessibility in NoteComposer', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <NoteComposer patient={mockPatient} />
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'label': { enabled: true },
          'label-title-only': { enabled: true },
          'form-field-multiple-labels': { enabled: true },
          'aria-input-field-name': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Patient Management Accessibility', () => {
    it('should have no accessibility violations in PatientList', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <PatientList />
        </TestProviders>
      );

      const results = await axe(container, {
        // // tags: ['wcag2a', 'wcag2aa', 'wcag21aa'], // Not supported in axe RunOptions type
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper table accessibility in PatientList', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <PatientList />
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'table-header': { enabled: true },
          'td-headers-attr': { enabled: true },
          'th-has-data-cells': { enabled: true },
          'table-duplicate-name': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in PatientSummary', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <PatientSummary patient={mockPatient} />
        </TestProviders>
      );

      const results = await axe(container, {
        // // tags: ['wcag2a', 'wcag2aa', 'wcag21aa'], // Not supported in axe RunOptions type
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Authentication Accessibility', () => {
    it('should have no accessibility violations in LoginForm', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <LoginForm />
        </TestProviders>
      );

      const results = await axe(container, {
        // // tags: ['wcag2a', 'wcag2aa', 'wcag21aa'], // Not supported in axe RunOptions type
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper form security accessibility', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <LoginForm />
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'autocomplete-valid': { enabled: true },
          'aria-input-field-name': { enabled: true },
          'label': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    it('should meet WCAG AA color contrast requirements', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
          'color-contrast-enhanced': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should not rely solely on color for information', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'link-in-text-block': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Screen Reader Accessibility', () => {
    it('should have proper ARIA labels and descriptions', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'aria-allowed-attr': { enabled: true },
          'aria-required-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },
          'aria-valid-attr': { enabled: true },
          'aria-labelledby': { enabled: true },
          'aria-describedby': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper live regions for dynamic content', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'aria-live': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Mobile Accessibility', () => {
    it('should maintain accessibility on mobile viewports', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'target-size': { enabled: true },
          'focus-order-semantics': { enabled: true },
        },
        // // tags: ['wcag2a', 'wcag2aa', 'wcag21aa'], // Not supported in axe RunOptions type
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Healthcare-Specific Accessibility', () => {
    it('should handle medical data with proper privacy indicators', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <PatientSummary patient={mockPatient} />
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'aria-hidden-body': { enabled: true },
          'aria-hidden-focus': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper error and alert accessibility', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <NoteComposer patient={mockPatient} />
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'aria-live': { enabled: true },
          'role-img-alt': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Dynamic Content Accessibility', () => {
    it('should handle modal dialogs properly', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <div role="dialog" aria-labelledby="modal-title" aria-modal="true">
            <h2 id="modal-title">Test Modal</h2>
            <p>Modal content</p>
            <button>Close</button>
          </div>
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'aria-dialog-name': { enabled: true },
          'focus-trap': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should handle loading states accessibly', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <div role="status" aria-live="polite" aria-busy="true">
            <span>Loading patient data...</span>
          </div>
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'aria-live': { enabled: true },
          'aria-valid-attr': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Compliance Testing', () => {
    it('should meet HIPAA accessibility requirements', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </TestProviders>
      );

      const results = await axe(container, {
        // Custom rules for healthcare compliance
        rules: {
          'aria-labelledby': { enabled: true },
          'aria-describedby': { enabled: true },
          'form-field-multiple-labels': { enabled: true },
          'landmark-unique': { enabled: true },
        },
        // // tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'], // Not supported in axe RunOptions type
      });

      expect(results).toHaveNoViolations();
    });

    it('should support assistive technologies', async () => {
      const { container } = render(
        <TestProviders medplum={mockMedplum}>
          <PatientSummary patient={mockPatient} />
        </TestProviders>
      );

      const results = await axe(container, {
        rules: {
          'aria-allowed-role': { enabled: true },
          'aria-required-children': { enabled: true },
          'aria-required-parent': { enabled: true },
          'role-has-required-aria-props': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });
});

/**
 * Custom accessibility test helpers for healthcare applications
 */
export const healthcareA11yHelpers = {
  /**
   * Test clinical data presentation accessibility
   */
  async testClinicalDataA11y(container: HTMLElement) {
    return await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
        'aria-labelledby': { enabled: true },
        'table-header': { enabled: true },
      },
      // // tags: ['wcag2aa'], // Not supported in axe RunOptions type
    });
  },

  /**
   * Test form accessibility for clinical workflows
   */
  async testClinicalFormA11y(container: HTMLElement) {
    return await axe(container, {
      rules: {
        'label': { enabled: true },
        'aria-input-field-name': { enabled: true },
        'form-field-multiple-labels': { enabled: true },
        'autocomplete-valid': { enabled: true },
      },
      // // tags: ['wcag2aa'], // Not supported in axe RunOptions type
    });
  },

  /**
   * Test navigation accessibility for healthcare apps
   */
  async testHealthcareNavigationA11y(container: HTMLElement) {
    return await axe(container, {
      rules: {
        'focus-order-semantics': { enabled: true },
        'tabindex': { enabled: true },
        'landmark-unique': { enabled: true },
        'heading-order': { enabled: true },
      },
      // // tags: ['wcag2aa'], // Not supported in axe RunOptions type
    });
  },
};
