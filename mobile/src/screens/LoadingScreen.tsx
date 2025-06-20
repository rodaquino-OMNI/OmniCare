import React from 'react';
import {View, StyleSheet} from 'react-native';
import {ActivityIndicator, Text, Surface} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {theme} from '@config/theme';

export const LoadingScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <Surface style={styles.surface}>
        <View style={styles.content}>
          <ActivityIndicator 
            size="large" 
            color={theme.colors.primary}
            style={styles.spinner}
          />
          <Text variant="headlineSmall" style={styles.title}>
            OmniCare EMR
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Loading your healthcare data...
          </Text>
        </View>
      </Surface>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  surface: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  content: {
    alignItems: 'center',
    padding: 32,
  },
  spinner: {
    marginBottom: 24,
  },
  title: {
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
});