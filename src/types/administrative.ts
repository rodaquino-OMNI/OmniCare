// Administrative Types for OmniCare EMR

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: Date;
  ssn?: string;
  gender: 'M' | 'F' | 'O' | 'U';
  address: Address;
  phone: PhoneNumber[];
  email?: string;
  emergencyContact: EmergencyContact;
  insurance: InsuranceInfo[];
  maritalStatus: 'Single' | 'Married' | 'Divorced' | 'Widowed' | 'Other';
  employmentStatus: 'Employed' | 'Unemployed' | 'Retired' | 'Student' | 'Disabled';
  preferredLanguage: string;
  race?: string;
  ethnicity?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'Active' | 'Inactive' | 'Deceased';
  photographPath?: string;
  patientPortalCredentials?: PatientPortalCredentials;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  addressType: 'Home' | 'Work' | 'Temporary' | 'Other';
}

export interface PhoneNumber {
  number: string;
  type: 'Home' | 'Work' | 'Mobile' | 'Emergency';
  isPrimary: boolean;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  address?: Address;
}

export interface InsuranceInfo {
  id: string;
  planName: string;
  policyNumber: string;
  groupNumber?: string;
  subscriberId: string;
  subscriberName: string;
  subscriberDateOfBirth: Date;
  relationship: 'Self' | 'Spouse' | 'Child' | 'Other';
  isPrimary: boolean;
  effectiveDate: Date;
  expirationDate?: Date;
  copay: number;
  deductible: number;
  outOfPocketMax: number;
  eligibilityVerified: boolean;
  verificationDate?: Date;
  verificationStatus: 'Verified' | 'Pending' | 'Denied' | 'Expired';
  priorAuthRequired: boolean;
  referralRequired: boolean;
}

export interface PatientPortalCredentials {
  username: string;
  isActivated: boolean;
  activationDate?: Date;
  lastLogin?: Date;
}

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  facilityId: string;
  appointmentType: AppointmentType;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: AppointmentStatus;
  reasonForVisit: string;
  notes?: string;
  roomId?: string;
  checkInTime?: Date;
  checkOutTime?: Date;
  waitTime?: number;
  confirmedBy?: string;
  remindersSent: ReminderRecord[];
  cancellationReason?: string;
  noShowReason?: string;
  rescheduledFromId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AppointmentType = 
  | 'New Patient'
  | 'Follow-up'
  | 'Annual Physical'
  | 'Consultation'
  | 'Procedure'
  | 'Urgent Care'
  | 'Telemedicine'
  | 'Lab Draw'
  | 'Imaging'
  | 'Therapy';

export type AppointmentStatus = 
  | 'Scheduled'
  | 'Confirmed'
  | 'Checked In'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled'
  | 'No Show'
  | 'Rescheduled';

export interface ReminderRecord {
  type: 'SMS' | 'Email' | 'Phone';
  sentAt: Date;
  status: 'Sent' | 'Delivered' | 'Failed';
}

export interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  specialty: string;
  npi: string;
  licenseNumber: string;
  dea?: string;
  email: string;
  phone: string;
  schedule: ProviderSchedule[];
  isActive: boolean;
  facilityIds: string[];
}

export interface ProviderSchedule {
  dayOfWeek: number; // 0-6, Sunday = 0
  startTime: string; // HH:mm format
  endTime: string;
  isAvailable: boolean;
  breakTimes?: BreakTime[];
}

export interface BreakTime {
  startTime: string;
  endTime: string;
  description: string;
}

export interface Facility {
  id: string;
  name: string;
  address: Address;
  phone: string;
  taxId: string;
  npi: string;
  rooms: Room[];
  equipment: Equipment[];
  operatingHours: OperatingHours[];
}

export interface Room {
  id: string;
  name: string;
  type: 'Exam' | 'Procedure' | 'Office' | 'Lab' | 'Imaging' | 'Surgery';
  capacity: number;
  isActive: boolean;
  equipment: string[]; // Equipment IDs
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  purchaseDate: Date;
  warrantyExpiration?: Date;
  lastMaintenanceDate?: Date;
  nextMaintenanceDate?: Date;
  status: 'Available' | 'In Use' | 'Maintenance' | 'Out of Service';
  location?: string;
}

export interface OperatingHours {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isOpen: boolean;
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
  status: BillingStatus;
  claimId?: string;
  claimSubmissionDate?: Date;
  paymentDate?: Date;
  paymentAmount?: number;
  adjustments: Adjustment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DiagnosisCode {
  code: string; // ICD-10
  description: string;
  isPrimary: boolean;
}

export interface ProcedureCode {
  code: string; // CPT/HCPCS
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

export type BillingStatus = 
  | 'Draft'
  | 'Ready to Bill'
  | 'Submitted'
  | 'Paid'
  | 'Partial Payment'
  | 'Denied'
  | 'Appeal Submitted'
  | 'Written Off';

export interface Adjustment {
  id: string;
  type: 'Insurance Payment' | 'Patient Payment' | 'Adjustment' | 'Write-off';
  amount: number;
  date: Date;
  reason: string;
  userId: string;
}

export interface Document {
  id: string;
  patientId?: string;
  type: DocumentType;
  category: string;
  title: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
  tags: string[];
  isConfidential: boolean;
  retentionDate?: Date;
  status: 'Active' | 'Archived' | 'Deleted';
}

export type DocumentType = 
  | 'Clinical Note'
  | 'Lab Result'
  | 'Imaging'
  | 'Consent Form'
  | 'Insurance Card'
  | 'ID Document'
  | 'Referral'
  | 'Prescription'
  | 'Other';

export interface ReleaseOfInformation {
  id: string;
  patientId: string;
  requestedBy: string;
  requestDate: Date;
  purpose: string;
  documentsRequested: string[];
  dateRange: {
    from: Date;
    to: Date;
  };
  recipientName: string;
  recipientAddress: Address;
  authorizationForm: string; // Document ID
  status: 'Pending' | 'In Progress' | 'Completed' | 'Denied';
  completedBy?: string;
  completedDate?: Date;
  deliveryMethod: 'Mail' | 'Fax' | 'Email' | 'Portal' | 'In Person';
  tracking: string[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department: string;
  isActive: boolean;
  lastLogin?: Date;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 
  | 'System Administrator'
  | 'Department Manager'
  | 'Front Desk Staff'
  | 'Administrative Staff'
  | 'Billing Staff'
  | 'Medical Coder'
  | 'Financial Counselor'
  | 'HIM Staff'
  | 'Provider'
  | 'Nurse'
  | 'Medical Assistant'
  | 'Security Administrator'
  | 'Compliance Officer'
  | 'Quality Manager';

export interface Permission {
  module: string;
  action: 'Create' | 'Read' | 'Update' | 'Delete';
  granted: boolean;
}

export interface SupplyItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  sku: string;
  manufacturer: string;
  unitOfMeasure: string;
  unitCost: number;
  reorderLevel: number;
  maxStockLevel: number;
  currentStock: number;
  location: string;
  expirationDate?: Date;
  lotNumber?: string;
  vendorId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplyOrder {
  id: string;
  orderNumber: string;
  vendorId: string;
  orderDate: Date;
  expectedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  orderedBy: string;
  receivedBy?: string;
  notes?: string;
}

export type OrderStatus = 
  | 'Draft'
  | 'Submitted'
  | 'Approved'
  | 'Ordered'
  | 'Shipped'
  | 'Received'
  | 'Cancelled';

export interface OrderItem {
  supplyItemId: string;
  quantityOrdered: number;
  quantityReceived?: number;
  unitCost: number;
  totalCost: number;
}

export interface Vendor {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: Address;
  paymentTerms: string;
  isActive: boolean;
  suppliedItems: string[]; // Supply Item IDs
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
  data: any; // Report-specific data structure
  format: 'PDF' | 'Excel' | 'CSV' | 'JSON';
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

export interface StaffSchedule {
  id: string;
  staffId: string;
  scheduleType: 'Regular' | 'Override' | 'Time Off';
  date: Date;
  startTime: string;
  endTime: string;
  department: string;
  position: string;
  isApproved: boolean;
  approvedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeOffRequest {
  id: string;
  staffId: string;
  requestType: 'Vacation' | 'Sick' | 'Personal' | 'Emergency' | 'Bereavement';
  startDate: Date;
  endDate: Date;
  totalHours: number;
  reason?: string;
  status: 'Pending' | 'Approved' | 'Denied' | 'Cancelled';
  requestedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewComments?: string;
}

export interface PatientFeedback {
  id: string;
  patientId: string;
  appointmentId?: string;
  type: 'Survey' | 'Complaint' | 'Compliment' | 'Suggestion';
  rating?: number; // 1-5 scale
  feedback: string;
  category: string;
  submittedAt: Date;
  status: 'New' | 'In Review' | 'Responded' | 'Resolved' | 'Closed';
  assignedTo?: string;
  responseText?: string;
  respondedAt?: Date;
  followUpRequired: boolean;
}

export interface SystemAlert {
  id: string;
  type: 'Security' | 'System' | 'Clinical' | 'Administrative' | 'Compliance';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  title: string;
  message: string;
  triggeredBy?: string;
  triggeredAt: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  status: 'Active' | 'Acknowledged' | 'Resolved';
  metadata?: Record<string, any>;
}

// Form interfaces for data entry
export interface PatientRegistrationForm {
  patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>;
  consentForms: string[];
  emergencyContacts: EmergencyContact[];
  insuranceVerification: {
    primaryInsuranceVerified: boolean;
    secondaryInsuranceVerified: boolean;
    copayAmount: number;
    authorizationRequired: boolean;
  };
}

export interface AppointmentSchedulingForm {
  patientId: string;
  providerId: string;
  appointmentType: AppointmentType;
  reasonForVisit: string;
  preferredDate: Date;
  preferredTime: string;
  duration: number;
  specialRequests?: string;
  insuranceVerificationNeeded: boolean;
}

export interface BillingSubmissionForm {
  patientId: string;
  providerId: string;
  encounterDate: Date;
  diagnosisCodes: string[];
  procedureCodes: { code: string; units: number }[];
  medicalNecessity: string;
  authorizationNumber?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SearchFilters {
  searchTerm?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  status?: string[];
  department?: string;
  provider?: string;
  facility?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Dashboard metrics
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