// Administrative Services for OmniCare EMR API Integration

import { 
  Patient, 
  Appointment, 
  Billing, 
  User, 
  OperationalReport, 
  InsuranceInfo,
  SupplyItem,
  SupplyOrder,
  PatientFeedback,
  SystemAlert,
  ApiResponse,
  SearchFilters
} from '@/types/administrative';

/**
 * Base API Service Class
 */
class BaseApiService {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      // Add authentication headers here
    };
  }

  protected async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error(`API Error: ${endpoint}`, error);
      throw error;
    }
  }

  protected buildQueryString(params: Record<string, any>): string {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    });
    return query.toString();
  }
}

/**
 * Patient Registration and Management Service
 */
export class PatientService extends BaseApiService {
  /**
   * Creates a new patient record
   */
  async createPatient(patientData: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Patient>> {
    return this.request<Patient>('/patients', {
      method: 'POST',
      body: JSON.stringify(patientData),
    });
  }

  /**
   * Updates an existing patient record
   */
  async updatePatient(patientId: string, updates: Partial<Patient>): Promise<ApiResponse<Patient>> {
    return this.request<Patient>(`/patients/${patientId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Retrieves patient by ID
   */
  async getPatient(patientId: string): Promise<ApiResponse<Patient>> {
    return this.request<Patient>(`/patients/${patientId}`);
  }

  /**
   * Searches for patients with filters
   */
  async searchPatients(filters: SearchFilters): Promise<ApiResponse<Patient[]>> {
    const queryString = this.buildQueryString(filters);
    return this.request<Patient[]>(`/patients/search?${queryString}`);
  }

  /**
   * Checks for duplicate patients
   */
  async checkDuplicates(patientData: Partial<Patient>): Promise<ApiResponse<Patient[]>> {
    return this.request<Patient[]>('/patients/duplicates', {
      method: 'POST',
      body: JSON.stringify(patientData),
    });
  }

  /**
   * Verifies insurance eligibility
   */
  async verifyInsurance(insuranceInfo: InsuranceInfo): Promise<ApiResponse<{
    isEligible: boolean;
    benefits: any;
    copay: number;
    deductible: number;
    authorizationRequired: boolean;
  }>> {
    return this.request('/patients/insurance/verify', {
      method: 'POST',
      body: JSON.stringify(insuranceInfo),
    });
  }

  /**
   * Activates patient portal account
   */
  async activatePortal(patientId: string, credentials: {
    username: string;
    temporaryPassword: string;
  }): Promise<ApiResponse<{ activated: boolean }>> {
    return this.request(`/patients/${patientId}/portal/activate`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }
}

/**
 * Appointment Management Service
 */
export class AppointmentService extends BaseApiService {
  /**
   * Creates a new appointment
   */
  async createAppointment(appointmentData: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Appointment>> {
    return this.request<Appointment>('/appointments', {
      method: 'POST',
      body: JSON.stringify(appointmentData),
    });
  }

  /**
   * Updates appointment status
   */
  async updateAppointmentStatus(appointmentId: string, status: string): Promise<ApiResponse<Appointment>> {
    return this.request<Appointment>(`/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  /**
   * Gets appointments for a date range
   */
  async getAppointments(filters: {
    startDate: Date;
    endDate: Date;
    providerId?: string;
    facilityId?: string;
    status?: string;
  }): Promise<ApiResponse<Appointment[]>> {
    const queryString = this.buildQueryString({
      ...filters,
      startDate: filters.startDate.toISOString(),
      endDate: filters.endDate.toISOString(),
    });
    return this.request<Appointment[]>(`/appointments?${queryString}`);
  }

  /**
   * Finds available appointment slots
   */
  async findAvailableSlots(params: {
    providerId: string;
    date: Date;
    duration: number;
    appointmentType: string;
  }): Promise<ApiResponse<Date[]>> {
    const queryString = this.buildQueryString({
      ...params,
      date: params.date.toISOString(),
    });
    return this.request<Date[]>(`/appointments/available-slots?${queryString}`);
  }

  /**
   * Sends appointment reminders
   */
  async sendReminder(appointmentId: string, type: 'SMS' | 'Email' | 'Phone'): Promise<ApiResponse<{ sent: boolean }>> {
    return this.request(`/appointments/${appointmentId}/reminder`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
  }

  /**
   * Cancels an appointment
   */
  async cancelAppointment(appointmentId: string, reason: string): Promise<ApiResponse<Appointment>> {
    return this.request<Appointment>(`/appointments/${appointmentId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Reschedules an appointment
   */
  async rescheduleAppointment(appointmentId: string, newDateTime: Date): Promise<ApiResponse<Appointment>> {
    return this.request<Appointment>(`/appointments/${appointmentId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ newDateTime: newDateTime.toISOString() }),
    });
  }
}

/**
 * Billing and Revenue Cycle Service
 */
export class BillingService extends BaseApiService {
  /**
   * Creates a new billing record
   */
  async createBilling(billingData: Omit<Billing, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Billing>> {
    return this.request<Billing>('/billing', {
      method: 'POST',
      body: JSON.stringify(billingData),
    });
  }

  /**
   * Submits a claim to insurance
   */
  async submitClaim(billingId: string): Promise<ApiResponse<{ claimId: string; submissionDate: Date }>> {
    return this.request(`/billing/${billingId}/submit`, {
      method: 'POST',
    });
  }

  /**
   * Checks claim status
   */
  async checkClaimStatus(claimId: string): Promise<ApiResponse<{
    status: string;
    paymentAmount?: number;
    denialReason?: string;
    remittanceAdvice?: any;
  }>> {
    return this.request(`/billing/claims/${claimId}/status`);
  }

  /**
   * Processes payment
   */
  async processPayment(billingId: string, payment: {
    amount: number;
    paymentMethod: string;
    paymentDate: Date;
    reference?: string;
  }): Promise<ApiResponse<Billing>> {
    return this.request(`/billing/${billingId}/payment`, {
      method: 'POST',
      body: JSON.stringify(payment),
    });
  }

  /**
   * Gets aging report
   */
  async getAgingReport(facilityId?: string): Promise<ApiResponse<{
    buckets: Record<string, { count: number; amount: number }>;
    totalOutstanding: number;
  }>> {
    const queryString = facilityId ? `?facilityId=${facilityId}` : '';
    return this.request(`/billing/aging-report${queryString}`);
  }

  /**
   * Generates patient statement
   */
  async generatePatientStatement(patientId: string, statementDate: Date): Promise<ApiResponse<{
    statementId: string;
    filePath: string;
  }>> {
    return this.request(`/billing/patients/${patientId}/statement`, {
      method: 'POST',
      body: JSON.stringify({ statementDate: statementDate.toISOString() }),
    });
  }

  /**
   * Submits appeal for denied claim
   */
  async submitAppeal(billingId: string, appealData: {
    reason: string;
    supportingDocuments: string[];
    additionalInfo?: string;
  }): Promise<ApiResponse<{ appealId: string }>> {
    return this.request(`/billing/${billingId}/appeal`, {
      method: 'POST',
      body: JSON.stringify(appealData),
    });
  }
}

/**
 * Document Management Service
 */
export class DocumentService extends BaseApiService {
  /**
   * Uploads a document
   */
  async uploadDocument(file: File, metadata: {
    patientId?: string;
    type: string;
    category: string;
    title: string;
    tags?: string[];
  }): Promise<ApiResponse<{ documentId: string; filePath: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));

    return this.request('/documents/upload', {
      method: 'POST',
      body: formData,
      headers: {}, // Remove Content-Type to let browser set it for FormData
    });
  }

  /**
   * Processes release of information request
   */
  async processROIRequest(request: {
    patientId: string;
    requestedBy: string;
    purpose: string;
    documentsRequested: string[];
    dateRange: { from: Date; to: Date };
    recipientInfo: any;
    authorizationFormId: string;
  }): Promise<ApiResponse<{ requestId: string }>> {
    return this.request('/documents/roi', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Gets documents for a patient
   */
  async getPatientDocuments(patientId: string, filters?: {
    type?: string;
    category?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<ApiResponse<any[]>> {
    const queryString = filters ? this.buildQueryString({
      ...filters,
      dateFrom: filters.dateFrom?.toISOString(),
      dateTo: filters.dateTo?.toISOString(),
    }) : '';
    return this.request(`/documents/patients/${patientId}?${queryString}`);
  }
}

/**
 * Inventory and Supply Management Service
 */
export class InventoryService extends BaseApiService {
  /**
   * Gets current inventory levels
   */
  async getInventory(filters?: {
    category?: string;
    location?: string;
    lowStock?: boolean;
  }): Promise<ApiResponse<SupplyItem[]>> {
    const queryString = filters ? this.buildQueryString(filters) : '';
    return this.request<SupplyItem[]>(`/inventory?${queryString}`);
  }

  /**
   * Creates a supply order
   */
  async createSupplyOrder(orderData: Omit<SupplyOrder, 'id' | 'orderNumber'>): Promise<ApiResponse<SupplyOrder>> {
    return this.request<SupplyOrder>('/inventory/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  /**
   * Updates inventory levels
   */
  async updateInventoryLevel(itemId: string, adjustment: {
    quantity: number;
    reason: string;
    userId: string;
  }): Promise<ApiResponse<SupplyItem>> {
    return this.request<SupplyItem>(`/inventory/${itemId}/adjust`, {
      method: 'POST',
      body: JSON.stringify(adjustment),
    });
  }

  /**
   * Gets low stock alerts
   */
  async getLowStockAlerts(): Promise<ApiResponse<SupplyItem[]>> {
    return this.request<SupplyItem[]>('/inventory/low-stock');
  }
}

/**
 * Reporting and Analytics Service
 */
export class ReportingService extends BaseApiService {
  /**
   * Generates operational report
   */
  async generateReport(reportConfig: {
    type: string;
    parameters: any;
    dateRange: { from: Date; to: Date };
    format: 'PDF' | 'Excel' | 'CSV';
  }): Promise<ApiResponse<{ reportId: string; filePath: string }>> {
    return this.request('/reports/generate', {
      method: 'POST',
      body: JSON.stringify({
        ...reportConfig,
        dateRange: {
          from: reportConfig.dateRange.from.toISOString(),
          to: reportConfig.dateRange.to.toISOString(),
        },
      }),
    });
  }

  /**
   * Gets dashboard metrics
   */
  async getDashboardMetrics(facilityId?: string, dateRange?: {
    from: Date;
    to: Date;
  }): Promise<ApiResponse<any>> {
    const params: any = {};
    if (facilityId) params.facilityId = facilityId;
    if (dateRange) {
      params.dateFrom = dateRange.from.toISOString();
      params.dateTo = dateRange.to.toISOString();
    }
    
    const queryString = this.buildQueryString(params);
    return this.request(`/reports/dashboard-metrics?${queryString}`);
  }

  /**
   * Gets performance analytics
   */
  async getPerformanceAnalytics(type: string, filters?: any): Promise<ApiResponse<any>> {
    const queryString = this.buildQueryString({ type, ...filters });
    return this.request(`/reports/analytics?${queryString}`);
  }
}

/**
 * User and System Administration Service
 */
export class AdminService extends BaseApiService {
  /**
   * Creates a new user account
   */
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<User>> {
    return this.request<User>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  /**
   * Updates user permissions
   */
  async updateUserPermissions(userId: string, permissions: any[]): Promise<ApiResponse<User>> {
    return this.request<User>(`/admin/users/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
  }

  /**
   * Gets system alerts
   */
  async getSystemAlerts(severity?: string): Promise<ApiResponse<SystemAlert[]>> {
    const queryString = severity ? `?severity=${severity}` : '';
    return this.request<SystemAlert[]>(`/admin/alerts${queryString}`);
  }

  /**
   * Acknowledges system alert
   */
  async acknowledgeAlert(alertId: string): Promise<ApiResponse<SystemAlert>> {
    return this.request<SystemAlert>(`/admin/alerts/${alertId}/acknowledge`, {
      method: 'POST',
    });
  }

  /**
   * Gets audit logs
   */
  async getAuditLogs(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<ApiResponse<any[]>> {
    const queryString = this.buildQueryString({
      ...filters,
      dateFrom: filters.dateFrom?.toISOString(),
      dateTo: filters.dateTo?.toISOString(),
    });
    return this.request(`/admin/audit-logs?${queryString}`);
  }
}

/**
 * Patient Experience and Communication Service
 */
export class PatientExperienceService extends BaseApiService {
  /**
   * Submits patient feedback
   */
  async submitFeedback(feedback: Omit<PatientFeedback, 'id' | 'submittedAt' | 'status'>): Promise<ApiResponse<PatientFeedback>> {
    return this.request<PatientFeedback>('/patient-experience/feedback', {
      method: 'POST',
      body: JSON.stringify(feedback),
    });
  }

  /**
   * Gets patient satisfaction metrics
   */
  async getSatisfactionMetrics(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    provider?: string;
    department?: string;
  }): Promise<ApiResponse<{
    averageRating: number;
    responseRate: number;
    categoryBreakdown: Record<string, number>;
    trends: any[];
  }>> {
    const queryString = filters ? this.buildQueryString({
      ...filters,
      dateFrom: filters.dateFrom?.toISOString(),
      dateTo: filters.dateTo?.toISOString(),
    }) : '';
    return this.request(`/patient-experience/metrics?${queryString}`);
  }

  /**
   * Sends mass communication to patients
   */
  async sendMassCommunication(communication: {
    title: string;
    message: string;
    type: 'Email' | 'SMS' | 'Portal';
    targetAudience: any;
    scheduledDate?: Date;
  }): Promise<ApiResponse<{ communicationId: string; recipientCount: number }>> {
    return this.request('/patient-experience/mass-communication', {
      method: 'POST',
      body: JSON.stringify(communication),
    });
  }
}

// Create service instances
export const patientService = new PatientService();
export const appointmentService = new AppointmentService();
export const billingService = new BillingService();
export const documentService = new DocumentService();
export const inventoryService = new InventoryService();
export const reportingService = new ReportingService();
export const adminService = new AdminService();
export const patientExperienceService = new PatientExperienceService();