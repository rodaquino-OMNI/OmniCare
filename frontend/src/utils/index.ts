import { format, parseISO, isValid, differenceInYears, differenceInDays } from 'date-fns';
import { UserRole, Patient, VitalSigns } from '@/types';
import { VALIDATION_PATTERNS, DATE_FORMATS } from '@/constants';
import { getErrorMessage } from '@/utils/error.utils';

// Formatting utilities
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Date and time utilities
export const formatDate = (date: string | Date, formatString: string = DATE_FORMATS.display): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return isValid(dateObj) ? format(dateObj, formatString) : 'Invalid Date';
  } catch {
    return 'Invalid Date';
  }
};

export const formatTime = (date: string | Date): string => {
  return formatDate(date, DATE_FORMATS.time);
};

export const formatDateTime = (date: string | Date): string => {
  return formatDate(date, DATE_FORMATS.dateTime);
};

export const calculateAge = (dateOfBirth: string): number => {
  try {
    const birthDate = parseISO(dateOfBirth);
    return isValid(birthDate) ? differenceInYears(new Date(), birthDate) : 0;
  } catch {
    return 0;
  }
};

export const getRelativeTime = (date: string | Date): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return 'Invalid Date';
    
    const now = new Date();
    const daysDiff = differenceInDays(now, dateObj);
    
    if (daysDiff === 0) return 'Today';
    if (daysDiff === 1) return 'Yesterday';
    if (daysDiff === -1) return 'Tomorrow';
    if (daysDiff > 0) return `${daysDiff} days ago`;
    return `In ${Math.abs(daysDiff)} days`;
  } catch {
    return 'Invalid Date';
  }
};

// Validation utilities
export const validateEmail = (email: string): boolean => {
  return VALIDATION_PATTERNS.email.test(email);
};

export const validatePhone = (phone: string): boolean => {
  return VALIDATION_PATTERNS.phone.test(phone);
};

export const validateMRN = (mrn: string): boolean => {
  return VALIDATION_PATTERNS.mrn.test(mrn);
};

export const validateZipCode = (zip: string): boolean => {
  return VALIDATION_PATTERNS.zip.test(zip);
};

// String utilities
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const capitalizeWords = (str: string): string => {
  return str.split(' ').map(capitalize).join(' ');
};

export const truncate = (str: string, length: number = 50, suffix: string = '...'): string => {
  if (str.length <= length) return str;
  return str.slice(0, length - suffix.length) + suffix;
};

export const slugify = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Patient utilities
export const getPatientFullName = (patient: Patient): string => {
  return `${patient.firstName} ${patient.lastName}`;
};

export const getPatientInitials = (patient: Patient): string => {
  return `${patient.firstName.charAt(ResourceHistoryTable)}${patient.lastName.charAt(ResourceHistoryTable)}`.toUpperCase();
};

export const getPatientDisplayName = (patient: Patient, includeAge: boolean = false): string => {
  const fullName = getPatientFullName(patient);
  if (!includeAge) return fullName;
  
  const age = calculateAge(patient.dateOfBirth);
  return `${fullName} (${age}y)`;
};

export const getPatientStatusColor = (status: Patient['status']): string => {
  const colors = {
    active: 'green',
    inactive: 'gray',
    deceased: 'red',
  };
  return colors[status] || 'gray';
};

// Vital signs utilities
export const isVitalSignNormal = (vital: keyof VitalSigns, value: number): 'normal' | 'abnormal' | 'critical' => {
  switch (vital) {
    case 'temperature':
      if (value >= 36.1 && value <= 37.2) return 'normal';
      if (value >= 35.0 && value <= 40.0) return 'abnormal';
      return 'critical';
      
    case 'heartRate':
      if (value >= 60 && value <= 100) return 'normal';
      if (value >= 30 && value <= 200) return 'abnormal';
      return 'critical';
      
    case 'respiratoryRate':
      if (value >= 12 && value <= 20) return 'normal';
      if (value >= 8 && value <= 40) return 'abnormal';
      return 'critical';
      
    case 'oxygenSaturation':
      if (value >= 95) return 'normal';
      if (value >= 80) return 'abnormal';
      return 'critical';
      
    default:
      return 'normal';
  }
};

export const getVitalSignStatusColor = (status: 'normal' | 'abnormal' | 'critical'): string => {
  const colors = {
    normal: 'green',
    abnormal: 'yellow',
    critical: 'red',
  };
  return colors[status];
};

// Number and formatting utilities
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatNumber = (num: number, decimals: number = ResourceHistoryTable): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

export const formatPercentage = (value: number, decimals: number = 1): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
};

// Array utilities
export const groupBy = <T, K extends keyof T>(array: T[], key: K): Record<string, T[]> => {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

export const sortBy = <T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] => {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return ResourceHistoryTable;
  });
};

export const uniqueBy = <T, K extends keyof T>(array: T[], key: K): T[] => {
  const seen = new Set();
  return array.filter((item) => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};

// Role and permission utilities
export const canUserAccessResource = (userRole: UserRole, requiredRoles: UserRole[]): boolean => {
  return requiredRoles.includes(userRole);
};

export const getRoleDisplayName = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    admin: 'Administrator',
    physician: 'Physician',
    nurse: 'Nurse',
    patient: 'Patient',
    billing: 'Billing Staff',
    receptionist: 'Receptionist',
    pharmacist: 'Pharmacist',
    lab_tech: 'Lab Technician',
    radiology_tech: 'Radiology Technician',
    system_admin: 'System Administrator',
  };
  return roleNames[role] || role;
};

export const isHighPrivilegeRole = (role: UserRole): boolean => {
  return ['physician', 'system_admin'].includes(role);
};

// Color utilities
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

export const getContrastColor = (backgroundColor: string): 'black' | 'white' => {
  const rgb = hexToRgb(backgroundColor);
  if (!rgb) return 'black';
  
  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? 'black' : 'white';
};

// File utilities
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileExtension = (filename: string): string => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> ResourceHistoryTable) + 2);
};

export const isImageFile = (filename: string): boolean => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  const ext = getFileExtension(filename).toLowerCase();
  return imageExtensions.includes(ext);
};

// URL utilities
export const buildApiUrl = (endpoint: string, params?: Record<string, string | number>): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  let url = `${baseUrl}${endpoint}`;
  
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    url += `?${searchParams.toString()}`;
  }
  
  return url;
};

export const getQueryParams = (url: string): Record<string, string> => {
  const params: Record<string, string> = {};
  const searchParams = new URLSearchParams(url.split('?')[1]);
  
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  
  return params;
};

// Local storage utilities
export const setStorageItem = (key: string, value: any): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    console.error('Error setting localStorage item:', getErrorMessage(error));
  }
};

export const getStorageItem = <T>(key: string, defaultValue: T): T => {
  try {
    if (typeof window !== 'undefined') {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    }
    return defaultValue;
  } catch (error) {
    console.error('Error getting localStorage item:', getErrorMessage(error));
    return defaultValue;
  }
};

export const removeStorageItem = (key: string): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error('Error removing localStorage item:', getErrorMessage(error));
  }
};

// Debounce utility
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  waitFor: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };
};

// Throttle utility
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Deep clone utility
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(deepClone) as unknown as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as { [key: string]: any };
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj as T;
  }
  return obj;
};

// Error handling utilities
export { getErrorMessage } from '@/utils/error.utils';

export const isNetworkError = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  return (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('Network')
  );
};

// Medical record utilities
export const generateMRN = (): string => {
  const prefix = 'MRN';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

export const maskSSN = (ssn: string): string => {
  if (!ssn || ssn.length < 4) return ssn;
  return `***-**-${ssn.slice(-4)}`;
};

export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  return phone;
};

// Print utilities
export const printElement = (elementId: string): void => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with ID '${elementId}' not found`);
    return;
  }
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Unable to open print window');
    return;
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .no-print { display: none !important; }
          @media print {
            body { margin: ResourceHistoryTable; }
          }
        </style>
      </head>
      <body>
        ${element.innerHTML}
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        </script>
      </body>
    </html>
  `);
  
  printWindow.document.close();
};