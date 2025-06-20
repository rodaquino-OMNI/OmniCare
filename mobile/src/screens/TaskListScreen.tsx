import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  SectionList,
} from 'react-native';
import {
  Text,
  Surface,
  Card,
  IconButton,
  Chip,
  SegmentedButtons,
  FAB,
  Searchbar,
  Badge,
  List,
  Button,
  Portal,
  Dialog,
  RadioButton,
  Checkbox,
} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useMedplum} from '@medplum/react-native';
import {Task} from '@medplum/fhirtypes';
import {formatDistanceToNow, format, isToday, isTomorrow, isPast} from 'date-fns';

import {useAuth} from '@services/AuthProvider';
import {useOffline} from '@services/OfflineProvider';
import {useSync} from '@services/SyncProvider';
import {TaskCard} from '@components/TaskCard';
import {theme, medicalTheme} from '@config/theme';
import {ClinicalTask} from '@types/index';

interface TaskFilter {
  status: 'all' | 'pending' | 'in-progress' | 'completed' | 'overdue';
  priority: 'all' | 'high' | 'medium' | 'low';
  category: 'all' | string;
  timeframe: 'all' | 'today' | 'tomorrow' | 'week';
}

interface TaskSection {
  title: string;
  data: ClinicalTask[];
}

const TASK_CATEGORIES = [
  {value: 'all', label: 'All Tasks'},
  {value: 'medication_administration', label: 'Medications'},
  {value: 'vital_signs', label: 'Vital Signs'},
  {value: 'patient_assessment', label: 'Assessments'},
  {value: 'documentation', label: 'Documentation'},
  {value: 'discharge_planning', label: 'Discharge'},
  {value: 'wound_care', label: 'Wound Care'},
  {value: 'patient_education', label: 'Education'},
];

export const TaskListScreen: React.FC = () => {
  const navigation = useNavigation();
  const medplum = useMedplum();
  const {user} = useAuth();
  const {isOnline, getOfflineData} = useOffline();
  const {syncTasks} = useSync();

  const [tasks, setTasks] = useState<ClinicalTask[]>([]);
  const [sections, setSections] = useState<TaskSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped');
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ClinicalTask | null>(null);
  
  const [filters, setFilters] = useState<TaskFilter>({
    status: 'pending',
    priority: 'all',
    category: 'all',
    timeframe: 'today',
  });

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    applyFiltersAndGroupTasks();
  }, [tasks, filters, searchQuery, viewMode]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      
      if (isOnline) {
        // Fetch from Medplum
        const taskBundle = await medplum.search('Task', {
          owner: user?.practitionerId ? `Practitioner/${user.practitionerId}` : undefined,
          status: 'ready,in-progress,requested',
          _sort: 'priority,-authored-on',
          _count: 100,
        });

        const fetchedTasks: ClinicalTask[] = [];
        
        for (const entry of taskBundle.entry || []) {
          const task = entry.resource as Task;
          
          const clinicalTask: ClinicalTask = {
            id: task.id || '',
            resourceType: 'Task',
            priority: (task.priority || 'routine') as 'high' | 'medium' | 'low',
            category: task.code?.coding?.[0]?.code || 'general',
            status: task.status || 'ready',
            description: task.description || 'No description',
            patientId: task.for?.reference?.split('/')[1] || '',
            patientName: task.for?.display,
            assignedTo: task.owner?.reference || '',
            dueDate: task.executionPeriod?.end,
            location: task.location?.display,
            notes: task.note?.[0]?.text,
            completedBy: task.lastModified ? task.owner?.display : undefined,
            completedAt: task.lastModified,
          };
          
          fetchedTasks.push(clinicalTask);
        }
        
        setTasks(fetchedTasks);
        
        // Store offline
        for (const task of fetchedTasks) {
          await storeOfflineData({
            id: task.id,
            resourceType: 'Task',
            data: task,
            lastModified: new Date().toISOString(),
            syncStatus: 'synced',
          });
        }
      } else {
        // Load from offline storage
        const offlineTasks = await getOfflineData('Task');
        setTasks(offlineTasks.map(t => t.data as ClinicalTask));
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      // Try offline
      const offlineTasks = await getOfflineData('Task');
      setTasks(offlineTasks.map(t => t.data as ClinicalTask));
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndGroupTasks = () => {
    let filtered = [...tasks];
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task => 
        task.description.toLowerCase().includes(query) ||
        task.patientName?.toLowerCase().includes(query) ||
        task.location?.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (filters.status !== 'all') {
      if (filters.status === 'overdue') {
        filtered = filtered.filter(task => {
          if (!task.dueDate) return false;
          return isPast(new Date(task.dueDate)) && task.status !== 'completed';
        });
      } else if (filters.status === 'pending') {
        filtered = filtered.filter(task => 
          task.status === 'ready' || task.status === 'requested'
        );
      } else {
        filtered = filtered.filter(task => task.status === filters.status);
      }
    }
    
    // Apply priority filter
    if (filters.priority !== 'all') {
      filtered = filtered.filter(task => task.priority === filters.priority);
    }
    
    // Apply category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(task => task.category === filters.category);
    }
    
    // Apply timeframe filter
    if (filters.timeframe !== 'all') {
      filtered = filtered.filter(task => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        
        switch (filters.timeframe) {
          case 'today':
            return isToday(dueDate);
          case 'tomorrow':
            return isTomorrow(dueDate);
          case 'week':
            const weekFromNow = new Date();
            weekFromNow.setDate(weekFromNow.getDate() + 7);
            return dueDate <= weekFromNow;
          default:
            return true;
        }
      });
    }
    
    // Sort tasks
    filtered.sort((a, b) => {
      // Sort by priority first
      const priorityOrder = {high: 0, medium: 1, low: 2};
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by due date
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return 0;
    });
    
    // Group tasks if in grouped view
    if (viewMode === 'grouped') {
      const grouped: TaskSection[] = [];
      
      // Group overdue tasks
      const overdueTasks = filtered.filter(task => {
        if (!task.dueDate || task.status === 'completed') return false;
        return isPast(new Date(task.dueDate));
      });
      if (overdueTasks.length > 0) {
        grouped.push({title: 'Overdue', data: overdueTasks});
      }
      
      // Group due now (within 1 hour)
      const dueNowTasks = filtered.filter(task => {
        if (!task.dueDate || task.status === 'completed') return false;
        const dueDate = new Date(task.dueDate);
        const now = new Date();
        const hourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        return dueDate >= now && dueDate <= hourFromNow;
      });
      if (dueNowTasks.length > 0) {
        grouped.push({title: 'Due Now', data: dueNowTasks});
      }
      
      // Group upcoming today
      const upcomingTodayTasks = filtered.filter(task => {
        if (!task.dueDate || task.status === 'completed') return false;
        return isToday(new Date(task.dueDate)) && 
               !overdueTasks.includes(task) && 
               !dueNowTasks.includes(task);
      });
      if (upcomingTodayTasks.length > 0) {
        grouped.push({title: 'Upcoming Today', data: upcomingTodayTasks});
      }
      
      // Group tomorrow
      const tomorrowTasks = filtered.filter(task => {
        if (!task.dueDate || task.status === 'completed') return false;
        return isTomorrow(new Date(task.dueDate));
      });
      if (tomorrowTasks.length > 0) {
        grouped.push({title: 'Tomorrow', data: tomorrowTasks});
      }
      
      // Group remaining
      const remainingTasks = filtered.filter(task => 
        !overdueTasks.includes(task) &&
        !dueNowTasks.includes(task) &&
        !upcomingTodayTasks.includes(task) &&
        !tomorrowTasks.includes(task)
      );
      if (remainingTasks.length > 0) {
        grouped.push({title: 'Later', data: remainingTasks});
      }
      
      setSections(grouped);
    } else {
      setSections([{title: 'All Tasks', data: filtered}]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await syncTasks();
    await loadTasks();
    setRefreshing(false);
  };

  const handleTaskPress = (task: ClinicalTask) => {
    if (task.category === 'medication_administration') {
      navigation.navigate('MedicationAdmin', {
        patientId: task.patientId,
      });
    } else if (task.category === 'vital_signs') {
      navigation.navigate('VitalSigns', {
        patientId: task.patientId,
      });
    } else {
      // Show task details or mark as complete
      setSelectedTask(task);
      setShowCompleteDialog(true);
    }
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;
    
    try {
      if (isOnline) {
        await medplum.updateResource('Task', selectedTask.id, {
          ...selectedTask,
          status: 'completed',
          lastModified: new Date().toISOString(),
        });
      }
      
      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === selectedTask.id 
          ? {...task, status: 'completed', completedAt: new Date().toISOString()}
          : task
      ));
      
      setShowCompleteDialog(false);
      setSelectedTask(null);
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const getTaskIcon = (category: string) => {
    switch (category) {
      case 'medication_administration':
        return 'pill';
      case 'vital_signs':
        return 'heart-pulse';
      case 'patient_assessment':
        return 'clipboard-check';
      case 'documentation':
        return 'file-document';
      case 'discharge_planning':
        return 'exit-to-app';
      case 'wound_care':
        return 'bandage';
      case 'patient_education':
        return 'school';
      default:
        return 'clipboard-list';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return medicalTheme.medical.priority.high;
      case 'medium':
        return medicalTheme.medical.priority.medium;
      case 'low':
        return medicalTheme.medical.priority.low;
      default:
        return theme.colors.onSurface;
    }
  };

  const renderTaskItem = ({item}: {item: ClinicalTask}) => (
    <TouchableOpacity onPress={() => handleTaskPress(item)}>
      <TaskCard task={item} />
    </TouchableOpacity>
  );

  const renderSectionHeader = ({section}: {section: TaskSection}) => (
    <View style={[
      styles.sectionHeader,
      section.title === 'Overdue' && styles.overdueSectionHeader
    ]}>
      <Text variant="titleMedium" style={[
        styles.sectionTitle,
        section.title === 'Overdue' && styles.overdueSectionTitle
      ]}>
        {section.title}
      </Text>
      <Badge style={[
        styles.sectionBadge,
        section.title === 'Overdue' && styles.overdueBadge
      ]}>
        {section.data.length}
      </Badge>
    </View>
  );

  const activeFilterCount = [
    filters.status !== 'all',
    filters.priority !== 'all',
    filters.category !== 'all',
    filters.timeframe !== 'all',
  ].filter(Boolean).length;

  return (
    <SafeAreaView style={styles.container}>
      <Surface style={styles.header}>
        <View style={styles.headerTop}>
          <Text variant="headlineMedium" style={styles.title}>
            My Tasks
          </Text>
          <View style={styles.headerActions}>
            <IconButton
              icon={viewMode === 'list' ? 'view-sequential' : 'view-list'}
              size={24}
              onPress={() => setViewMode(viewMode === 'list' ? 'grouped' : 'list')}
            />
            <IconButton
              icon="filter"
              size={24}
              onPress={() => setShowFilterDialog(true)}
            />
            {activeFilterCount > 0 && (
              <Badge style={styles.filterBadge}>{activeFilterCount}</Badge>
            )}
          </View>
        </View>
        
        <Searchbar
          placeholder="Search tasks..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
        
        {/* Quick Filters */}
        <View style={styles.quickFilters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Chip
              selected={filters.status === 'pending'}
              onPress={() => setFilters({...filters, status: 'pending'})}
              style={styles.quickFilterChip}
            >
              Pending
            </Chip>
            <Chip
              selected={filters.status === 'overdue'}
              onPress={() => setFilters({...filters, status: 'overdue'})}
              style={styles.quickFilterChip}
            >
              Overdue
            </Chip>
            <Chip
              selected={filters.priority === 'high'}
              onPress={() => setFilters({...filters, priority: filters.priority === 'high' ? 'all' : 'high'})}
              style={styles.quickFilterChip}
            >
              High Priority
            </Chip>
            <Chip
              selected={filters.timeframe === 'today'}
              onPress={() => setFilters({...filters, timeframe: 'today'})}
              style={styles.quickFilterChip}
            >
              Today
            </Chip>
          </ScrollView>
        </View>
        
        {!isOnline && (
          <View style={styles.offlineBar}>
            <Icon name="cloud-off" size={16} color={theme.colors.onErrorContainer} />
            <Text variant="bodySmall" style={styles.offlineText}>
              Offline Mode
            </Text>
          </View>
        )}
      </Surface>

      {sections.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="clipboard-check" size={64} color={theme.colors.onSurfaceVariant} />
          <Text variant="headlineSmall" style={styles.emptyTitle}>
            No tasks found
          </Text>
          <Text variant="bodyMedium" style={styles.emptyDescription}>
            {searchQuery || activeFilterCount > 0 
              ? 'Try adjusting your search or filters'
              : 'All caught up! Check back later for new tasks.'}
          </Text>
        </View>
      ) : viewMode === 'grouped' ? (
        <SectionList
          sections={sections}
          renderItem={renderTaskItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          stickySectionHeadersEnabled
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <FlatList
          data={sections[0].data}
          renderItem={renderTaskItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Filter Dialog */}
      <Portal>
        <Dialog
          visible={showFilterDialog}
          onDismiss={() => setShowFilterDialog(false)}
          style={styles.filterDialog}
        >
          <Dialog.Title>Filter Tasks</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView>
              {/* Status Filter */}
              <View style={styles.filterSection}>
                <Text variant="titleSmall" style={styles.filterTitle}>Status</Text>
                <RadioButton.Group
                  onValueChange={(value) => setFilters({...filters, status: value as any})}
                  value={filters.status}
                >
                  <RadioButton.Item label="All" value="all" />
                  <RadioButton.Item label="Pending" value="pending" />
                  <RadioButton.Item label="In Progress" value="in-progress" />
                  <RadioButton.Item label="Overdue" value="overdue" />
                  <RadioButton.Item label="Completed" value="completed" />
                </RadioButton.Group>
              </View>

              {/* Priority Filter */}
              <View style={styles.filterSection}>
                <Text variant="titleSmall" style={styles.filterTitle}>Priority</Text>
                <RadioButton.Group
                  onValueChange={(value) => setFilters({...filters, priority: value as any})}
                  value={filters.priority}
                >
                  <RadioButton.Item label="All Priorities" value="all" />
                  <RadioButton.Item label="High" value="high" />
                  <RadioButton.Item label="Medium" value="medium" />
                  <RadioButton.Item label="Low" value="low" />
                </RadioButton.Group>
              </View>

              {/* Category Filter */}
              <View style={styles.filterSection}>
                <Text variant="titleSmall" style={styles.filterTitle}>Category</Text>
                <View style={styles.categoryChips}>
                  {TASK_CATEGORIES.map(cat => (
                    <Chip
                      key={cat.value}
                      selected={filters.category === cat.value}
                      onPress={() => setFilters({...filters, category: cat.value})}
                      style={styles.categoryChip}
                    >
                      {cat.label}
                    </Chip>
                  ))}
                </View>
              </View>

              {/* Timeframe Filter */}
              <View style={styles.filterSection}>
                <Text variant="titleSmall" style={styles.filterTitle}>Timeframe</Text>
                <SegmentedButtons
                  value={filters.timeframe}
                  onValueChange={(value) => setFilters({...filters, timeframe: value as any})}
                  buttons={[
                    {value: 'all', label: 'All'},
                    {value: 'today', label: 'Today'},
                    {value: 'tomorrow', label: 'Tomorrow'},
                    {value: 'week', label: 'This Week'},
                  ]}
                />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => {
              setFilters({
                status: 'pending',
                priority: 'all',
                category: 'all',
                timeframe: 'today',
              });
            }}>
              Reset
            </Button>
            <Button onPress={() => setShowFilterDialog(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Task Complete Dialog */}
        <Dialog
          visible={showCompleteDialog}
          onDismiss={() => setShowCompleteDialog(false)}
        >
          <Dialog.Title>Complete Task</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Mark this task as completed?
            </Text>
            {selectedTask && (
              <View style={styles.taskPreview}>
                <Icon
                  name={getTaskIcon(selectedTask.category)}
                  size={24}
                  color={getPriorityColor(selectedTask.priority)}
                />
                <View style={styles.taskPreviewInfo}>
                  <Text variant="titleSmall">{selectedTask.description}</Text>
                  <Text variant="bodySmall" style={styles.taskPreviewPatient}>
                    {selectedTask.patientName} • {selectedTask.location}
                  </Text>
                </View>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCompleteDialog(false)}>Cancel</Button>
            <Button onPress={handleCompleteTask}>Complete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('CreateTask')}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    elevation: 4,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
  },
  searchBar: {
    marginHorizontal: 16,
    marginTop: 8,
    elevation: 0,
  },
  quickFilters: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  quickFilterChip: {
    marginRight: 8,
  },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.errorContainer,
    paddingVertical: 4,
    marginTop: 8,
  },
  offlineText: {
    marginLeft: 4,
    color: theme.colors.onErrorContainer,
  },
  listContent: {
    paddingBottom: 80,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
  },
  overdueSectionHeader: {
    backgroundColor: medicalTheme.medical.priority.high + '10',
  },
  sectionTitle: {
    fontWeight: '600',
  },
  overdueSectionTitle: {
    color: medicalTheme.medical.priority.high,
  },
  sectionBadge: {
    backgroundColor: theme.colors.secondaryContainer,
  },
  overdueBadge: {
    backgroundColor: medicalTheme.medical.priority.high,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    marginTop: 16,
    color: theme.colors.onSurfaceVariant,
  },
  emptyDescription: {
    marginTop: 8,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  filterDialog: {
    maxHeight: '80%',
  },
  filterSection: {
    marginBottom: 24,
  },
  filterTitle: {
    marginBottom: 8,
    fontWeight: '500',
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    marginBottom: 8,
  },
  taskPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
  },
  taskPreviewInfo: {
    marginLeft: 12,
    flex: 1,
  },
  taskPreviewPatient: {
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
});