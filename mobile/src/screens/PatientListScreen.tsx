import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Searchbar,
  Chip,
  SegmentedButtons,
  FAB,
  Portal,
  Modal,
  Text,
  Surface,
  IconButton,
  Badge,
  List,
  Divider,
  Avatar,
  Button,
  RadioButton,
  Checkbox,
} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useMedplum} from '@medplum/react-native';
import {Patient, Encounter} from '@medplum/fhirtypes';

import {useAuth} from '@services/AuthProvider';
import {useOffline} from '@services/OfflineProvider';
import {useSync} from '@services/SyncProvider';
import {PatientCard} from '@components/PatientCard';
import {theme, medicalTheme} from '@config/theme';
import {PatientSummary} from '@types/index';

interface PatientFilter {
  location?: string;
  physician?: string;
  riskLevel?: 'all' | 'high' | 'medium' | 'low';
  status?: 'active' | 'discharged' | 'all';
  myPatients?: boolean;
}

export const PatientListScreen: React.FC = () => {
  const navigation = useNavigation();
  const medplum = useMedplum();
  const {user} = useAuth();
  const {isOnline, storeOfflineData, getOfflineData} = useOffline();
  const {syncTasks} = useSync();

  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<PatientFilter>({
    riskLevel: 'all',
    status: 'active',
    myPatients: false,
  });

  // Locations and physicians for filters
  const [locations, setLocations] = useState<string[]>([]);
  const [physicians, setPhysicians] = useState<string[]>([]);

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    applyFiltersAndSearch();
  }, [patients, searchQuery, filters]);

  const loadPatients = async () => {
    try {
      setLoading(true);

      if (isOnline) {
        // Fetch from Medplum when online
        const searchParams = {
          resourceType: 'Patient',
          _count: 100,
          _sort: '-_lastUpdated',
        };

        const bundle = await medplum.search('Patient', searchParams);
        const fetchedPatients: PatientSummary[] = [];

        for (const entry of bundle.entry || []) {
          const patient = entry.resource as Patient;
          
          // Get active encounter for location info
          const encounters = await medplum.search('Encounter', {
            patient: `Patient/${patient.id}`,
            status: 'in-progress,arrived',
            _count: 1,
            _sort: '-period',
          });

          const activeEncounter = encounters.entry?.[0]?.resource as Encounter;

          const patientSummary: PatientSummary = {
            id: patient.id || '',
            resourceType: 'Patient',
            name: patient.name || [],
            birthDate: patient.birthDate,
            gender: patient.gender,
            currentLocation: activeEncounter?.location?.[0]?.location?.display || 'Not admitted',
            admissionDate: activeEncounter?.period?.start,
            primaryPhysician: activeEncounter?.participant?.find(p => 
              p.type?.[0]?.coding?.[0]?.code === 'ATND'
            )?.individual?.display || 'Not assigned',
            nursePrimary: activeEncounter?.participant?.find(p => 
              p.type?.[0]?.coding?.[0]?.code === 'NURSE'
            )?.individual?.display || 'Not assigned',
            allergies: [], // Would need to fetch from AllergyIntolerance resources
            riskFlags: [], // Would need custom implementation
            lastVitals: null,
            upcomingAppointments: [],
            activeMedications: [],
            recentNotes: [],
          };

          fetchedPatients.push(patientSummary);

          // Store offline for each patient
          await storeOfflineData({
            id: patient.id || '',
            resourceType: 'Patient',
            data: patientSummary,
            lastModified: new Date().toISOString(),
            syncStatus: 'synced',
          });
        }

        setPatients(fetchedPatients);
        extractFiltersData(fetchedPatients);
      } else {
        // Load from offline storage
        const offlinePatients = await getOfflineData('Patient');
        const patientData = offlinePatients.map(item => item.data as PatientSummary);
        setPatients(patientData);
        extractFiltersData(patientData);
      }
    } catch (error) {
      console.error('Error loading patients:', error);
      // Try to load from offline if online fetch fails
      const offlinePatients = await getOfflineData('Patient');
      const patientData = offlinePatients.map(item => item.data as PatientSummary);
      setPatients(patientData);
      extractFiltersData(patientData);
    } finally {
      setLoading(false);
    }
  };

  const extractFiltersData = (patientList: PatientSummary[]) => {
    const uniqueLocations = new Set<string>();
    const uniquePhysicians = new Set<string>();

    patientList.forEach(patient => {
      if (patient.currentLocation && patient.currentLocation !== 'Not admitted') {
        uniqueLocations.add(patient.currentLocation);
      }
      if (patient.primaryPhysician && patient.primaryPhysician !== 'Not assigned') {
        uniquePhysicians.add(patient.primaryPhysician);
      }
    });

    setLocations(Array.from(uniqueLocations).sort());
    setPhysicians(Array.from(uniquePhysicians).sort());
  };

  const applyFiltersAndSearch = () => {
    let filtered = [...patients];

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(patient => {
        const name = `${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}`.toLowerCase();
        const location = patient.currentLocation?.toLowerCase() || '';
        const mrn = patient.id?.toLowerCase() || '';
        
        return name.includes(query) || location.includes(query) || mrn.includes(query);
      });
    }

    // Apply filters
    if (filters.location) {
      filtered = filtered.filter(p => p.currentLocation === filters.location);
    }

    if (filters.physician) {
      filtered = filtered.filter(p => p.primaryPhysician === filters.physician);
    }

    if (filters.status === 'active') {
      filtered = filtered.filter(p => p.currentLocation !== 'Not admitted');
    } else if (filters.status === 'discharged') {
      filtered = filtered.filter(p => p.currentLocation === 'Not admitted');
    }

    if (filters.myPatients && user) {
      filtered = filtered.filter(p => 
        p.primaryPhysician === user.name || p.nursePrimary === user.name
      );
    }

    if (filters.riskLevel !== 'all') {
      filtered = filtered.filter(p => 
        p.riskFlags?.some(flag => flag.severity === filters.riskLevel)
      );
    }

    setFilteredPatients(filtered);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await syncTasks();
    await loadPatients();
    setRefreshing(false);
  };

  const handlePatientPress = (patient: PatientSummary) => {
    navigation.navigate('PatientDetail', {patientId: patient.id});
  };

  const renderPatientItem = ({item}: {item: PatientSummary}) => (
    <TouchableOpacity onPress={() => handlePatientPress(item)}>
      <PatientCard patient={item} />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="account-search" size={64} color={theme.colors.onSurfaceVariant} />
      <Text variant="headlineSmall" style={styles.emptyTitle}>
        No patients found
      </Text>
      <Text variant="bodyMedium" style={styles.emptyDescription}>
        {searchQuery ? 'Try adjusting your search or filters' : 'Pull down to refresh'}
      </Text>
    </View>
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.location) count++;
    if (filters.physician) count++;
    if (filters.riskLevel !== 'all') count++;
    if (filters.status !== 'all') count++;
    if (filters.myPatients) count++;
    return count;
  }, [filters]);

  return (
    <SafeAreaView style={styles.container}>
      <Surface style={styles.header}>
        <View style={styles.headerTop}>
          <Text variant="headlineMedium" style={styles.title}>
            Patients
          </Text>
          <View style={styles.headerActions}>
            <IconButton
              icon={viewMode === 'list' ? 'view-grid' : 'view-list'}
              size={24}
              onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            />
            <IconButton
              icon="filter"
              size={24}
              onPress={() => setShowFilterModal(true)}
            />
            {activeFilterCount > 0 && (
              <Badge style={styles.filterBadge}>{activeFilterCount}</Badge>
            )}
          </View>
        </View>
        
        <Searchbar
          placeholder="Search patients..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          icon="magnify"
        />

        {!isOnline && (
          <View style={styles.offlineBar}>
            <Icon name="cloud-off" size={16} color={theme.colors.onErrorContainer} />
            <Text variant="bodySmall" style={styles.offlineText}>
              Offline Mode - Showing cached data
            </Text>
          </View>
        )}
      </Surface>

      <FlatList
        data={filteredPatients}
        renderItem={renderPatientItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={filteredPatients.length === 0 ? styles.emptyListContent : undefined}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode} // Force re-render when changing view mode
      />

      <Portal>
        <Modal
          visible={showFilterModal}
          onDismiss={() => setShowFilterModal(false)}
          contentContainerStyle={styles.filterModal}
        >
          <View style={styles.modalHeader}>
            <Text variant="headlineSmall">Filter Patients</Text>
            <IconButton
              icon="close"
              size={24}
              onPress={() => setShowFilterModal(false)}
            />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* My Patients Toggle */}
            <View style={styles.filterSection}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setFilters({...filters, myPatients: !filters.myPatients})}
              >
                <Checkbox
                  status={filters.myPatients ? 'checked' : 'unchecked'}
                  onPress={() => setFilters({...filters, myPatients: !filters.myPatients})}
                />
                <Text variant="bodyLarge">My Patients Only</Text>
              </TouchableOpacity>
            </View>

            <Divider />

            {/* Status Filter */}
            <View style={styles.filterSection}>
              <Text variant="titleMedium" style={styles.filterTitle}>Status</Text>
              <RadioButton.Group
                onValueChange={(value) => setFilters({...filters, status: value as any})}
                value={filters.status || 'all'}
              >
                <RadioButton.Item label="All Patients" value="all" />
                <RadioButton.Item label="Active Only" value="active" />
                <RadioButton.Item label="Discharged" value="discharged" />
              </RadioButton.Group>
            </View>

            <Divider />

            {/* Risk Level Filter */}
            <View style={styles.filterSection}>
              <Text variant="titleMedium" style={styles.filterTitle}>Risk Level</Text>
              <View style={styles.chipGroup}>
                <Chip
                  selected={filters.riskLevel === 'all'}
                  onPress={() => setFilters({...filters, riskLevel: 'all'})}
                  style={styles.filterChip}
                >
                  All
                </Chip>
                <Chip
                  selected={filters.riskLevel === 'high'}
                  onPress={() => setFilters({...filters, riskLevel: 'high'})}
                  style={[styles.filterChip, filters.riskLevel === 'high' && styles.highRiskChip]}
                >
                  High Risk
                </Chip>
                <Chip
                  selected={filters.riskLevel === 'medium'}
                  onPress={() => setFilters({...filters, riskLevel: 'medium'})}
                  style={[styles.filterChip, filters.riskLevel === 'medium' && styles.mediumRiskChip]}
                >
                  Medium Risk
                </Chip>
                <Chip
                  selected={filters.riskLevel === 'low'}
                  onPress={() => setFilters({...filters, riskLevel: 'low'})}
                  style={[styles.filterChip, filters.riskLevel === 'low' && styles.lowRiskChip]}
                >
                  Low Risk
                </Chip>
              </View>
            </View>

            <Divider />

            {/* Location Filter */}
            {locations.length > 0 && (
              <>
                <View style={styles.filterSection}>
                  <Text variant="titleMedium" style={styles.filterTitle}>Location</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipGroup}>
                      <Chip
                        selected={!filters.location}
                        onPress={() => setFilters({...filters, location: undefined})}
                        style={styles.filterChip}
                      >
                        All Locations
                      </Chip>
                      {locations.map(location => (
                        <Chip
                          key={location}
                          selected={filters.location === location}
                          onPress={() => setFilters({...filters, location})}
                          style={styles.filterChip}
                        >
                          {location}
                        </Chip>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <Divider />
              </>
            )}

            {/* Physician Filter */}
            {physicians.length > 0 && (
              <View style={styles.filterSection}>
                <Text variant="titleMedium" style={styles.filterTitle}>Physician</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipGroup}>
                    <Chip
                      selected={!filters.physician}
                      onPress={() => setFilters({...filters, physician: undefined})}
                      style={styles.filterChip}
                    >
                      All Physicians
                    </Chip>
                    {physicians.map(physician => (
                      <Chip
                        key={physician}
                        selected={filters.physician === physician}
                        onPress={() => setFilters({...filters, physician})}
                        style={styles.filterChip}
                      >
                        {physician}
                      </Chip>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setFilters({
                  riskLevel: 'all',
                  status: 'active',
                  myPatients: false,
                });
              }}
              style={styles.modalButton}
            >
              Clear Filters
            </Button>
            <Button
              mode="contained"
              onPress={() => setShowFilterModal(false)}
              style={styles.modalButton}
            >
              Apply
            </Button>
          </View>
        </Modal>
      </Portal>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('PatientAdmission')}
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    marginTop: 16,
    color: theme.colors.onSurfaceVariant,
  },
  emptyDescription: {
    marginTop: 8,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  filterModal: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 8,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outlineVariant,
  },
  modalContent: {
    maxHeight: 400,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outlineVariant,
  },
  modalButton: {
    marginLeft: 8,
  },
  filterSection: {
    padding: 16,
  },
  filterTitle: {
    marginBottom: 12,
    fontWeight: '500',
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  highRiskChip: {
    backgroundColor: medicalTheme.medical.priority.high + '20',
  },
  mediumRiskChip: {
    backgroundColor: medicalTheme.medical.priority.medium + '20',
  },
  lowRiskChip: {
    backgroundColor: medicalTheme.medical.priority.low + '20',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
});