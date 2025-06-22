/**
 * OmniCare EMR - Laboratory Integration Service
 * Handles lab orders, results, and laboratory system integration
 */

import { EventEmitter } from 'events';
import logger from '@/utils/logger';

export interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  orderingProviderId: string;
  orderingProviderName: string;
  laboratoryId: string;
  laboratoryName: string;
  orderDate: Date;
  collectionDate?: Date;
  status: LabOrderStatus;
  priority: 'routine' | 'urgent' | 'stat' | 'asap';
  tests: LabTest[];
  specimenInfo: SpecimenInfo;
  clinicalInfo?: ClinicalInfo;
  resultDetails?: LabResultDetails;
  comments?: string;
  externalOrderId?: string;
}

export enum LabOrderStatus {
  DRAFT = 'draft',
  ORDERED = 'ordered',
  COLLECTED = 'collected',
  IN_TRANSIT = 'in-transit',
  RECEIVED = 'received',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  CORRECTED = 'corrected',
  FINAL = 'final',
  CANCELLED = 'cancelled',
  ERROR = 'error'
}

export interface LabTest {
  id: string;
  code: string;
  codeSystem: 'LOINC' | 'CPT' | 'Local';
  name: string;
  category: string;
  specimenType: string;
  methodology?: string;
  turnaroundTime?: number; // in hours
  criticalValues?: CriticalValue[];
  referenceRanges?: ReferenceRange[];
  cost?: number;
  requiresFasting?: boolean;
  patientPreparation?: string[];
}

export interface SpecimenInfo {
  type: string;
  collectionMethod: string;
  collectionSite?: string;
  collectionDate?: Date;
  collectionTime?: string;
  collectedBy?: string;
  volume?: {
    value: number;
    unit: string;
  };
  containers: Container[];
  additives?: string[];
  fastingStatus?: boolean;
  fastingDuration?: number;
}

export interface Container {
  type: string;
  color: string;
  additive?: string;
  volume?: {
    value: number;
    unit: string;
  };
  barcode?: string;
}

export interface ClinicalInfo {
  icd10Codes: string[];
  clinicalDiagnosis: string[];
  clinicalHistory: string;
  medications: string[];
  allergies: string[];
  relevantSymptoms: string[];
}

export interface LabResultDetails {
  accessionNumber: string;
  reportDate: Date;
  verifiedBy: string;
  verifiedDate: Date;
  results: LabResult[];
  interpretation?: string;
  recommendations?: string[];
  additionalComments?: string;
  amendments?: Amendment[];
}

export interface LabResult {
  testId: string;
  testName: string;
  testCode: string;
  value: string | number;
  unit?: string;
  referenceRange?: string;
  status: 'preliminary' | 'final' | 'corrected' | 'cancelled';
  abnormalFlag?: 'L' | 'H' | 'LL' | 'HH' | 'N' | 'A';
  criticalFlag?: boolean;
  resultDate: Date;
  performer?: string;
  method?: string;
  instrument?: string;
  notes?: string;
}

export interface ReferenceRange {
  low?: number;
  high?: number;
  text?: string;
  age?: {
    min?: number;
    max?: number;
    unit: 'years' | 'months' | 'days';
  };
  gender?: 'male' | 'female' | 'both';
  condition?: string;
}

export interface CriticalValue {
  condition: string;
  value: number | string;
  operator: '<' | '>' | '==' | '<=' | '>=' | '!=';
  action: string;
  notificationRequired: boolean;
}

export interface Amendment {
  id: string;
  date: Date;
  amendedBy: string;
  reason: string;
  originalValue: string;
  newValue: string;
  comments?: string;
}

export interface LabOrderRequest {
  patientId: string;
  orderingProviderId: string;
  laboratoryId: string;
  tests: string[]; // test codes
  priority: 'routine' | 'urgent' | 'stat' | 'asap';
  specimenType: string;
  collectionDate?: Date;
  clinicalInfo?: Partial<ClinicalInfo>;
  comments?: string;
}

export interface LaboratoryInfo {
  id: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  phone: string;
  fax?: string;
  email?: string;
  website?: string;
  accreditation: string[];
  capabilities: string[];
  turnaroundTimes: Record<string, number>;
  supportedInterfaces: string[];
  hours: {
    weekdays: string;
    weekends: string;
    holidays: string;
  };
  pickupSchedule?: {
    frequency: string;
    times: string[];
  };
  certifications: LabCertification[];
}

export interface LabCertification {
  type: string;
  number: string;
  issuedBy: string;
  issuedDate: Date;
  expirationDate: Date;
  status: 'active' | 'expired' | 'pending';
}

export interface CriticalResultNotification {
  orderId: string;
  testName: string;
  value: string;
  criticalValue: CriticalValue;
  patientId: string;
  orderingProviderId: string;
  notificationDate: Date;
  notificationMethod: 'phone' | 'fax' | 'secure-message' | 'email';
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedDate?: Date;
}

export class LabIntegrationService extends EventEmitter {
  private labOrders: Map<string, LabOrder> = new Map();
  private laboratories: Map<string, LaboratoryInfo> = new Map();
  private testCatalog: Map<string, LabTest> = new Map();
  private criticalNotifications: Map<string, CriticalResultNotification> = new Map();

  constructor() {
    super();
    this.initializeService();
  }

  /**
   * Initialize lab integration service
   */
  private async initializeService(): Promise<void> {
    logger.info('Initializing lab integration service');
    
    // TODO: Load test catalog, laboratory directory, establish connections
    await this.loadTestCatalog();
    await this.loadLaboratoryDirectory();
  }

  /**
   * Create and submit lab order
   */
  async createLabOrder(orderRequest: LabOrderRequest): Promise<LabOrder> {
    try {
      logger.debug('Creating lab order');

      const laboratory = this.laboratories.get(orderRequest.laboratoryId);
      if (!laboratory) {
        throw new Error('Laboratory not found');
      }

      // Validate requested tests
      const tests = await this.validateTests(orderRequest.tests);

      const order: LabOrder = {
        id: this.generateOrderId(),
        patientId: orderRequest.patientId,
        patientName: '', // TODO: Fetch from patient service
        orderingProviderId: orderRequest.orderingProviderId,
        orderingProviderName: '', // TODO: Fetch from provider service
        laboratoryId: orderRequest.laboratoryId,
        laboratoryName: laboratory.name,
        orderDate: new Date(),
        collectionDate: orderRequest.collectionDate,
        status: LabOrderStatus.DRAFT,
        priority: orderRequest.priority,
        tests,
        specimenInfo: {
          type: orderRequest.specimenType,
          collectionMethod: 'venipuncture', // Default
          containers: [] // TODO: Determine from tests
        },
        clinicalInfo: orderRequest.clinicalInfo as ClinicalInfo,
        comments: orderRequest.comments
      };

      // Store order
      this.labOrders.set(order.id, order);

      logger.info(`Lab order ${order.id} created for patient ${order.patientId}`);
      return order;
    } catch (error) {
      logger.error('Failed to create lab order:', error);
      throw new Error(`Lab order creation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Submit lab order to laboratory
   */
  async submitLabOrder(orderId: string): Promise<void> {
    try {
      const order = this.labOrders.get(orderId);
      if (!order) {
        throw new Error('Lab order not found');
      }

      logger.debug(`Submitting lab order ${orderId} to ${order.laboratoryName}`);

      // TODO: Send order to laboratory system (HL7 ORM message, API, etc.)
      
      order.status = LabOrderStatus.ORDERED;
      order.externalOrderId = this.generateExternalOrderId();

      this.emit('orderSubmitted', order);
      logger.info(`Lab order ${orderId} submitted to ${order.laboratoryName}`);
    } catch (error) {
      logger.error('Failed to submit lab order:', error);
      throw new Error(`Lab order submission error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancel lab order
   */
  async cancelLabOrder(orderId: string, reason: string): Promise<void> {
    try {
      const order = this.labOrders.get(orderId);
      if (!order) {
        throw new Error('Lab order not found');
      }

      logger.debug(`Cancelling lab order ${orderId}`);

      // TODO: Send cancellation to laboratory if already submitted
      
      order.status = LabOrderStatus.CANCELLED;
      order.comments = `${order.comments || ''}\nCancelled: ${reason}`;

      this.emit('orderCancelled', { order, reason });
      logger.info(`Lab order ${orderId} cancelled`);
    } catch (error) {
      logger.error('Failed to cancel lab order:', error);
      throw new Error(`Lab order cancellation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process incoming lab results
   */
  async processLabResults(resultsData: any): Promise<void> {
    try {
      logger.debug('Processing incoming lab results');

      // TODO: Parse HL7 ORU message or other result format
      const orderId = resultsData.orderId;
      const order = this.labOrders.get(orderId);
      
      if (!order) {
        logger.warn(`Received results for unknown order: ${orderId}`);
        return;
      }

      // Update order with results
      order.status = LabOrderStatus.COMPLETED;
      order.resultDetails = {
        accessionNumber: resultsData.accessionNumber,
        reportDate: new Date(resultsData.reportDate),
        verifiedBy: resultsData.verifiedBy,
        verifiedDate: new Date(resultsData.verifiedDate),
        results: resultsData.results.map((result: any) => ({
          testId: result.testId,
          testName: result.testName,
          testCode: result.testCode,
          value: result.value,
          unit: result.unit,
          referenceRange: result.referenceRange,
          status: result.status,
          abnormalFlag: result.abnormalFlag,
          criticalFlag: result.criticalFlag,
          resultDate: new Date(result.resultDate),
          performer: result.performer,
          notes: result.notes
        })),
        interpretation: resultsData.interpretation,
        recommendations: resultsData.recommendations
      };

      // Check for critical values
      await this.checkCriticalValues(order);

      this.emit('resultsReceived', order);
      logger.info(`Lab results processed for order ${orderId}`);
    } catch (error) {
      logger.error('Failed to process lab results:', error);
      throw new Error(`Lab results processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get lab order status
   */
  async getOrderStatus(orderId: string): Promise<LabOrderStatus> {
    try {
      const order = this.labOrders.get(orderId);
      if (!order) {
        throw new Error('Lab order not found');
      }

      // TODO: Query laboratory system for real-time status if needed
      
      return order.status;
    } catch (error) {
      logger.error('Failed to get order status:', error);
      throw new Error(`Order status error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search available lab tests
   */
  async searchTests(criteria: {
    category?: string;
    specimenType?: string;
    keyword?: string;
    laboratoryId?: string;
  }): Promise<LabTest[]> {
    try {
      logger.debug('Searching lab tests:', criteria);

      let results = Array.from(this.testCatalog.values());

      // Apply filters
      if (criteria.category) {
        results = results.filter(test => test.category === criteria.category);
      }
      if (criteria.specimenType) {
        results = results.filter(test => test.specimenType === criteria.specimenType);
      }
      if (criteria.keyword) {
        const keyword = criteria.keyword.toLowerCase();
        results = results.filter(test => 
          test.name.toLowerCase().includes(keyword) ||
          test.code.toLowerCase().includes(keyword)
        );
      }

      logger.info(`Found ${results.length} tests matching criteria`);
      return results;
    } catch (error) {
      logger.error('Failed to search tests:', error);
      throw new Error(`Test search error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get patient lab history
   */
  async getPatientLabHistory(
    patientId: string, 
    dateRange?: { start: Date; end: Date }
  ): Promise<LabOrder[]> {
    try {
      logger.debug(`Getting lab history for patient ${patientId}`);

      let orders = Array.from(this.labOrders.values())
        .filter(order => order.patientId === patientId);

      if (dateRange) {
        orders = orders.filter(order => 
          order.orderDate >= dateRange.start && 
          order.orderDate <= dateRange.end
        );
      }

      orders.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());

      logger.info(`Retrieved ${orders.length} lab orders for patient ${patientId}`);
      return orders;
    } catch (error) {
      logger.error('Failed to get patient lab history:', error);
      throw new Error(`Lab history error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle critical value notifications
   */
  async handleCriticalValue(notification: CriticalResultNotification): Promise<void> {
    try {
      logger.warn(`Critical value detected: ${notification.testName} = ${notification.value}`);

      // Store notification
      this.criticalNotifications.set(notification.orderId, notification);

      // TODO: Send urgent notification to ordering provider
      // TODO: Follow up until acknowledged

      this.emit('criticalValue', notification);
      logger.info(`Critical value notification created for order ${notification.orderId}`);
    } catch (error) {
      logger.error('Failed to handle critical value:', error);
      throw new Error(`Critical value handling error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Acknowledge critical value notification
   */
  async acknowledgeCriticalValue(
    orderId: string, 
    acknowledgedBy: string
  ): Promise<void> {
    try {
      const notification = this.criticalNotifications.get(orderId);
      if (!notification) {
        throw new Error('Critical value notification not found');
      }

      notification.acknowledged = true;
      notification.acknowledgedBy = acknowledgedBy;
      notification.acknowledgedDate = new Date();

      this.emit('criticalValueAcknowledged', notification);
      logger.info(`Critical value acknowledged for order ${orderId} by ${acknowledgedBy}`);
    } catch (error) {
      logger.error('Failed to acknowledge critical value:', error);
      throw new Error(`Critical value acknowledgment error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load test catalog from laboratory systems
   */
  private async loadTestCatalog(): Promise<void> {
    try {
      // TODO: Load from laboratory systems or central database
      
      // Sample test for demonstration
      const sampleTest: LabTest = {
        id: 'test_001',
        code: '33747-0',
        codeSystem: 'LOINC',
        name: 'Complete Blood Count',
        category: 'Hematology',
        specimenType: 'Blood',
        methodology: 'Flow Cytometry',
        turnaroundTime: 4,
        requiresFasting: false,
        criticalValues: [
          {
            condition: 'WBC < 1.0',
            value: 1.0,
            operator: '<',
            action: 'Immediate notification required',
            notificationRequired: true
          }
        ],
        referenceRanges: [
          {
            low: 4.0,
            high: 11.0,
            text: '4.0-11.0 x10^3/uL',
            gender: 'both'
          }
        ]
      };

      this.testCatalog.set(sampleTest.id, sampleTest);
      
      logger.info(`Loaded ${this.testCatalog.size} tests into catalog`);
    } catch (error) {
      logger.error('Failed to load test catalog:', error);
    }
  }

  /**
   * Load laboratory directory
   */
  private async loadLaboratoryDirectory(): Promise<void> {
    try {
      // TODO: Load from external directory service
      
      // Sample laboratory for demonstration
      const sampleLab: LaboratoryInfo = {
        id: 'lab_001',
        name: 'Regional Medical Laboratory',
        address: {
          street: '123 Lab Street',
          city: 'Medical City',
          state: 'CA',
          zipCode: '90210'
        },
        phone: '555-LAB-TEST',
        email: 'orders@regionallab.com',
        accreditation: ['CAP', 'CLIA'],
        capabilities: ['Hematology', 'Chemistry', 'Microbiology', 'Molecular'],
        turnaroundTimes: {
          'routine': 24,
          'urgent': 4,
          'stat': 1
        },
        supportedInterfaces: ['HL7', 'API', 'Fax'],
        hours: {
          weekdays: '6:00 AM - 8:00 PM',
          weekends: '8:00 AM - 4:00 PM',
          holidays: 'Emergency only'
        },
        certifications: []
      };

      this.laboratories.set(sampleLab.id, sampleLab);
      
      logger.info(`Loaded ${this.laboratories.size} laboratories into directory`);
    } catch (error) {
      logger.error('Failed to load laboratory directory:', error);
    }
  }

  /**
   * Validate requested tests
   */
  private async validateTests(testCodes: string[]): Promise<LabTest[]> {
    const validTests: LabTest[] = [];
    
    for (const code of testCodes) {
      const test = Array.from(this.testCatalog.values())
        .find(t => t.code === code || t.id === code);
      
      if (!test) {
        throw new Error(`Invalid test code: ${code}`);
      }
      
      validTests.push(test);
    }
    
    return validTests;
  }

  /**
   * Check for critical values in results
   */
  private async checkCriticalValues(order: LabOrder): Promise<void> {
    if (!order.resultDetails?.results) return;

    for (const result of order.resultDetails.results) {
      if (result.criticalFlag) {
        const test = this.testCatalog.get(result.testId);
        if (test?.criticalValues) {
          for (const criticalValue of test.criticalValues) {
            if (this.isCriticalValue(result.value, criticalValue)) {
              const notification: CriticalResultNotification = {
                orderId: order.id,
                testName: result.testName,
                value: result.value.toString(),
                criticalValue,
                patientId: order.patientId,
                orderingProviderId: order.orderingProviderId,
                notificationDate: new Date(),
                notificationMethod: 'secure-message',
                acknowledged: false
              };

              await this.handleCriticalValue(notification);
            }
          }
        }
      }
    }
  }

  /**
   * Check if result value meets critical criteria
   */
  private isCriticalValue(value: string | number, critical: CriticalValue): boolean {
    const numValue = typeof value === 'number' ? value : parseFloat(value.toString());
    const criticalNum = typeof critical.value === 'number' ? critical.value : parseFloat(critical.value.toString());

    switch (critical.operator) {
      case '<': return numValue < criticalNum;
      case '>': return numValue > criticalNum;
      case '<=': return numValue <= criticalNum;
      case '>=': return numValue >= criticalNum;
      case '==': return numValue === criticalNum;
      case '!=': return numValue !== criticalNum;
      default: return false;
    }
  }

  /**
   * Generate unique order ID
   */
  private generateOrderId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `lab_${timestamp}${random}`;
  }

  /**
   * Generate external order ID
   */
  private generateExternalOrderId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `ext_${timestamp}${random}`;
  }

  /**
   * Get service health status
   */
  getHealthStatus(): { status: string; details: any } {
    return {
      status: 'UP',
      details: {
        ordersCount: this.labOrders.size,
        laboratoriesCount: this.laboratories.size,
        testsInCatalog: this.testCatalog.size,
        criticalNotificationsCount: this.criticalNotifications.size
      }
    };
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.removeAllListeners();
    this.labOrders.clear();
    this.laboratories.clear();
    this.testCatalog.clear();
    this.criticalNotifications.clear();
    logger.info('Lab integration service shut down');
  }
}

// Export singleton instance
export const labIntegrationService = new LabIntegrationService();