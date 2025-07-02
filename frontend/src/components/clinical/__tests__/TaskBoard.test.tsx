import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../test-utils/test-providers';
import TaskBoard from '../TaskBoard';

const mockTasks = [
  {
    id: '1',
    resourceType: 'Task',
    status: 'requested',
    priority: 'urgent',
    description: 'Complete initial assessment',
    for: { reference: 'Patient/123' },
    owner: { reference: 'Practitioner/456' },
    authoredOn: '2024-01-01T10:00:00Z',
    lastModified: '2024-01-01T10:00:00Z',
    _patient: {
      id: '123',
      name: [{ given: ['John'], family: 'Doe' }],
    },
    _owner: {
      id: '456',
      name: [{ given: ['Dr.'], family: 'Smith' }],
    },
  },
  {
    id: '2',
    resourceType: 'Task',
    status: 'in-progress',
    priority: 'routine',
    description: 'Medication reconciliation',
    for: { reference: 'Patient/124' },
    owner: { reference: 'Practitioner/457' },
    authoredOn: '2024-01-01T11:00:00Z',
    lastModified: '2024-01-01T11:30:00Z',
    _patient: {
      id: '124',
      name: [{ given: ['Jane'], family: 'Smith' }],
    },
    _owner: {
      id: '457',
      name: [{ given: ['Dr.'], family: 'Johnson' }],
    },
  },
];

describe('TaskBoard', () => {
  it('renders task board with columns', () => {
    render(
      <TestProviders>
        <TaskBoard tasks={mockTasks} onTaskUpdate={jest.fn()} />
      </TestProviders>
    );

    expect(screen.getByText(/clinical tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/requested/i)).toBeInTheDocument();
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
  });

  it('displays tasks in correct columns', () => {
    render(
      <TestProviders>
        <TaskBoard tasks={mockTasks} onTaskUpdate={jest.fn()} />
      </TestProviders>
    );

    expect(screen.getByText('Complete initial assessment')).toBeInTheDocument();
    expect(screen.getByText('Medication reconciliation')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('shows task priority badges', () => {
    render(
      <TestProviders>
        <TaskBoard tasks={mockTasks} onTaskUpdate={jest.fn()} />
      </TestProviders>
    );

    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByText('routine')).toBeInTheDocument();
  });

  it('handles mobile responsive layout', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(max-width: 768px)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    const { container } = render(
      <TestProviders>
        <TaskBoard tasks={mockTasks} onTaskUpdate={jest.fn()} />
      </TestProviders>
    );

    const taskBoard = container.querySelector('[data-testid="task-board"]');
    expect(taskBoard).toHaveClass('mobile-layout');
  });

  it('handles task status updates', async () => {
    const mockOnTaskUpdate = jest.fn();
    
    render(
      <TestProviders>
        <TaskBoard tasks={mockTasks} onTaskUpdate={mockOnTaskUpdate} />
      </TestProviders>
    );

    const taskCard = screen.getByText('Complete initial assessment').closest('[data-testid="task-card"]');
    expect(taskCard).toBeInTheDocument();

    const startButton = screen.getByText('Start Task');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockOnTaskUpdate).toHaveBeenCalledWith('1', 'in-progress');
    });
  });

  it('displays empty state when no tasks', () => {
    render(
      <TestProviders>
        <TaskBoard tasks={[]} onTaskUpdate={jest.fn()} />
      </TestProviders>
    );

    expect(screen.getByText(/no tasks found/i)).toBeInTheDocument();
    expect(screen.getByText(/create new task/i)).toBeInTheDocument();
  });

  it('handles loading state', () => {
    render(
      <TestProviders>
        <TaskBoard tasks={[]} loading={true} onTaskUpdate={jest.fn()} />
      </TestProviders>
    );

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('filters tasks by status correctly', () => {
    render(
      <TestProviders>
        <TaskBoard tasks={mockTasks} onTaskUpdate={jest.fn()} />
      </TestProviders>
    );

    // Check that tasks are in correct columns
    const requestedColumn = screen.getByText('Requested').closest('[data-testid="task-column"]');
    const inProgressColumn = screen.getByText('In Progress').closest('[data-testid="task-column"]');

    expect(requestedColumn).toContainElement(screen.getByText('Complete initial assessment'));
    expect(inProgressColumn).toContainElement(screen.getByText('Medication reconciliation'));
  });

  it('shows task assignment information', () => {
    render(
      <TestProviders>
        <TaskBoard tasks={mockTasks} onTaskUpdate={jest.fn()} />
      </TestProviders>
    );

    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    expect(screen.getByText('Dr. Johnson')).toBeInTheDocument();
  });

  it('handles task assignment', async () => {
    const mockOnTaskUpdate = jest.fn();
    
    render(
      <TestProviders>
        <TaskBoard tasks={mockTasks} onTaskUpdate={mockOnTaskUpdate} />
      </TestProviders>
    );

    const assignButton = screen.getAllByText('Assign')[0];
    fireEvent.click(assignButton);

    // This would open an assignment modal
    await waitFor(() => {
      expect(screen.getByText(/assign task/i)).toBeInTheDocument();
    });
  });
});