import { UserRole, NavigationItem } from '@/types';
import { 
  User, 
  Stethoscope, 
  UserCheck, 
  Shield, 
  Pill, 
  FlaskConical, 
  Zap, 
  Users,
  FileText,
  Calendar,
  MessageSquare,
  BarChart3,
  Settings,
  Bell,
  Search,
  Home,
  Activity,
  ClipboardList,
  TestTube,
  Heart,
  UserCog,
  Hospital,
  Ambulance,
  Brain,
  Eye,
  Bone,
  Baby,
  Syringe,
} from 'lucide-react';

// Application metadata
export const APP_NAME = 'OmniCare EMR';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Comprehensive Electronic Medical Records System';

// API configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export const MEDPLUM_BASE_URL = process.env.NEXT_PUBLIC_MEDPLUM_URL || 'https://api.medplum.com';

// User roles and permissions
export const USER_ROLES: Record<UserRole, { label: string; description: string; color: string }> = {
  physician: {
    label: 'Physician',
    description: 'Medical doctor with full clinical privileges',
    color: '#0091FF',
  },
  nurse: {
    label: 'Nurse',
    description: 'Registered nurse with patient care responsibilities',
    color: '#00C853',
  },
  admin: {
    label: 'Administrator',
    description: 'Administrative staff managing operations',
    color: '#6E56CF',
  },
  pharmacist: {
    label: 'Pharmacist',
    description: 'Licensed pharmacist managing medications',
    color: '#06B6D4',
  },
  lab_tech: {
    label: 'Lab Technician',
    description: 'Laboratory technician processing tests',
    color: '#F59E0B',
  },
  radiology_tech: {
    label: 'Radiology Technician',
    description: 'Radiology technician performing imaging',
    color: '#6366F1',
  },
  patient: {
    label: 'Patient',
    description: 'Patient with access to personal health records',
    color: '#10B981',
  },
  system_admin: {
    label: 'System Administrator',
    description: 'Technical administrator with system access',
    color: '#DC2626',
  },
  billing: {
    label: 'Billing',
    description: 'Billing department staff managing payments',
    color: '#8B5CF6',
  },
  receptionist: {
    label: 'Receptionist',
    description: 'Reception staff managing patient check-in',
    color: '#F97316',
  },
};

// Navigation configuration
export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: Home,
    roles: ['physician', 'nurse', 'admin', 'pharmacist', 'lab_tech', 'radiology_tech'] as UserRole[],
  },
  {
    label: 'Patients',
    path: '/patients',
    icon: Users,
    roles: ['physician', 'nurse', 'admin'] as UserRole[],
    children: [
      {
        label: 'Patient List',
        path: '/patients',
        icon: Users,
        roles: ['physician', 'nurse', 'admin'] as UserRole[],
      },
      {
        label: 'Patient Search',
        path: '/patients/search',
        icon: Search,
        roles: ['physician', 'nurse', 'admin'] as UserRole[],
      },
      {
        label: 'New Patient',
        path: '/patients/new',
        icon: UserCheck,
        roles: ['admin', 'nurse'] as UserRole[],
      },
    ],
  },
  {
    label: 'Clinical',
    path: '/clinical',
    icon: Stethoscope,
    roles: ['physician', 'nurse'] as UserRole[],
    children: [
      {
        label: 'Encounters',
        path: '/clinical/encounters',
        icon: FileText,
        roles: ['physician', 'nurse'] as UserRole[],
      },
      {
        label: 'Documentation',
        path: '/clinical/documentation',
        icon: ClipboardList,
        roles: ['physician', 'nurse'] as UserRole[],
      },
      {
        label: 'Vital Signs',
        path: '/clinical/vitals',
        icon: Activity,
        roles: ['nurse'] as UserRole[],
      },
      {
        label: 'Care Plans',
        path: '/clinical/care-plans',
        icon: Heart,
        roles: ['physician', 'nurse'] as UserRole[],
      },
    ],
  },
  {
    label: 'Orders',
    path: '/orders',
    icon: ClipboardList,
    roles: ['physician'] as UserRole[],
    children: [
      {
        label: 'Laboratory',
        path: '/orders/lab',
        icon: TestTube,
        roles: ['physician'] as UserRole[],
      },
      {
        label: 'Imaging',
        path: '/orders/imaging',
        icon: Zap,
        roles: ['physician'] as UserRole[],
      },
      {
        label: 'Medications',
        path: '/orders/medications',
        icon: Pill,
        roles: ['physician'] as UserRole[],
      },
      {
        label: 'Procedures',
        path: '/orders/procedures',
        icon: Syringe,
        roles: ['physician'] as UserRole[],
      },
    ],
  },
  {
    label: 'Results',
    path: '/results',
    icon: BarChart3,
    roles: ['physician', 'nurse', 'lab_tech', 'radiology_tech'] as UserRole[],
    children: [
      {
        label: 'Lab Results',
        path: '/results/lab',
        icon: FlaskConical,
        roles: ['physician', 'nurse', 'lab_tech'] as UserRole[],
      },
      {
        label: 'Imaging Results',
        path: '/results/imaging',
        icon: Zap,
        roles: ['physician', 'nurse', 'radiology_tech'] as UserRole[],
      },
      {
        label: 'Trending',
        path: '/results/trending',
        icon: BarChart3,
        roles: ['physician', 'nurse'] as UserRole[],
      },
    ],
  },
  {
    label: 'Medications',
    path: '/medications',
    icon: Pill,
    roles: ['physician', 'nurse', 'pharmacist'] as UserRole[],
    children: [
      {
        label: 'Prescriptions',
        path: '/medications/prescriptions',
        icon: Pill,
        roles: ['physician', 'pharmacist'] as UserRole[],
      },
      {
        label: 'Administration',
        path: '/medications/administration',
        icon: Syringe,
        roles: ['nurse'] as UserRole[],
      },
      {
        label: 'Pharmacy Review',
        path: '/medications/pharmacy',
        icon: Pill,
        roles: ['pharmacist'] as UserRole[],
      },
    ],
  },
  {
    label: 'Scheduling',
    path: '/scheduling',
    icon: Calendar,
    roles: ['physician', 'nurse', 'admin'] as UserRole[],
    children: [
      {
        label: 'Appointments',
        path: '/scheduling/appointments',
        icon: Calendar,
        roles: ['admin', 'nurse'] as UserRole[],
      },
      {
        label: 'Provider Schedule',
        path: '/scheduling/providers',
        icon: UserCog,
        roles: ['physician', 'admin'] as UserRole[],
      },
      {
        label: 'Room Management',
        path: '/scheduling/rooms',
        icon: Hospital,
        roles: ['admin'] as UserRole[],
      },
    ],
  },
  {
    label: 'Communication',
    path: '/communication',
    icon: MessageSquare,
    roles: ['physician', 'nurse', 'admin'] as UserRole[],
    children: [
      {
        label: 'Messages',
        path: '/communication/messages',
        icon: MessageSquare,
        roles: ['physician', 'nurse', 'admin'] as UserRole[],
      },
      {
        label: 'Notifications',
        path: '/communication/notifications',
        icon: Bell,
        roles: ['physician', 'nurse', 'admin'] as UserRole[],
      },
    ],
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: BarChart3,
    roles: ['physician', 'admin', 'system_admin'] as UserRole[],
    children: [
      {
        label: 'Clinical Reports',
        path: '/reports/clinical',
        icon: FileText,
        roles: ['physician', 'admin'] as UserRole[],
      },
      {
        label: 'Administrative Reports',
        path: '/reports/admin',
        icon: BarChart3,
        roles: ['admin', 'system_admin'] as UserRole[],
      },
      {
        label: 'Quality Metrics',
        path: '/reports/quality',
        icon: Shield,
        roles: ['physician', 'admin'] as UserRole[],
      },
    ],
  },
  {
    label: 'Administration',
    path: '/admin',
    icon: Settings,
    roles: ['admin', 'system_admin'] as UserRole[],
    children: [
      {
        label: 'User Management',
        path: '/admin/users',
        icon: Users,
        roles: ['system_admin'] as UserRole[],
      },
      {
        label: 'System Settings',
        path: '/admin/settings',
        icon: Settings,
        roles: ['system_admin'] as UserRole[],
      },
      {
        label: 'Audit Logs',
        path: '/admin/audit',
        icon: Shield,
        roles: ['system_admin'] as UserRole[],
      },
    ],
  },
];

// Medical specialties
export const MEDICAL_SPECIALTIES = [
  { value: 'cardiology', label: 'Cardiology', icon: Heart, color: '#EF4444' },
  { value: 'neurology', label: 'Neurology', icon: Brain, color: '#8B5CF6' },
  { value: 'oncology', label: 'Oncology', icon: Activity, color: '#F59E0B' },
  { value: 'pediatrics', label: 'Pediatrics', icon: Baby, color: '#10B981' },
  { value: 'radiology', label: 'Radiology', icon: Zap, color: '#6366F1' },
  { value: 'emergency', label: 'Emergency Medicine', icon: Ambulance, color: '#DC2626' },
  { value: 'surgery', label: 'Surgery', icon: Syringe, color: '#7C3AED' },
  { value: 'pharmacy', label: 'Pharmacy', icon: Pill, color: '#06B6D4' },
  { value: 'internal_medicine', label: 'Internal Medicine', icon: Stethoscope, color: '#0284C7' },
  { value: 'family_medicine', label: 'Family Medicine', icon: Users, color: '#059669' },
  { value: 'psychiatry', label: 'Psychiatry', icon: Brain, color: '#C026D3' },
  { value: 'dermatology', label: 'Dermatology', icon: User, color: '#EA580C' },
  { value: 'orthopedics', label: 'Orthopedics', icon: Bone, color: '#7C2D12' },
  { value: 'gynecology', label: 'Gynecology', icon: User, color: '#BE185D' },
  { value: 'ophthalmology', label: 'Ophthalmology', icon: Eye, color: '#0D9488' },
  { value: 'anesthesiology', label: 'Anesthesiology', icon: Activity, color: '#4338CA' },
] as const;

// Common form validation patterns
export const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s\-\(\)]+$/,
  mrn: /^[A-Z0-9]{6,12}$/,
  zip: /^\d{5}(-\d{4})?$/,
  ssn: /^\d{3}-\d{2}-\d{4}$/,
  npi: /^\d{10}$/,
  dea: /^[A-Z]{2}\d{7}$/,
} as const;

// Date and time formats
export const DATE_FORMATS = {
  display: 'MMM dd, yyyy',
  input: 'yyyy-MM-dd',
  timestamp: 'yyyy-MM-dd HH:mm:ss',
  time: 'HH:mm',
  dateTime: 'MMM dd, yyyy HH:mm',
  iso: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
} as const;

// Pagination settings
export const PAGINATION = {
  defaultPageSize: 25,
  pageSizeOptions: [10, 25, 50, 100],
  maxVisiblePages: 5,
} as const;

// File upload settings
export const FILE_UPLOAD = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
  ],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.txt', '.csv'],
} as const;

// Notification settings
export const NOTIFICATION_SETTINGS = {
  autoClose: 5000, // 5 seconds
  position: 'top-right' as const,
  limit: 5,
} as const;

// Chart default settings
export const CHART_DEFAULTS = {
  height: 300,
  colors: [
    '#0091FF',
    '#00C853',
    '#6E56CF',
    '#17C964',
    '#FFB017',
    '#F31260',
    '#0072F5',
    '#8B5CF6',
    '#F59E0B',
    '#10B981',
  ],
  animation: true,
  responsive: true,
  maintainAspectRatio: false,
} as const;

// Table default settings
export const TABLE_DEFAULTS = {
  pageSize: 25,
  striped: true,
  highlightOnHover: true,
  withBorder: true,
  withColumnBorders: false,
  verticalSpacing: 'sm',
  horizontalSpacing: 'md',
} as const;

// Form default settings
export const FORM_DEFAULTS = {
  size: 'sm' as const,
  variant: 'default' as const,
  withAsterisk: true,
  clearButtonTabIndex: -1,
} as const;

// Modal default settings
export const MODAL_DEFAULTS = {
  size: 'md' as const,
  centered: true,
  overlayProps: { backgroundOpacity: 0.55, blur: 3 },
  transitionProps: { transition: 'fade', duration: 200 },
} as const;

// Emergency contact relationships
export const EMERGENCY_CONTACT_RELATIONSHIPS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'friend', label: 'Friend' },
  { value: 'guardian', label: 'Legal Guardian' },
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'other', label: 'Other' },
] as const;

// Insurance types
export const INSURANCE_TYPES = [
  { value: 'primary', label: 'Primary Insurance' },
  { value: 'secondary', label: 'Secondary Insurance' },
  { value: 'tertiary', label: 'Tertiary Insurance' },
  { value: 'workers_comp', label: 'Workers Compensation' },
  { value: 'auto', label: 'Auto Insurance' },
  { value: 'self_pay', label: 'Self Pay' },
] as const;

// Appointment types
export const APPOINTMENT_TYPES = [
  { value: 'checkup', label: 'Regular Checkup', duration: 30, color: '#0091FF' },
  { value: 'follow_up', label: 'Follow-up Visit', duration: 20, color: '#00C853' },
  { value: 'consultation', label: 'Consultation', duration: 45, color: '#6E56CF' },
  { value: 'procedure', label: 'Procedure', duration: 60, color: '#F31260' },
  { value: 'telemedicine', label: 'Telemedicine', duration: 25, color: '#17C964' },
  { value: 'urgent', label: 'Urgent Care', duration: 40, color: '#FFB017' },
  { value: 'physical', label: 'Physical Exam', duration: 45, color: '#0072F5' },
  { value: 'lab_review', label: 'Lab Review', duration: 15, color: '#8B5CF6' },
] as const;

// Lab test categories
export const LAB_TEST_CATEGORIES = [
  { value: 'hematology', label: 'Hematology', color: '#EF4444' },
  { value: 'chemistry', label: 'Chemistry', color: '#0284C7' },
  { value: 'microbiology', label: 'Microbiology', color: '#059669' },
  { value: 'immunology', label: 'Immunology', color: '#8B5CF6' },
  { value: 'molecular', label: 'Molecular', color: '#F59E0B' },
  { value: 'pathology', label: 'Pathology', color: '#DC2626' },
  { value: 'toxicology', label: 'Toxicology', color: '#7C3AED' },
  { value: 'endocrinology', label: 'Endocrinology', color: '#06B6D4' },
] as const;

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  search: 'mod+k',
  newPatient: 'mod+n',
  save: 'mod+s',
  print: 'mod+p',
  refresh: 'F5',
  help: 'F1',
  logout: 'mod+shift+l',
  dashboard: 'mod+d',
  patients: 'mod+p',
  orders: 'mod+o',
  results: 'mod+r',
} as const;