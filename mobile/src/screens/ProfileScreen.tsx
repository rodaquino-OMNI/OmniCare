import React from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {Text, Surface, List, Avatar, Button, Divider} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuth} from '@services/AuthProvider';
import {theme} from '@config/theme';

export const ProfileScreen: React.FC = () => {
  const {user, signOut} = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Surface style={styles.header}>
          <Avatar.Text 
            size={80} 
            label={user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
            style={styles.avatar}
          />
          <Text variant="headlineSmall" style={styles.name}>
            {user?.name || 'User'}
          </Text>
          <Text variant="bodyMedium" style={styles.role}>
            {user?.role?.replace('_', ' ').toUpperCase()}
          </Text>
        </Surface>

        <Surface style={styles.section}>
          <List.Item
            title="Department"
            description={user?.department || 'Not specified'}
            left={() => <List.Icon icon="hospital-building" />}
          />
          <Divider />
          <List.Item
            title="Employee ID"
            description={user?.practitionerId || 'Not specified'}
            left={() => <List.Icon icon="card-account-details" />}
          />
          <Divider />
          <List.Item
            title="Email"
            description={user?.email || 'Not specified'}
            left={() => <List.Icon icon="email" />}
          />
        </Surface>

        <Surface style={styles.section}>
          <List.Item
            title="Settings"
            description="App preferences and notifications"
            left={() => <List.Icon icon="cog" />}
            right={() => <List.Icon icon="chevron-right" />}
            onPress={() => {}}
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

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={signOut}
            style={styles.signOutButton}
          >
            Sign Out
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    elevation: 4,
  },
  avatar: {
    backgroundColor: theme.colors.primary,
    marginBottom: 16,
  },
  name: {
    fontWeight: '600',
  },
  role: {
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  section: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
  },
  actions: {
    padding: 16,
    marginTop: 32,
  },
  signOutButton: {
    backgroundColor: theme.colors.error,
  },
});