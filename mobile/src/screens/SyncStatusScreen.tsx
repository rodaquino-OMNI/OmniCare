import React from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {Text, Surface, List, Button, ProgressBar, Chip} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useOffline} from '@services/OfflineProvider';
import {useSync} from '@services/SyncProvider';
import {theme, medicalTheme} from '@config/theme';
import {formatDistanceToNow} from 'date-fns';

export const SyncStatusScreen: React.FC = () => {
  const {offlineState, isOnline, clearOfflineData} = useOffline();
  const {forceSyncAll} = useSync();

  const handleForceSync = async () => {
    await forceSyncAll();
  };

  const handleClearCache = async () => {
    await clearOfflineData();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Surface style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text variant="headlineSmall">Sync Status</Text>
            <Chip
              icon={isOnline ? 'cloud-check' : 'cloud-off'}
              style={[
                styles.statusChip,
                {backgroundColor: isOnline 
                  ? medicalTheme.medical.status.active + '20'
                  : medicalTheme.medical.status.inactive + '20'
                }
              ]}
            >
              {isOnline ? 'Online' : 'Offline'}
            </Chip>
          </View>

          <List.Item
            title="Connection Status"
            description={isOnline ? 'Connected to server' : 'Working offline'}
            left={() => (
              <List.Icon
                icon={isOnline ? 'wifi' : 'wifi-off'}
                color={isOnline ? medicalTheme.medical.status.active : medicalTheme.medical.status.inactive}
              />
            )}
          />

          <List.Item
            title="Pending Sync Items"
            description={`${offlineState.pendingSyncCount} items waiting to sync`}
            left={() => <List.Icon icon="sync" />}
          />

          <List.Item
            title="Last Sync"
            description={
              offlineState.lastSyncTime
                ? formatDistanceToNow(new Date(offlineState.lastSyncTime), {addSuffix: true})
                : 'Never'
            }
            left={() => <List.Icon icon="clock" />}
          />

          {offlineState.syncInProgress && (
            <View style={styles.progressContainer}>
              <Text variant="bodyMedium" style={styles.progressText}>
                Syncing data...
              </Text>
              <ProgressBar indeterminate style={styles.progressBar} />
            </View>
          )}
        </Surface>

        <Surface style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Sync Actions
          </Text>
          
          <List.Item
            title="Force Sync All"
            description="Manually sync all pending data"
            left={() => <List.Icon icon="sync" />}
            right={() => (
              <Button
                mode="outlined"
                onPress={handleForceSync}
                disabled={!isOnline || offlineState.syncInProgress}
              >
                Sync Now
              </Button>
            )}
          />

          <List.Item
            title="Clear Cache"
            description="Remove all offline cached data"
            left={() => <List.Icon icon="delete" />}
            right={() => (
              <Button
                mode="outlined"
                onPress={handleClearCache}
                buttonColor={theme.colors.errorContainer}
              >
                Clear
              </Button>
            )}
          />
        </Surface>

        <Surface style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Sync Details
          </Text>
          
          <Text variant="bodyMedium" style={styles.infoText}>
            When offline, all data is stored locally and will automatically sync when connection is restored.
            
            {'\n\n'}Supported offline operations:
            {'\n'}• Patient data viewing
            {'\n'}• Vital signs recording
            {'\n'}• Medication administration
            {'\n'}• Clinical notes
            {'\n'}• Photo documentation
          </Text>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  statusCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusChip: {
    borderWidth: 1,
  },
  progressContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outlineVariant,
  },
  progressText: {
    marginBottom: 8,
    color: theme.colors.onSurfaceVariant,
  },
  progressBar: {
    height: 4,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    padding: 16,
    paddingBottom: 8,
    fontWeight: '600',
  },
  infoText: {
    padding: 16,
    color: theme.colors.onSurfaceVariant,
    lineHeight: 20,
  },
});