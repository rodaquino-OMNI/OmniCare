import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '@test-utils/test-providers';
import OfflineConflictResolver from '../OfflineConflictResolver';
import '@testing-library/jest-dom';

// Mock conflict data
const mockConflicts = [
  {
    id: 'conflict-1',
    noteId: 'note-123',
    patientId: 'patient-456',
    conflictType: 'content',
    localVersion: {
      id: 'local-1',
      title: 'Progress Note - Local',
      content: 'Patient shows improvement in local version.',
      updatedAt: '2024-01-01T14:00:00Z',
      updatedBy: 'Dr. Smith',
      version: 2,
    },
    serverVersion: {
      id: 'server-1', 
      title: 'Progress Note - Server',
      content: 'Patient shows minimal improvement in server version.',
      updatedAt: '2024-01-01T14:30:00Z',
      updatedBy: 'Dr. Johnson',
      version: 3,
    },
    detectedAt: '2024-01-01T15:00:00Z',
    status: 'pending',
  },
  {
    id: 'conflict-2',
    noteId: 'note-789',
    patientId: 'patient-456',
    conflictType: 'metadata',
    localVersion: {
      id: 'local-2',
      title: 'Assessment Note',
      content: 'Patient assessment content.',
      updatedAt: '2024-01-01T16:00:00Z',
      updatedBy: 'Dr. Smith',
      status: 'draft',
      version: 1,
    },
    serverVersion: {
      id: 'server-2',
      title: 'Assessment Note',
      content: 'Patient assessment content.',
      updatedAt: '2024-01-01T16:15:00Z',
      updatedBy: 'Dr. Johnson',
      status: 'signed',
      version: 2,
    },
    detectedAt: '2024-01-01T17:00:00Z',
    status: 'pending',
  },
];

// Mock services
jest.mock('@/services/offline-sync.service', () => ({
  resolveConflict: jest.fn().mockResolvedValue(true),
  mergeVersions: jest.fn().mockResolvedValue({
    id: 'merged-note',
    content: 'Merged content',
    title: 'Merged Note',
  }),
  getConflictDiff: jest.fn().mockReturnValue([
    { type: 'add', value: 'new content' },
    { type: 'remove', value: 'old content' },
  ]),
}));

jest.mock('@/services/audit.service', () => ({
  logConflictResolution: jest.fn().mockResolvedValue(true),
}));

describe('OfflineConflictResolver', () => {
  const defaultProps = {
    conflicts: mockConflicts,
    onConflictResolve: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders conflict resolver with conflict list', () => {
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} />
      </TestProviders>
    );

    expect(screen.getByText('Resolve Conflicts')).toBeInTheDocument();
    expect(screen.getByText('2 conflicts detected')).toBeInTheDocument();
    expect(screen.getByText('Progress Note - Local')).toBeInTheDocument();
    expect(screen.getByText('Assessment Note')).toBeInTheDocument();
  });

  it('displays conflict details when selected', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} />
      </TestProviders>
    );

    const firstConflict = screen.getByText('Progress Note - Local');
    await user.click(firstConflict);

    expect(screen.getByText('Local Version')).toBeInTheDocument();
    expect(screen.getByText('Server Version')).toBeInTheDocument();
    expect(screen.getByText('Patient shows improvement in local version.')).toBeInTheDocument();
    expect(screen.getByText('Patient shows minimal improvement in server version.')).toBeInTheDocument();
  });

  it('shows conflict type and details', () => {
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} />
      </TestProviders>
    );

    expect(screen.getByText('Content Conflict')).toBeInTheDocument();
    expect(screen.getByText('Metadata Conflict')).toBeInTheDocument();
    expect(screen.getByText('Updated by Dr. Smith')).toBeInTheDocument();
    expect(screen.getByText('Updated by Dr. Johnson')).toBeInTheDocument();
  });

  it('resolves conflict by choosing local version', async () => {
    const user = userEvent.setup();
    const onConflictResolve = jest.fn();
    
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} onConflictResolve={onConflictResolve} />
      </TestProviders>
    );

    const firstConflict = screen.getByText('Progress Note - Local');
    await user.click(firstConflict);

    const useLocalButton = screen.getByRole('button', { name: /use local version/i });
    await user.click(useLocalButton);

    expect(screen.getByText(/confirm resolution/i)).toBeInTheDocument();
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(onConflictResolve).toHaveBeenCalledWith('conflict-1', 'local', mockConflicts[0].localVersion);
    });
  });

  it('resolves conflict by choosing server version', async () => {
    const user = userEvent.setup();
    const onConflictResolve = jest.fn();
    
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} onConflictResolve={onConflictResolve} />
      </TestProviders>
    );

    const firstConflict = screen.getByText('Progress Note - Local');
    await user.click(firstConflict);

    const useServerButton = screen.getByRole('button', { name: /use server version/i });
    await user.click(useServerButton);

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(onConflictResolve).toHaveBeenCalledWith('conflict-1', 'server', mockConflicts[0].serverVersion);
    });
  });

  it('supports manual merge of versions', async () => {
    const user = userEvent.setup();
    const onConflictResolve = jest.fn();
    
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} onConflictResolve={onConflictResolve} />
      </TestProviders>
    );

    const firstConflict = screen.getByText('Progress Note - Local');
    await user.click(firstConflict);

    const mergeButton = screen.getByRole('button', { name: /merge versions/i });
    await user.click(mergeButton);

    expect(screen.getByText('Manual Merge')).toBeInTheDocument();
    
    const mergeEditor = screen.getByRole('textbox', { name: /merged content/i });
    await user.clear(mergeEditor);
    await user.type(mergeEditor, 'Manually merged content combining both versions.');
    
    const saveMergeButton = screen.getByRole('button', { name: /save merge/i });
    await user.click(saveMergeButton);

    await waitFor(() => {
      expect(onConflictResolve).toHaveBeenCalledWith('conflict-1', 'merge', expect.objectContaining({
        content: 'Manually merged content combining both versions.',
      }));
    });
  });

  it('shows visual diff between versions', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} />
      </TestProviders>
    );

    const firstConflict = screen.getByText('Progress Note - Local');
    await user.click(firstConflict);

    const diffButton = screen.getByRole('button', { name: /view diff/i });
    await user.click(diffButton);

    expect(screen.getByText('Changes')).toBeInTheDocument();
    expect(screen.getByText('new content')).toBeInTheDocument();
    expect(screen.getByText('old content')).toBeInTheDocument();
  });

  it('handles auto-merge when possible', async () => {
    const user = userEvent.setup();
    const onConflictResolve = jest.fn();
    
    // Mock successful auto-merge
    jest.mocked(require('@/services/offline-sync.service').mergeVersions)
      .mockResolvedValue({
        id: 'auto-merged',
        content: 'Auto-merged content',
        canAutoMerge: true,
      });
    
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} onConflictResolve={onConflictResolve} />
      </TestProviders>
    );

    const firstConflict = screen.getByText('Progress Note - Local');
    await user.click(firstConflict);

    const autoMergeButton = screen.getByRole('button', { name: /auto merge/i });
    await user.click(autoMergeButton);

    await waitFor(() => {
      expect(screen.getByText('Auto-merge successful')).toBeInTheDocument();
    });

    const acceptButton = screen.getByRole('button', { name: /accept auto-merge/i });
    await user.click(acceptButton);

    expect(onConflictResolve).toHaveBeenCalled();
  });

  it('handles conflicts that cannot be auto-merged', async () => {
    const user = userEvent.setup();
    
    // Mock failed auto-merge
    jest.mocked(require('@/services/offline-sync.service').mergeVersions)
      .mockResolvedValue({
        canAutoMerge: false,
        conflicts: ['Content conflict in line 3'],
      });
    
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} />
      </TestProviders>
    );

    const firstConflict = screen.getByText('Progress Note - Local');
    await user.click(firstConflict);

    const autoMergeButton = screen.getByRole('button', { name: /auto merge/i });
    await user.click(autoMergeButton);

    await waitFor(() => {
      expect(screen.getByText('Auto-merge failed')).toBeInTheDocument();
      expect(screen.getByText('Content conflict in line 3')).toBeInTheDocument();
    });
  });

  it('shows timestamp information for versions', () => {
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} />
      </TestProviders>
    );

    expect(screen.getByText(/Jan 1, 2024.*2:00 PM/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 1, 2024.*2:30 PM/)).toBeInTheDocument();
  });

  it('handles batch conflict resolution', async () => {
    const user = userEvent.setup();
    const onConflictResolve = jest.fn();
    
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} onConflictResolve={onConflictResolve} enableBatchResolution={true} />
      </TestProviders>
    );

    // Select multiple conflicts
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    expect(screen.getByText('2 selected')).toBeInTheDocument();
    
    const batchResolveButton = screen.getByRole('button', { name: /resolve selected/i });
    await user.click(batchResolveButton);

    expect(screen.getByText('Batch Resolution')).toBeInTheDocument();
  });

  it('shows conflict severity levels', () => {
    const conflictsWithSeverity = [
      {
        ...mockConflicts[0],
        severity: 'high',
        reason: 'Signed note modified',
      },
      {
        ...mockConflicts[1],
        severity: 'medium',
        reason: 'Metadata changes',
      },
    ];
    
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} conflicts={conflictsWithSeverity} />
      </TestProviders>
    );

    expect(screen.getByText('High Priority')).toBeInTheDocument();
    expect(screen.getByText('Medium Priority')).toBeInTheDocument();
    expect(screen.getByText('Signed note modified')).toBeInTheDocument();
  });

  it('supports conflict preview mode', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} />
      </TestProviders>
    );

    const firstConflict = screen.getByText('Progress Note - Local');
    await user.click(firstConflict);

    const previewButton = screen.getByRole('button', { name: /preview resolution/i });
    await user.click(previewButton);

    expect(screen.getByText('Resolution Preview')).toBeInTheDocument();
    expect(screen.getByText('Final version will be:')).toBeInTheDocument();
  });

  it('logs conflict resolution actions', async () => {
    const user = userEvent.setup();
    const logSpy = jest.mocked(require('@/services/audit.service').logConflictResolution);
    
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} />
      </TestProviders>
    );

    const firstConflict = screen.getByText('Progress Note - Local');
    await user.click(firstConflict);

    const useLocalButton = screen.getByRole('button', { name: /use local version/i });
    await user.click(useLocalButton);

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(logSpy).toHaveBeenCalledWith({
        conflictId: 'conflict-1',
        resolution: 'local',
        resolvedBy: expect.any(String),
        resolvedAt: expect.any(String),
      });
    });
  });

  it('handles conflict resolution errors', async () => {
    const user = userEvent.setup();
    
    // Mock resolution failure
    jest.mocked(require('@/services/offline-sync.service').resolveConflict)
      .mockRejectedValue(new Error('Resolution failed'));
    
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} />
      </TestProviders>
    );

    const firstConflict = screen.getByText('Progress Note - Local');
    await user.click(firstConflict);

    const useLocalButton = screen.getByRole('button', { name: /use local version/i });
    await user.click(useLocalButton);

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/resolution failed/i)).toBeInTheDocument();
    });
  });

  it('supports conflict sorting and filtering', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} />
      </TestProviders>
    );

    const sortButton = screen.getByRole('button', { name: /sort/i });
    await user.click(sortButton);

    expect(screen.getByText('Sort by Date')).toBeInTheDocument();
    expect(screen.getByText('Sort by Priority')).toBeInTheDocument();
    
    const filterButton = screen.getByRole('button', { name: /filter/i });
    await user.click(filterButton);

    expect(screen.getByText('Content Conflicts')).toBeInTheDocument();
    expect(screen.getByText('Metadata Conflicts')).toBeInTheDocument();
  });

  it('shows conflict statistics', () => {
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} showStatistics={true} />
      </TestProviders>
    );

    expect(screen.getByText('Total Conflicts: 2')).toBeInTheDocument();
    expect(screen.getByText('Content: 1')).toBeInTheDocument();
    expect(screen.getByText('Metadata: 1')).toBeInTheDocument();
  });

  it('handles accessibility features', () => {
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} />
      </TestProviders>
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby');
    expect(screen.getByRole('list')).toHaveAttribute('aria-label', 'Conflict list');
    
    const conflictItems = screen.getAllByRole('listitem');
    conflictItems.forEach(item => {
      expect(item).toHaveAttribute('tabIndex');
    });
  });

  it('closes resolver when onClose is called', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    
    render(
      <TestProviders>
        <OfflineConflictResolver {...defaultProps} onClose={onClose} />
      </TestProviders>
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });
});
