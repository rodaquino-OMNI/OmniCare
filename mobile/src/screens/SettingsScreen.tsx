import React from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {Text, Surface, List, Switch, Divider} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNotifications} from '@services/NotificationProvider';
import {theme} from '@config/theme';

export const SettingsScreen: React.FC = () => {
  const {settings, updateSettings} = useNotifications();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Surface style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Notifications
          </Text>
          
          <List.Item
            title="Enable Notifications"
            description="Receive push notifications"
            right={() => (
              <Switch
                value={settings.enabled}
                onValueChange={(value) => updateSettings({enabled: value})}
              />
            )}
          />
          <Divider />
          
          <List.Item
            title="Task Reminders"
            description="Reminders for clinical tasks"
            right={() => (
              <Switch
                value={settings.taskReminders}
                onValueChange={(value) => updateSettings({taskReminders: value})}
                disabled={!settings.enabled}
              />
            )}
          />
          <Divider />
          
          <List.Item
            title="Medication Alerts"
            description="Medication administration reminders"
            right={() => (
              <Switch
                value={settings.medicationAlerts}
                onValueChange={(value) => updateSettings({medicationAlerts: value})}
                disabled={!settings.enabled}
              />
            )}
          />
          <Divider />
          
          <List.Item
            title="Patient Alerts"
            description="Critical patient notifications"
            right={() => (
              <Switch
                value={settings.patientAlerts}
                onValueChange={(value) => updateSettings({patientAlerts: value})}
                disabled={!settings.enabled}
              />
            )}
          />
          <Divider />
          
          <List.Item
            title="Sound"
            description="Play notification sounds"
            right={() => (
              <Switch
                value={settings.soundEnabled}
                onValueChange={(value) => updateSettings({soundEnabled: value})}
                disabled={!settings.enabled}
              />
            )}
          />
          <Divider />
          
          <List.Item
            title="Vibration"
            description="Vibrate for notifications"
            right={() => (
              <Switch
                value={settings.vibrationEnabled}
                onValueChange={(value) => updateSettings({vibrationEnabled: value})}
                disabled={!settings.enabled}
              />
            )}
          />
        </Surface>

        <Surface style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Data & Privacy
          </Text>
          
          <List.Item
            title="Clear Cache"
            description="Clear offline cached data"
            left={() => <List.Icon icon="delete" />}
            onPress={() => {}}
          />
          <Divider />
          
          <List.Item
            title="Privacy Policy"
            description="View our privacy policy"
            left={() => <List.Icon icon="shield-account" />}
            right={() => <List.Icon icon="open-in-new" />}
            onPress={() => {}}
          />
        </Surface>

        <Surface style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            About
          </Text>
          
          <List.Item
            title="Version"
            description="1.0.0"
            left={() => <List.Icon icon="information" />}
          />
          <Divider />
          
          <List.Item
            title="Help & Support"
            description="Get help using OmniCare"
            left={() => <List.Icon icon="help-circle" />}
            right={() => <List.Icon icon="chevron-right" />}
            onPress={() => {}}
          />
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
  section: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    padding: 16,
    paddingBottom: 8,
    fontWeight: '600',
  },
});