// Core healthcare types for OmniCare EMR
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: Permission[];
  department?: string;
  title?: string;
  avatar?: string;
}

export type UserRole = 
  | 'admin'
  | 'physician'
  | 'nurse'
  | 'patient'
  | 'billing'
  | 'receptionist'
  | 'pharmacist'
  | 'lab_tech'
  | 'radiology_tech'
  | 'system_admin';

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Patient {
  id: string;
  mrn: string; // Medical Record Number
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | 'unknown';
  email?: string;
  phone?: string;
  address?: Address;
  emergencyContact?: EmergencyContact;
  allergies: Allergy[];
  insurance: Insurance[];
  status: 'active' | 'inactive' | 'deceased';
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface Allergy {
  id: string;
  substance: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  onset?: string;
  notes?: string;
}

export interface Insurance {
  id: string;
  provider: string;
  policyNumber: string;
  groupNumber?: string;
  primaryContact?: string;
  copay?: number;
  deductible?: number;
}

export interface Encounter {
  id: string;
  patientId: string;
  type: 'inpatient' | 'outpatient' | 'emergency' | 'telemedicine';
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  startTime: string;
  endTime?: string;
  providerId: string;
  departmentId: string;
  chiefComplaint?: string;
  notes?: string;
  diagnosis: Diagnosis[];
  procedures: Procedure[];
}

export interface Diagnosis {
  id: string;
  code: string; // ICD-10
  description: string;
  type: 'primary' | 'secondary' | 'differential';
  status: 'active' | 'resolved' | 'chronic';
  onsetDate?: string;
  notes?: string;
}

export interface Procedure {
  id: string;
  code: string; // CPT
  description: string;
  performedDate: string;
  performerId: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
}

export interface Medication {
  id: string;
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  route: string;
  form: string; // tablet, injection, etc.
  strength: string;
  ndc?: string; // National Drug Code
  rxcui?: string; // RxNorm Concept Unique Identifier
}

export interface MedicationOrder {
  id: string;
  patientId: string;
  medicationId: string;
  prescriberId: string;
  quantity: number;
  refills: number;
  instructions: string;
  status: 'pending' | 'approved' | 'dispensed' | 'cancelled' | 'discontinued';
  orderedDate: string;
  startDate?: string;
  endDate?: string;
  indication?: string;
  notes?: string;
}

export interface LabOrder {
  id: string;
  patientId: string;
  ordererId: string;
  tests: LabTest[];
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  orderedDate: string;
  scheduledDate?: string;
  completedDate?: string;
  priority: 'routine' | 'urgent' | 'stat';
  instructions?: string;
}

export interface LabTest {
  id: string;
  name: string;
  code: string; // LOINC
  category: string;
  specimen: string;
  normalRange?: string;
}

export interface LabResult {
  id: string;
  labOrderId: string;
  testId: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  status: 'normal' | 'abnormal' | 'critical' | 'pending';
  performedDate: string;
  technician?: string;
  notes?: string;
}

export interface VitalSigns {
  id: string;
  patientId: string;
  encounterId?: string;
  recordedBy: string;
  recordedDate: string;
  temperature?: {
    value: number;
    unit: 'celsius' | 'fahrenheit';
  };
  bloodPressure?: {
    systolic: number;
    diastolic: number;
    unit: 'mmHg';
  };
  heartRate?: {
    value: number;
    unit: 'bpm';
  };
  respiratoryRate?: {
    value: number;
    unit: 'bpm';
  };
  oxygenSaturation?: {
    value: number;
    unit: '%';
  };
  weight?: {
    value: number;
    unit: 'kg' | 'lb';
  };
  height?: {
    value: number;
    unit: 'cm' | 'in';
  };
  bmi?: number;
  painScore?: number; // 0-10 scale
}

export interface ClinicalNote {
  id: string;
  patientId: string;
  encounterId?: string;
  authorId: string;
  type: 'progress' | 'admission' | 'discharge' | 'procedure' | 'consultation';
  subject: string;
  content: string;
  status: 'draft' | 'signed' | 'amended';
  createdDate: string;
  signedDate?: string;
  templateId?: string;
  tags?: string[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  type: 'medication' | 'lab' | 'imaging' | 'procedure' | 'followup' | 'documentation';
  assignedTo: string;
  patientId?: string;
  encounterId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  dueDate?: string;
  completedDate?: string;
  createdBy: string;
  createdDate: string;
  notes?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  type: 'checkup' | 'follow-up' | 'consultation' | 'procedure' | 'telemedicine';
  status: 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  location?: string;
  reason?: string;
  notes?: string;
  reminders?: Reminder[];
}

export interface Reminder {
  id: string;
  type: 'email' | 'sms' | 'call';
  scheduledTime: string;
  sent: boolean;
  sentTime?: string;
}

// UI-specific types
export interface NavigationItem {
  label: string;
  path: string;
  icon: React.ComponentType<any>;
  roles: UserRole[];
  children?: NavigationItem[];
}

export interface TableColumn<T = any> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  render?: (value: any, record: T) => React.ReactNode;
}

export interface FilterOption {
  label: string;
  value: string | number;
  count?: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
  category?: string;
}

export interface FormFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'multiselect' | 'textarea' | 'date' | 'checkbox' | 'radio';
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string | number }[];
  validation?: any;
  disabled?: boolean;
  hidden?: boolean;
}

export interface NotificationConfig {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  autoClose?: boolean | number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
}

// Export all administrative types
export * from './administrative';