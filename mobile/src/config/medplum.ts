import {MedplumClient} from '@medplum/core';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Medplum configuration for OmniCare EMR
export const medplumConfig = {
  baseUrl: 'https://api.medplum.com/', // Replace with your Medplum server URL
  clientId: 'your-client-id', // Replace with your actual client ID
  scope: 'openid profile email',
  redirectUri: 'omnicare://auth/callback',
  storagePrefix: 'omnicare-',
};

// Create Medplum client instance with offline storage
export const medplumClient = new MedplumClient({
  baseUrl: medplumConfig.baseUrl,
  clientId: medplumConfig.clientId,
  storage: AsyncStorage,
  onUnauthenticated: () => {
    // Handle unauthenticated state
    console.log('User unauthenticated, redirecting to login');
  },
  fetch: async (url, options = {}) => {
    // Add offline-first fetch interceptor
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Content-Type': 'application/json',
          'X-Medplum-Client': 'OmniCare-Mobile/1.0.0',
        },
      });
      
      // Cache successful responses for offline access
      if (response.ok) {
        const data = await response.clone().json();
        await AsyncStorage.setItem(`cache:${url}`, JSON.stringify({
          data,
          timestamp: Date.now(),
        }));
      }
      
      return response;
    } catch (error) {
      // Try to serve from cache when offline
      const cached = await AsyncStorage.getItem(`cache:${url}`);
      if (cached) {
        const {data, timestamp} = JSON.parse(cached);
        // Serve cached data if less than 24 hours old
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: {'Content-Type': 'application/json'},
          });
        }
      }
      throw error;
    }
  },
});

// Resource types commonly used in mobile EMR
export const FHIR_RESOURCES = {
  PATIENT: 'Patient',
  ENCOUNTER: 'Encounter',
  OBSERVATION: 'Observation',
  MEDICATION_REQUEST: 'MedicationRequest',
  MEDICATION_ADMINISTRATION: 'MedicationAdministration',
  DIAGNOSTIC_REPORT: 'DiagnosticReport',
  CARE_PLAN: 'CarePlan',
  TASK: 'Task',
  APPOINTMENT: 'Appointment',
  PRACTITIONER: 'Practitioner',
  ORGANIZATION: 'Organization',
  LOCATION: 'Location',
  DEVICE: 'Device',
  MEDIA: 'Media',
} as const;