import {Patient, Practitioner, Encounter, Observation, Task, Appointment, MedicationRequest} from '@medplum/fhirtypes';

// Authentication types
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  profilePicture?: string;
  practitionerId?: string;
}

export type UserRole = 
  | 'physician'
  | 'nurse'
  | 'patient'
  | 'admin'
  | 'technician'
  | 'home_care_provider';

// Navigation types
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  BiometricSetup: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Patients: undefined;
  Tasks: undefined;
  Schedule: undefined;
  Profile: undefined;
};

export type PatientStackParamList = {
  PatientList: undefined;
  PatientDetail: {patientId: string};
  VitalSigns: {patientId: string; encounterId?: string};
  MedicationAdmin: {patientId: string; medicationRequestId: string};
  ClinicalNotes: {patientId: string; encounterId?: string};
  PhotoCapture: {patientId: string; context: 'wound' | 'medication' | 'document'};
};

// Offline sync types
export interface SyncableData {
  id: string;
  resourceType: string;
  lastModified: string;
  syncStatus: 'pending' | 'synced' | 'conflict' | 'failed';
  localChanges?: Record<string, any>;
}

export interface OfflineState {
  isOnline: boolean;
  pendingSyncCount: number;
  lastSyncTime: string | null;
  syncInProgress: boolean;
}

// Clinical data types
export interface VitalSign {
  id: string;
  patientId: string;
  encounterId?: string;
  type: VitalSignType;
  value: number;
  unit: string;
  timestamp: string;
  recordedBy: string;
  deviceId?: string;
  notes?: string;
}

export type VitalSignType = 
  | 'blood_pressure_systolic'
  | 'blood_pressure_diastolic'
  | 'heart_rate'
  | 'respiratory_rate'
  | 'temperature'
  | 'oxygen_saturation'
  | 'blood_glucose'
  | 'weight'
  | 'height'
  | 'bmi'
  | 'pain_score';

export interface MedicationAdministration {
  id: string;
  patientId: string;
  medicationRequestId: string;
  medicationName: string;
  dosage: string;
  route: string;
  administeredBy: string;
  administeredAt: string;
  barcode?: string;
  notes?: string;
  photo?: string;
  status: 'completed' | 'not_given' | 'partial';
  reasonNotGiven?: string;
}

export interface ClinicalTask extends Task {
  priority: 'high' | 'medium' | 'low';
  category: TaskCategory;
  patientId?: string;
  assignedTo: string;
  dueDate?: string;
  estimatedDuration?: number;
  location?: string;
  equipment?: string[];
}

export type TaskCategory = 
  | 'medication_administration'
  | 'vital_signs'
  | 'patient_assessment'
  | 'discharge_planning'
  | 'documentation'
  | 'lab_collection'
  | 'imaging'
  | 'patient_transport'
  | 'equipment_maintenance';

export interface PatientSummary extends Patient {
  currentLocation?: string;
  admissionDate?: string;
  primaryPhysician?: string;
  nursePrimary?: string;
  allergies?: string[];
  activeMedications?: MedicationRequest[];
  recentVitals?: VitalSign[];
  activeTasks?: ClinicalTask[];
  riskFlags?: RiskFlag[];
}

export interface RiskFlag {
  type: 'fall_risk' | 'infection_control' | 'allergy' | 'cognitive_impairment' | 'suicide_risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  dateIdentified: string;
  active: boolean;
}

// Biometric authentication types
export interface BiometricData {
  isAvailable: boolean;
  biometryType: 'FaceID' | 'TouchID' | 'Fingerprint' | null;
  isEnrolled: boolean;
}

// Push notification types
export interface NotificationData {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export type NotificationType = 
  | 'task_reminder'
  | 'medication_due'
  | 'patient_alert'
  | 'system_message'
  | 'emergency'
  | 'shift_change'
  | 'lab_result'
  | 'appointment_reminder';

// Barcode scanning types
export interface BarcodeData {
  data: string;
  type: string;
  format: string;
}

export interface MedicationBarcode {
  ndc: string;
  lotNumber?: string;
  expirationDate?: string;
  medicationName: string;
  strength?: string;
  manufacturer?: string;
}

// Photo capture types
export interface ClinicalPhoto {
  id: string;
  patientId: string;
  uri: string;
  type: 'wound' | 'medication' | 'document' | 'identification';
  description?: string;
  timestamp: string;
  capturedBy: string;
  encounterId?: string;
  bodyLocation?: string;
  measurements?: PhotoMeasurement[];
}

export interface PhotoMeasurement {
  type: 'length' | 'width' | 'depth' | 'area';
  value: number;
  unit: 'cm' | 'mm' | 'inch';
  notes?: string;
}

// Home care specific types
export interface HomeCareVisit {
  id: string;
  patientId: string;
  providerId: string;
  scheduledTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  visitType: HomeCareVisitType;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  location: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  tasks: HomeCareTask[];
  mileage?: number;
  notes?: string;
  photos?: ClinicalPhoto[];
}

export type HomeCareVisitType = 
  | 'skilled_nursing'
  | 'physical_therapy'
  | 'occupational_therapy'
  | 'speech_therapy'
  | 'social_work'
  | 'home_health_aide'
  | 'medical_social_services';

export interface HomeCareTask {
  id: string;
  type: TaskCategory;
  description: string;
  completed: boolean;
  completedAt?: string;
  notes?: string;
  outcome?: string;
}

// Patient portal types (for patient-facing app)
export interface PatientPortalData {
  appointments: Appointment[];
  medications: MedicationRequest[];
  labResults: Observation[];
  vitals: VitalSign[];
  messages: PatientMessage[];
  educationMaterials: EducationMaterial[];
}

export interface PatientMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: string;
  read: boolean;
  type: 'general' | 'appointment' | 'medication' | 'test_result' | 'billing';
}

export interface EducationMaterial {
  id: string;
  title: string;
  description: string;
  type: 'article' | 'video' | 'pdf' | 'interactive';
  url?: string;
  content?: string;
  category: string;
  tags: string[];
}

// Error handling types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  userId?: string;
  context?: string;
}

// Settings types
export interface AppSettings {
  notifications: NotificationSettings;
  security: SecuritySettings;
  display: DisplaySettings;
  sync: SyncSettings;
}

export interface NotificationSettings {
  enabled: boolean;
  taskReminders: boolean;
  medicationAlerts: boolean;
  patientAlerts: boolean;
  systemMessages: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface SecuritySettings {
  biometricEnabled: boolean;
  autoLockTimeout: number; // minutes
  requirePasswordChange: boolean;
  sessionTimeout: number; // minutes
}

export interface DisplaySettings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'normal' | 'large';
  highContrast: boolean;
}

export interface SyncSettings {
  autoSync: boolean;
  syncFrequency: number; // minutes
  syncOnWifiOnly: boolean;
  backgroundSync: boolean;
}