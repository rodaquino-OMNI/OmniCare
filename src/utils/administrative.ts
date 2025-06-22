// Administrative Utility Functions for OmniCare EMR

import { format, differenceInDays, addDays, isAfter, isBefore } from 'date-fns';

import { Patient, InsuranceInfo, Appointment, Billing } from '@/types/administrative';

/**
 * Patient Management Utilities
 */
export class PatientUtils {
  /**
   * Calculates patient age from date of birth
   */
  static calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Formats patient full name
   */
  static formatFullName(patient: Patient): string {
    const parts = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean);
    return parts.join(' ');
  }

  /**
   * Generates patient display name with age
   */
  static getDisplayName(patient: Patient): string {
    const name = this.formatFullName(patient);
    const age = this.calculateAge(patient.dateOfBirth);
    return `${name} (${age}y)`;
  }

  /**
   * Detects potential duplicate patients using fuzzy matching
   */
  static detectDuplicates(newPatient: Partial<Patient>, existingPatients: Patient[]): Patient[] {
    const duplicates: Patient[] = [];
    
    for (const existing of existingPatients) {
      let score = 0;
      
      // Name similarity (40% weight)
      if (this.isSimilarName(newPatient.firstName, existing.firstName) &&
          this.isSimilarName(newPatient.lastName, existing.lastName)) {
        score += 0.4;
      }
      
      // Date of birth match (30% weight)
      if (newPatient.dateOfBirth && 
          format(newPatient.dateOfBirth, 'yyyy-MM-dd') === format(existing.dateOfBirth, 'yyyy-MM-dd')) {
        score += 0.3;
      }
      
      // Phone number match (20% weight)
      if (newPatient.phone && existing.phone.length > 0) {
        const newPhone = newPatient.phone[0]?.number?.replace(/\D/g, '');
        const existingPhone = existing.phone[0]?.number?.replace(/\D/g, '');
        if (newPhone && existingPhone && newPhone === existingPhone) {
          score += 0.2;
        }
      }
      
      // Address similarity (10% weight)
      if (newPatient.address && this.isSimilarAddress(newPatient.address, existing.address)) {
        score += 0.1;
      }
      
      // Consider as duplicate if score >= 0.7
      if (score >= 0.7) {
        duplicates.push(existing);
      }
    }
    
    return duplicates;
  }

  private static isSimilarName(name1?: string, name2?: string): boolean {
    if (!name1 || !name2) return false;
    return this.levenshteinDistance(name1.toLowerCase(), name2.toLowerCase()) <= 2;
  }

  private static isSimilarAddress(addr1: any, addr2: any): boolean {
    if (!addr1 || !addr2) return false;
    return addr1.zipCode === addr2.zipCode && 
           this.levenshteinDistance(addr1.street.toLowerCase(), addr2.street.toLowerCase()) <= 3;
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Validates patient insurance information
   */
  static validateInsurance(insurance: InsuranceInfo): string[] {
    const errors: string[] = [];
    
    if (!insurance.planName.trim()) {
      errors.push('Plan name is required');
    }
    
    if (!insurance.policyNumber.trim()) {
      errors.push('Policy number is required');
    }
    
    if (!insurance.subscriberId.trim()) {
      errors.push('Subscriber ID is required');
    }
    
    if (insurance.expirationDate && isBefore(insurance.expirationDate, new Date())) {
      errors.push('Insurance plan has expired');
    }
    
    if (insurance.deductible < 0) {
      errors.push('Deductible cannot be negative');
    }
    
    return errors;
  }

  /**
   * Formats phone number for display
   */
  static formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  }

  /**
   * Formats SSN for display (partially masked)
   */
  static formatSSN(ssn: string, mask: boolean = true): string {
    const cleaned = ssn.replace(/\D/g, '');
    if (cleaned.length === 9) {
      if (mask) {
        return `XXX-XX-${cleaned.slice(-4)}`;
      } else {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
      }
    }
    return ssn;
  }
}

/**
 * Appointment Management Utilities
 */
export class AppointmentUtils {
  /**
   * Calculates appointment duration in minutes
   */
  static calculateDuration(startTime: Date, endTime: Date): number {
    return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
  }

  /**
   * Checks if appointment slots overlap
   */
  static hasOverlap(appointment1: Appointment, appointment2: Appointment): boolean {
    return (
      (appointment1.startTime < appointment2.endTime) &&
      (appointment1.endTime > appointment2.startTime)
    );
  }

  /**
   * Finds available time slots for a provider
   */
  static findAvailableSlots(
    providerSchedule: any[],
    existingAppointments: Appointment[],
    date: Date,
    durationMinutes: number
  ): Date[] {
    const slots: Date[] = [];
    const dayOfWeek = date.getDay();
    
    // Find provider's schedule for the day
    const daySchedule = providerSchedule.find(s => s.dayOfWeek === dayOfWeek && s.isAvailable);
    if (!daySchedule) return slots;
    
    // Parse schedule times
    const [startHour, startMinute] = daySchedule.startTime.split(':').map(Number);
    const [endHour, endMinute] = daySchedule.endTime.split(':').map(Number);
    
    const scheduleStart = new Date(date);
    scheduleStart.setHours(startHour, startMinute, 0, 0);
    
    const scheduleEnd = new Date(date);
    scheduleEnd.setHours(endHour, endMinute, 0, 0);
    
    // Generate 15-minute slots
    const current = new Date(scheduleStart);
    while (current < scheduleEnd) {
      const slotEnd = new Date(current.getTime() + durationMinutes * 60000);
      
      if (slotEnd <= scheduleEnd) {
        // Check if slot conflicts with existing appointments
        const hasConflict = existingAppointments.some(apt => 
          format(apt.startTime, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') &&
          this.hasOverlap(
            { startTime: current, endTime: slotEnd } as Appointment,
            apt
          )
        );
        
        if (!hasConflict) {
          slots.push(new Date(current));
        }
      }
      
      current.setMinutes(current.getMinutes() + 15); // 15-minute intervals
    }
    
    return slots;
  }

  /**
   * Determines if appointment reminder should be sent
   */
  static shouldSendReminder(appointment: Appointment, reminderType: 'SMS' | 'Email' | 'Phone'): boolean {
    const now = new Date();
    const appointmentTime = appointment.startTime;
    const hoursUntilAppointment = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // Check if reminder was already sent
    const reminderSent = appointment.remindersSent.some(r => 
      r.type === reminderType && r.status === 'Delivered'
    );
    
    if (reminderSent) return false;
    
    // Send reminders based on time windows
    switch (reminderType) {
      case 'SMS':
        return hoursUntilAppointment <= 24 && hoursUntilAppointment > 2;
      case 'Email':
        return hoursUntilAppointment <= 48 && hoursUntilAppointment > 24;
      case 'Phone':
        return hoursUntilAppointment <= 2 && hoursUntilAppointment > 0;
      default:
        return false;
    }
  }

  /**
   * Calculates no-show rate for a provider or facility
   */
  static calculateNoShowRate(appointments: Appointment[]): number {
    const totalAppointments = appointments.length;
    if (totalAppointments === 0) return 0;
    
    const noShows = appointments.filter(apt => apt.status === 'No Show').length;
    return (noShows / totalAppointments) * 100;
  }

  /**
   * Formats appointment time range
   */
  static formatTimeRange(startTime: Date, endTime: Date): string {
    return `${format(startTime, 'h:mm a')} - ${format(endTime, 'h:mm a')}`;
  }
}

/**
 * Billing and Revenue Cycle Utilities
 */
export class BillingUtils {
  /**
   * Validates CPT code format
   */
  static isValidCPTCode(code: string): boolean {
    return /^\d{5}$/.test(code);
  }

  /**
   * Validates ICD-10 code format
   */
  static isValidICD10Code(code: string): boolean {
    return /^[A-Z]\d{2}(\.\d{1,3})?$/.test(code);
  }

  /**
   * Calculates aging buckets for accounts receivable
   */
  static calculateAgingBucket(billDate: Date): string {
    const daysPast = differenceInDays(new Date(), billDate);
    
    if (daysPast <= 30) return '0-30 days';
    if (daysPast <= 60) return '31-60 days';
    if (daysPast <= 90) return '61-90 days';
    if (daysPast <= 120) return '91-120 days';
    return '120+ days';
  }

  /**
   * Calculates collection rate
   */
  static calculateCollectionRate(billings: Billing[]): number {
    const totalBilled = billings.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalCollected = billings.reduce((sum, b) => sum + (b.paymentAmount || 0), 0);
    
    if (totalBilled === 0) return 0;
    return (totalCollected / totalBilled) * 100;
  }

  /**
   * Calculates average days in AR
   */
  static calculateAverageDaysInAR(billings: Billing[]): number {
    const pendingBills = billings.filter(b => !b.paymentDate);
    if (pendingBills.length === 0) return 0;
    
    const totalDays = pendingBills.reduce((sum, b) => {
      return sum + differenceInDays(new Date(), b.createdAt);
    }, 0);
    
    return Math.round(totalDays / pendingBills.length);
  }

  /**
   * Determines if claim needs follow-up
   */
  static needsFollowUp(billing: Billing): boolean {
    if (billing.status === 'Paid' || billing.status === 'Written Off') {
      return false;
    }
    
    const daysSinceSubmission = billing.claimSubmissionDate 
      ? differenceInDays(new Date(), billing.claimSubmissionDate)
      : 0;
    
    // Follow up after 30 days for submitted claims
    return billing.status === 'Submitted' && daysSinceSubmission > 30;
  }

  /**
   * Formats currency for display
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  /**
   * Calculates claim reimbursement rate
   */
  static calculateReimbursementRate(totalBilled: number, totalPaid: number): number {
    if (totalBilled === 0) return 0;
    return (totalPaid / totalBilled) * 100;
  }
}

/**
 * Document Management Utilities
 */
export class DocumentUtils {
  /**
   * Validates file type for medical documents
   */
  static isValidFileType(fileName: string, allowedTypes: string[] = ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'doc', 'docx']): boolean {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return extension ? allowedTypes.includes(extension) : false;
  }

  /**
   * Formats file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generates document retention date based on type
   */
  static calculateRetentionDate(documentType: string, createdDate: Date): Date {
    const retentionPeriods: Record<string, number> = {
      'Clinical Note': 7, // 7 years
      'Lab Result': 7,
      'Imaging': 7,
      'Consent Form': 7,
      'Insurance Card': 3,
      'ID Document': 3,
      'Referral': 5,
      'Prescription': 3,
      'Other': 7
    };
    
    const years = retentionPeriods[documentType] || 7;
    return addDays(createdDate, years * 365);
  }

  /**
   * Checks if document is expired for retention
   */
  static isExpiredForRetention(document: { retentionDate?: Date }): boolean {
    if (!document.retentionDate) return false;
    return isAfter(new Date(), document.retentionDate);
  }
}

/**
 * Reporting and Analytics Utilities
 */
export class ReportingUtils {
  /**
   * Calculates percentage change between two values
   */
  static calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Generates date ranges for reports
   */
  static getDateRanges(): Record<string, { from: Date; to: Date }> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    return {
      today: { from: startOfToday, to: now },
      thisWeek: { from: startOfWeek, to: now },
      thisMonth: { from: startOfMonth, to: now },
      thisYear: { from: startOfYear, to: now },
      last30Days: { from: addDays(now, -30), to: now },
      last90Days: { from: addDays(now, -90), to: now }
    };
  }

  /**
   * Formats numbers for display in reports
   */
  static formatNumber(value: number, type: 'currency' | 'percentage' | 'integer' = 'integer'): string {
    switch (type) {
      case 'currency':
        return BillingUtils.formatCurrency(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'integer':
        return value.toLocaleString();
      default:
        return value.toString();
    }
  }

  /**
   * Calculates trend direction
   */
  static getTrendDirection(current: number, previous: number): 'up' | 'down' | 'neutral' {
    const change = this.calculatePercentageChange(current, previous);
    if (Math.abs(change) < 1) return 'neutral';
    return change > 0 ? 'up' : 'down';
  }
}

/**
 * Validation Utilities
 */
export class ValidationUtils {
  /**
   * Validates email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validates phone number format
   */
  static isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validates ZIP code format
   */
  static isValidZipCode(zipCode: string): boolean {
    const zipRegex = /^\d{5}(-\d{4})?$/;
    return zipRegex.test(zipCode);
  }

  /**
   * Validates SSN format
   */
  static isValidSSN(ssn: string): boolean {
    const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;
    return ssnRegex.test(ssn);
  }

  /**
   * Validates date is not in the future
   */
  static isValidPastDate(date: Date): boolean {
    return isBefore(date, new Date());
  }

  /**
   * Validates date of birth is reasonable
   */
  static isValidDateOfBirth(dateOfBirth: Date): boolean {
    const age = PatientUtils.calculateAge(dateOfBirth);
    return age >= 0 && age <= 150;
  }
}

/**
 * Security and Compliance Utilities
 */
export class ComplianceUtils {
  /**
   * Masks sensitive information for display
   */
  static maskSensitiveData(data: string, type: 'ssn' | 'account' | 'card'): string {
    switch (type) {
      case 'ssn':
        return PatientUtils.formatSSN(data, true);
      case 'account':
        return data.length > 4 ? `****${data.slice(-4)}` : data;
      case 'card':
        return data.length > 4 ? `**** **** **** ${data.slice(-4)}` : data;
      default:
        return data;
    }
  }

  /**
   * Generates audit log entry
   */
  static generateAuditLog(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    details?: any
  ): any {
    return {
      timestamp: new Date(),
      userId,
      action,
      resource,
      resourceId,
      details,
      ipAddress: 'system', // Should be populated from request
      userAgent: 'system'   // Should be populated from request
    };
  }

  /**
   * Checks if user has permission for action
   */
  static hasPermission(userRole: string, _module: string, _action: string): boolean {
    // Implementation would check against permission matrix
    // This is a simplified version
    const adminRoles = ['System Administrator', 'Department Manager'];
    if (adminRoles.includes(userRole)) return true;
    
    // Add specific permission logic here
    return false;
  }
}

