// Administrative types for OmniCare EMR frontend integration

export interface DashboardMetrics {
  patientsRegisteredToday: number;
  appointmentsToday: number;
  pendingClaims: number;
  overdueDocuments: number;
  systemAlerts: SystemAlert[];
  revenueThisMonth: number;
  patientSatisfactionScore: number;
  averageWaitTime: number;
}

export interface SystemAlert {
  id: string;
  type: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  title: string;
  message: string;
  triggeredAt: Date;
  status: 'Active' | 'Resolved' | 'Acknowledged';
}

export interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  specialty: string;
  npi: string;
  licenseNumber: string;
  email: string;
  phone: string;
  schedule: ScheduleSlot[];
  isActive: boolean;
  facilityIds: string[];
}

export interface ScheduleSlot {
  dayOfWeek: number; // ResourceHistoryTable=Sunday, 1=Monday, etc.
  startTime: string; // "8:ResourceHistoryTableResourceHistoryTable"
  endTime: string; // "17:ResourceHistoryTableResourceHistoryTable"
  isAvailable: boolean;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: Date;
  gender: 'M' | 'F' | 'O' | 'U';
  ssn?: string;
  address: Address;
  phone: PhoneNumber[];
  email?: string;
  emergencyContact: EmergencyContact;
  insurance: InsuranceInfo[];
  maritalStatus: string;
  employmentStatus: string;
  preferredLanguage: string;
  race?: string;
  ethnicity?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'Active' | 'Inactive' | 'Deceased';
  photographPath?: string;
  patientPortalCredentials?: {
    username: string;
    isActivated: boolean;
  };
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  addressType: 'Home' | 'Work' | 'Mailing' | 'Other';
}

export interface PhoneNumber {
  number: string;
  type: 'Home' | 'Work' | 'Mobile' | 'Other';
  isPrimary: boolean;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface InsuranceInfo {
  id: string;
  planName: string;
  policyNumber: string;
  subscriberId: string;
  subscriberName: string;
  subscriberDateOfBirth: Date;
  relationship: string;
  isPrimary: boolean;
  effectiveDate: Date;
  expirationDate?: Date;
  copay?: number;
  deductible?: number;
  outOfPocketMax?: number;
  eligibilityVerified: boolean;
  verificationDate?: Date;
  verificationStatus: string;
  priorAuthRequired: boolean;
  referralRequired: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  facilityId: string;
  appointmentType: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  status: 'Scheduled' | 'Confirmed' | 'Checked In' | 'In Progress' | 'Completed' | 'Cancelled' | 'No Show';
  reasonForVisit: string;
  notes?: string;
  roomId?: string;
  remindersSent: ReminderSent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderSent {
  type: 'Email' | 'SMS' | 'Phone';
  sentAt: Date;
  status: 'Sent' | 'Delivered' | 'Failed';
}

export interface Billing {
  id: string;
  patientId: string;
  appointmentId?: string;
  providerId: string;
  facilityId: string;
  encounterDate: Date;
  diagnosisCodes: DiagnosisCode[];
  procedureCodes: ProcedureCode[];
  charges: Charge[];
  totalAmount: number;
  insuranceAmount: number;
  patientAmount: number;
  status: 'Draft' | 'Ready to Bill' | 'Submitted' | 'Paid' | 'Partial Payment' | 'Denied' | 'Appeal Submitted' | 'Written Off';
  claimId?: string;
  claimSubmissionDate?: Date;
  paymentDate?: Date;
  paymentAmount?: number;
  adjustments: Adjustment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DiagnosisCode {
  code: string;
  description: string;
  isPrimary: boolean;
}

export interface ProcedureCode {
  code: string;
  description: string;
  modifier?: string;
  units: number;
  amount: number;
}

export interface Charge {
  id: string;
  procedureCode: string;
  amount: number;
  units: number;
  dateOfService: Date;
}

export interface Adjustment {
  id: string;
  type: string;
  amount: number;
  date: Date;
  reason: string;
  userId: string;
}

export interface PatientRegistrationForm {
  patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>;
  consentForms: string[];
  emergencyContacts?: EmergencyContact[];
  insuranceVerification: {
    primaryInsuranceVerified: boolean;
    secondaryInsuranceVerified?: boolean;
    copayAmount: number;
    authorizationRequired: boolean;
  };
}

export interface OperationalReport {
  id: string;
  type: ReportType;
  name: string;
  description: string;
  parameters: ReportParameter[];
  generatedBy: string;
  generatedAt: Date;
  dateRange: {
    from: Date;
    to: Date;
  };
  data: any;
  format: 'PDF' | 'Excel' | 'CSV';
  filePath?: string;
}

export type ReportType = 
  | 'Patient Registration'
  | 'Appointment Analytics'
  | 'Revenue Cycle'
  | 'Productivity'
  | 'Patient Flow'
  | 'Quality Metrics'
  | 'Compliance'
  | 'Financial Performance'
  | 'Inventory'
  | 'Staff Performance';

export interface ReportParameter {
  name: string;
  value: any;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
}