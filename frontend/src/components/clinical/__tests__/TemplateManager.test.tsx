import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '@test-utils/test-providers';
import TemplateManager from '../TemplateManager';
import '@testing-library/jest-dom';

// Mock templates data
const mockTemplates = [
  {
    id: '1',
    name: 'SOAP Note',
    category: 'Progress Notes',
    content: 'Subjective:\n\nObjective:\n\nAssessment:\n\nPlan:',
    tags: ['soap', 'progress'],
    isCustom: false,
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Admission Note',
    category: 'Admission',
    content: 'Chief Complaint:\n\nHistory of Present Illness:\n\nPast Medical History:',
    tags: ['admission', 'intake'],
    isCustom: false,
    createdBy: 'system', 
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Custom Template',
    category: 'Custom',
    content: 'Custom note template content',
    tags: ['custom'],
    isCustom: true,
    createdBy: 'user-123',
    createdAt: '2024-01-15T00:00:00Z',
  },
];

// Mock services
jest.mock('@/services/template.service', () => ({
  getTemplates: jest.fn().mockResolvedValue(mockTemplates),
  saveTemplate: jest.fn().mockResolvedValue({ id: 'new-template-id' }),
  deleteTemplate: jest.fn().mockResolvedValue(true),
  searchTemplates: jest.fn().mockResolvedValue([]),
}));

describe('TemplateManager', () => {
  const defaultProps = {
    onTemplateSelect: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders template manager with template list', async () => {
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} />
      </TestProviders>
    );

    await waitFor(() => {
      expect(screen.getByText('Template Manager')).toBeInTheDocument();
      expect(screen.getByText('SOAP Note')).toBeInTheDocument();
      expect(screen.getByText('Admission Note')).toBeInTheDocument();
      expect(screen.getByText('Custom Template')).toBeInTheDocument();
    });
  });

  it('filters templates by category', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} />
      </TestProviders>
    );

    await waitFor(() => {
      expect(screen.getByText('SOAP Note')).toBeInTheDocument();
    });

    const categoryFilter = screen.getByRole('combobox', { name: /category/i });
    await user.click(categoryFilter);
    await user.click(screen.getByText('Progress Notes'));

    expect(screen.getByText('SOAP Note')).toBeInTheDocument();
    expect(screen.queryByText('Admission Note')).not.toBeInTheDocument();
  });

  it('searches templates by name and tags', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} />
      </TestProviders>
    );

    await waitFor(() => {
      expect(screen.getByText('SOAP Note')).toBeInTheDocument();
    });

    const searchInput = screen.getByRole('textbox', { name: /search templates/i });
    await user.type(searchInput, 'soap');

    await waitFor(() => {
      expect(screen.getByText('SOAP Note')).toBeInTheDocument();
      expect(screen.queryByText('Admission Note')).not.toBeInTheDocument();
    });
  });

  it('previews template content on hover', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} />
      </TestProviders>
    );

    await waitFor(() => {
      expect(screen.getByText('SOAP Note')).toBeInTheDocument();
    });

    const templateCard = screen.getByText('SOAP Note').closest('[data-testid="template-card"]');
    await user.hover(templateCard!);

    await waitFor(() => {
      expect(screen.getByText('Subjective:')).toBeInTheDocument();
      expect(screen.getByText('Objective:')).toBeInTheDocument();
    });
  });

  it('selects template and calls onTemplateSelect', async () => {
    const user = userEvent.setup();
    const onTemplateSelect = jest.fn();
    
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} onTemplateSelect={onTemplateSelect} />
      </TestProviders>
    );

    await waitFor(() => {
      expect(screen.getByText('SOAP Note')).toBeInTheDocument();
    });

    const selectButton = screen.getAllByRole('button', { name: /use template/i })[0];
    await user.click(selectButton);

    expect(onTemplateSelect).toHaveBeenCalledWith(mockTemplates[0]);
  });

  it('creates new custom template', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} allowCustomTemplates={true} />
      </TestProviders>
    );

    const createButton = screen.getByRole('button', { name: /create template/i });
    await user.click(createButton);

    expect(screen.getByText('Create New Template')).toBeInTheDocument();
    
    const nameInput = screen.getByRole('textbox', { name: /template name/i });
    const contentInput = screen.getByRole('textbox', { name: /template content/i });
    
    await user.type(nameInput, 'My Custom Template');
    await user.type(contentInput, 'Custom template content here');
    
    const saveButton = screen.getByRole('button', { name: /save template/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Template saved successfully')).toBeInTheDocument();
    });
  });

  it('edits existing custom template', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} allowCustomTemplates={true} />
      </TestProviders>
    );

    await waitFor(() => {
      expect(screen.getByText('Custom Template')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit custom template/i });
    await user.click(editButton);

    const nameInput = screen.getByDisplayValue('Custom Template');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Custom Template');
    
    const saveButton = screen.getByRole('button', { name: /save template/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Template updated successfully')).toBeInTheDocument();
    });
  });

  it('deletes custom template with confirmation', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} allowCustomTemplates={true} />
      </TestProviders>
    );

    await waitFor(() => {
      expect(screen.getByText('Custom Template')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete custom template/i });
    await user.click(deleteButton);

    expect(screen.getByText('Delete Template')).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    
    const confirmButton = screen.getByRole('button', { name: /delete/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Template deleted successfully')).toBeInTheDocument();
    });
  });

  it('prevents editing system templates', async () => {
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} allowCustomTemplates={true} />
      </TestProviders>
    );

    await waitFor(() => {
      expect(screen.getByText('SOAP Note')).toBeInTheDocument();
    });

    // System templates should not have edit/delete buttons
    const soapTemplateCard = screen.getByText('SOAP Note').closest('[data-testid="template-card"]');
    expect(soapTemplateCard?.querySelector('[aria-label="edit template"]')).not.toBeInTheDocument();
    expect(soapTemplateCard?.querySelector('[aria-label="delete template"]')).not.toBeInTheDocument();
  });

  it('imports templates from file', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} allowImport={true} />
      </TestProviders>
    );

    const importButton = screen.getByRole('button', { name: /import templates/i });
    await user.click(importButton);

    const fileInput = screen.getByRole('button', { name: /choose file/i });
    const file = new File(['template content'], 'templates.json', { type: 'application/json' });
    
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('Templates imported successfully')).toBeInTheDocument();
    });
  });

  it('exports templates to file', async () => {
    const user = userEvent.setup();
    const mockCreateObjectURL = jest.fn(() => 'mock-url');
    global.URL.createObjectURL = mockCreateObjectURL;
    
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} allowExport={true} />
      </TestProviders>
    );

    const exportButton = screen.getByRole('button', { name: /export templates/i });
    await user.click(exportButton);

    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('validates template content before saving', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} allowCustomTemplates={true} />
      </TestProviders>
    );

    const createButton = screen.getByRole('button', { name: /create template/i });
    await user.click(createButton);
    
    // Try to save without required fields
    const saveButton = screen.getByRole('button', { name: /save template/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/template name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/template content is required/i)).toBeInTheDocument();
    });
  });

  it('supports template variables and placeholders', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} supportVariables={true} />
      </TestProviders>
    );

    const createButton = screen.getByRole('button', { name: /create template/i });
    await user.click(createButton);

    const contentInput = screen.getByRole('textbox', { name: /template content/i });
    await user.type(contentInput, 'Patient: {{patient.name}}\nDate: {{date}}');

    expect(screen.getByText('Available Variables')).toBeInTheDocument();
    expect(screen.getByText('{{patient.name}}')).toBeInTheDocument();
    expect(screen.getByText('{{date}}')).toBeInTheDocument();
  });

  it('handles template sharing and permissions', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} allowSharing={true} />
      </TestProviders>
    );

    await waitFor(() => {
      expect(screen.getByText('Custom Template')).toBeInTheDocument();
    });

    const shareButton = screen.getByRole('button', { name: /share template/i });
    await user.click(shareButton);

    expect(screen.getByText('Share Template')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /permission level/i })).toBeInTheDocument();
  });

  it('shows template usage statistics', async () => {
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} showUsageStats={true} />
      </TestProviders>
    );

    await waitFor(() => {
      expect(screen.getByText('SOAP Note')).toBeInTheDocument();
    });

    expect(screen.getByText(/used \d+ times/i)).toBeInTheDocument();
    expect(screen.getByText(/last used/i)).toBeInTheDocument();
  });

  it('supports template versioning', async () => {
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} supportVersioning={true} />
      </TestProviders>
    );

    await waitFor(() => {
      expect(screen.getByText('Custom Template')).toBeInTheDocument();
    });

    const versionButton = screen.getByRole('button', { name: /version history/i });
    expect(versionButton).toBeInTheDocument();
  });

  it('handles accessibility features', () => {
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} />
      </TestProviders>
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby');
    expect(screen.getByRole('textbox', { name: /search/i })).toHaveAttribute('aria-describedby');
    
    // Check keyboard navigation
    const templateCards = screen.getAllByRole('button', { name: /use template/i });
    templateCards.forEach(card => {
      expect(card).toHaveAttribute('tabIndex');
    });
  });

  it('closes manager when onClose is called', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    
    render(
      <TestProviders>
        <TemplateManager {...defaultProps} onClose={onClose} />
      </TestProviders>
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });
});
