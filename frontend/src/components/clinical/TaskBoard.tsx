'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Card,
  Text,
  Stack,
  Group,
  Button,
  Badge,
  SimpleGrid,
  ActionIcon,
  Modal,
  Select,
  Textarea,
  Skeleton,
  Center,
  Box,
  ScrollArea,
  Divider,
  Avatar,
  Tooltip,
} from '@mantine/core';
import {
  IconUser,
  IconClock,
  IconPlayerPlay,
  IconCheck,
  IconX,
  IconUserPlus,
  IconPlus,
  IconAlertTriangle,
  IconCalendar,
  IconMessage,
} from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { Task } from '@medplum/fhirtypes';

interface TaskBoardProps {
  tasks: Task[];
  loading?: boolean;
  onTaskUpdate?: (taskId: string, status: string, note?: string) => void;
  onTaskAssign?: (taskId: string, practitionerId?: string) => void;
  onCreateTask?: () => void;
}

interface ExtendedTask extends Task {
  _patient?: {
    id: string;
    name: Array<{ given: string[]; family: string }>;
  };
  _owner?: {
    id: string;
    name: Array<{ given: string[]; family: string }>;
  };
}

export const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  loading = false,
  onTaskUpdate,
  onTaskAssign,
  onCreateTask,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  
  const [selectedTask, setSelectedTask] = useState<ExtendedTask | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [newStatus, setNewStatus] = useState('');

  // Column definitions
  const columns = [
    { id: 'requested', title: 'Requested', color: 'blue', statuses: ['requested'] },
    { id: 'in-progress', title: 'In Progress', color: 'orange', statuses: ['accepted', 'in-progress'] },
    { id: 'completed', title: 'Completed', color: 'green', statuses: ['completed'] },
    { id: 'other', title: 'Other', color: 'gray', statuses: ['cancelled', 'failed'] },
  ];

  // Group tasks by status
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, ExtendedTask[]> = {};
    
    columns.forEach(column => {
      grouped[column.id] = (tasks as ExtendedTask[]).filter(task => 
        column.statuses.includes(task.status || 'requested')
      );
    });
    
    return grouped;
  }, [tasks]);

  // Helper functions
  const getPatientName = (task: ExtendedTask): string => {
    const name = task._patient?.name?.[0];
    if (!name) return 'Unknown Patient';
    return `${name.given?.join(' ') || ''} ${name.family || ''}`.trim();
  };

  const getPractitionerName = (task: ExtendedTask): string => {
    const name = task._owner?.name?.[0];
    if (!name) return 'Unassigned';
    return `${name.given?.join(' ') || ''} ${name.family || ''}`.trim();
  };

  const getPriorityColor = (priority: string = 'routine'): string => {
    switch (priority) {
      case 'stat': return 'red';
      case 'asap': return 'red';
      case 'urgent': return 'orange';
      case 'routine': return 'blue';
      default: return 'gray';
    }
  };

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  // Event handlers
  const handleTaskAction = useCallback((task: ExtendedTask, action: string) => {
    setSelectedTask(task);
    
    switch (action) {
      case 'start':
        onTaskUpdate?.(task.id!, 'in-progress');
        break;
      case 'complete':
        onTaskUpdate?.(task.id!, 'completed');
        break;
      case 'cancel':
        onTaskUpdate?.(task.id!, 'cancelled');
        break;
      case 'assign':
        setAssignModalOpen(true);
        break;
      case 'update-status':
        setStatusModalOpen(true);
        break;
      default:
        break;
    }
  }, [onTaskUpdate]);

  const handleStatusUpdate = useCallback(() => {
    if (selectedTask && newStatus) {
      onTaskUpdate?.(selectedTask.id!, newStatus, statusNote);
      setStatusModalOpen(false);
      setSelectedTask(null);
      setStatusNote('');
      setNewStatus('');
    }
  }, [selectedTask, newStatus, statusNote, onTaskUpdate]);

  const handleAssignment = useCallback((practitionerId?: string) => {
    if (selectedTask) {
      onTaskAssign?.(selectedTask.id!, practitionerId);
      setAssignModalOpen(false);
      setSelectedTask(null);
    }
  }, [selectedTask, onTaskAssign]);

  // Render task card
  const renderTaskCard = (task: ExtendedTask) => {
    const patientName = getPatientName(task);
    const practitionerName = getPractitionerName(task);
    const isAssigned = task.owner?.reference;
    const timeAgo = getTimeAgo(task.lastModified || task.authoredOn || '');

    return (
      <Card
        key={task.id}
        shadow="sm"
        padding={isMobile ? 'xs' : 'sm'}
        radius="md"
        withBorder
        data-testid="task-card"
        style={{
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          cursor: 'pointer',
        }}
        className="hover:shadow-md hover:transform hover:scale-[1.02]"
      >
        <Stack gap="xs">
          {/* Header */}
          <Group justify="space-between" wrap="nowrap">
            <Badge
              color={getPriorityColor(task.priority)}
              variant="light"
              size="sm"
            >
              {task.priority || 'routine'}
            </Badge>
            <Text size="xs" c="dimmed">
              {timeAgo}
            </Text>
          </Group>

          {/* Description */}
          <Text size="sm" fw={500} lineClamp={2}>
            {task.description}
          </Text>

          {/* Patient Info */}
          <Group gap="xs">
            <IconUser size={14} color="gray" />
            <Text size="xs" c="dimmed" truncate>
              {patientName}
            </Text>
          </Group>

          {/* Assignment Info */}
          <Group gap="xs">
            <IconUserPlus size={14} color="gray" />
            <Text size="xs" c={isAssigned ? 'blue' : 'dimmed'} truncate>
              {practitionerName}
            </Text>
          </Group>

          {/* Due Date */}
          {task.restriction?.period?.end && (
            <Group gap="xs">
              <IconCalendar size={14} color="orange" />
              <Text size="xs" c="orange">
                Due: {new Date(task.restriction.period.end).toLocaleDateString()}
              </Text>
            </Group>
          )}

          {/* Actions */}
          <Group gap="xs" mt="xs">
            {task.status === 'requested' && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlayerPlay size={12} />}
                onClick={() => handleTaskAction(task, 'start')}
                fullWidth={isMobile}
              >
                Start Task
              </Button>
            )}
            
            {task.status === 'in-progress' && (
              <Button
                size="xs"
                variant="light"
                color="green"
                leftSection={<IconCheck size={12} />}
                onClick={() => handleTaskAction(task, 'complete')}
                fullWidth={isMobile}
              >
                Complete
              </Button>
            )}

            {!isMobile && (
              <Group gap="xs">
                <ActionIcon
                  size="sm"
                  variant="light"
                  onClick={() => handleTaskAction(task, 'assign')}
                >
                  <IconUserPlus size={12} />
                </ActionIcon>
                <ActionIcon
                  size="sm"
                  variant="light"
                  onClick={() => handleTaskAction(task, 'update-status')}
                >
                  <IconMessage size={12} />
                </ActionIcon>
              </Group>
            )}

            {isMobile && (
              <Group gap="xs" mt="xs">
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => handleTaskAction(task, 'assign')}
                  flex={1}
                >
                  Assign
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => handleTaskAction(task, 'update-status')}
                  flex={1}
                >
                  Update
                </Button>
              </Group>
            )}
          </Group>
        </Stack>
      </Card>
    );
  };

  // Render column
  const renderColumn = (column: typeof columns[0]) => {
    const columnTasks = tasksByColumn[column.id] || [];

    return (
      <div key={column.id} data-testid="task-column">
        <Card withBorder mb="md" style={{ height: '100%' }}>
          <Stack style={{ height: '100%' }}>
            {/* Column Header */}
            <Group justify="space-between">
              <Group gap="xs">
                <Text fw={600} size="md">
                  {column.title}
                </Text>
                <Badge color={column.color} variant="light" size="sm">
                  {columnTasks.length}
                </Badge>
              </Group>
              {column.id === 'requested' && (
                <ActionIcon
                  size="sm"
                  variant="light"
                  onClick={onCreateTask}
                >
                  <IconPlus size={14} />
                </ActionIcon>
              )}
            </Group>

            <Divider />

            {/* Tasks */}
            <ScrollArea
              style={{ 
                flex: 1, 
                height: isMobile ? '300px' : '500px' 
              }}
            >
              <Stack gap="sm">
                {columnTasks.map(renderTaskCard)}
                {columnTasks.length === 0 && (
                  <Center py="xl">
                    <Text size="sm" c="dimmed">
                      No {column.title.toLowerCase()} tasks
                    </Text>
                  </Center>
                )}
              </Stack>
            </ScrollArea>
          </Stack>
        </Card>
      </div>
    );
  };

  // Render loading skeleton
  const renderLoadingSkeleton = () => (
    <div data-testid="loading-skeleton">
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        {columns.map(column => (
          <Card key={column.id} withBorder>
            <Stack>
              <Skeleton height={20} width="60%" />
              <Divider />
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={index} withBorder>
                  <Stack gap="xs">
                    <Skeleton height={16} width="40%" />
                    <Skeleton height={12} width="100%" />
                    <Skeleton height={12} width="80%" />
                    <Skeleton height={10} width="60%" />
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </div>
  );

  // Render empty state
  const renderEmptyState = () => (
    <Center py="xl">
      <Stack align="center" gap="md">
        <IconAlertTriangle size={48} color="gray" />
        <Text size="lg" c="dimmed">No tasks found</Text>
        <Text size="sm" c="dimmed" ta="center">
          Start by creating your first clinical task
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={onCreateTask}>
          Create New Task
        </Button>
      </Stack>
    </Center>
  );

  if (loading) {
    return renderLoadingSkeleton();
  }

  if (tasks.length === 0) {
    return renderEmptyState();
  }

  return (
    <Box 
      data-testid="task-board" 
      className={isMobile ? 'mobile-layout' : 'desktop-layout'}
    >
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Text size="xl" fw={700}>
              Clinical Tasks
            </Text>
            <Text size="sm" c="dimmed">
              {tasks.length} total tasks
            </Text>
          </div>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={onCreateTask}
            size={isMobile ? 'sm' : 'md'}
          >
            New Task
          </Button>
        </Group>

        {/* Task Board */}
        <SimpleGrid
          cols={{ base: 1, sm: 2, md: 4 }}
          spacing="md"
          style={{ alignItems: 'start' }}
        >
          {columns.map(renderColumn)}
        </SimpleGrid>
      </Stack>

      {/* Status Update Modal */}
      <Modal
        opened={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Update Task Status"
        size="md"
      >
        <Stack gap="md">
          <Select
            label="New Status"
            value={newStatus}
            onChange={(value) => setNewStatus(value || '')}
            data={[
              { value: 'requested', label: 'Requested' },
              { value: 'accepted', label: 'Accepted' },
              { value: 'in-progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'failed', label: 'Failed' },
            ]}
          />
          
          <Textarea
            label="Note (Optional)"
            placeholder="Add a note about this status change..."
            value={statusNote}
            onChange={(event) => setStatusNote(event.currentTarget.value)}
            rows={3}
          />
          
          <Group justify="end">
            <Button variant="light" onClick={() => setStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStatusUpdate} disabled={!newStatus}>
              Update Status
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Assignment Modal */}
      <Modal
        opened={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Task"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Assign task to a practitioner
          </Text>
          
          <Select
            label="Practitioner"
            placeholder="Select practitioner..."
            data={[
              { value: 'practitioner1', label: 'Dr. Sarah Smith' },
              { value: 'practitioner2', label: 'Dr. Michael Johnson' },
              { value: 'practitioner3', label: 'Dr. Emily Williams' },
            ]}
            searchable
          />
          
          <Group justify="end">
            <Button variant="light" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleAssignment('practitioner1')}>
              Assign Task
            </Button>
            <Button 
              variant="subtle" 
              color="red" 
              onClick={() => handleAssignment(undefined)}
            >
              Unassign
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
};

export default TaskBoard;