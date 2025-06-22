/**
 * OmniCare EMR - Insurance Integration Service
 * Handles insurance eligibility verification, claims processing, and prior authorization
 */

import { EventEmitter } from 'events';
import logger from '@/utils/logger';

export interface InsurancePlan {
  id: string;
  name: string;
  payorId: string;
  payorName: string;
  planType: 'HMO' | 'PPO' | 'EPO' | 'POS' | 'Medicare' | 'Medicaid' | 'Commercial' | 'Other';
  network: string[];
  effectiveDate: Date;
  terminationDate?: Date;
  coverageLevel: 'Individual' | 'Family' | 'Employee + Spouse' | 'Employee + Children';
  deductible: {
    individual: number;
    family: number;
    remaining: number;
  };
  outOfPocketMax: {
    individual: number;
    family: number;
    remaining: number;
  };
  benefits: BenefitCoverage[];
  formulary?: FormularyInfo;
}

export interface BenefitCoverage {
  serviceCategory: string;
  serviceType: string;
  network: 'in-network' | 'out-of-network';
  costSharing: CostSharing;
  priorAuthRequired: boolean;
  referralRequired: boolean;
  limitations?: string[];
  exclusions?: string[];
}

export interface CostSharing {
  copay?: number;
  coinsurance?: number;
  deductible?: number;
  description?: string;
}

export interface FormularyInfo {
  id: string;
  name: string;
  version: string;
  effectiveDate: Date;
  medications: FormularyMedication[];
}

export interface FormularyMedication {
  ndc: string;
  name: string;
  tier: number;
  priorAuthRequired: boolean;
  quantityLimits?: {
    maxQuantity: number;
    period: string;
  };
  stepTherapyRequired: boolean;
  alternatives?: string[];
}

export interface EligibilityRequest {
  memberId: string;
  patientId: string;
  patientName: string;
  dateOfBirth: Date;
  serviceDate: Date;
  providerId: string;
  serviceTypes?: string[];
  requestId?: string;
}

export interface EligibilityResponse {
  requestId: string;
  memberId: string;
  status: 'active' | 'inactive' | 'pending' | 'unknown';
  effectiveDate?: Date;
  terminationDate?: Date;
  plans: InsurancePlan[];
  eligibilityDetails: EligibilityDetail[];
  errors?: string[];
  responseDate: Date;
}

export interface EligibilityDetail {
  serviceType: string;
  covered: boolean;
  coverageLevel: string;
  benefitDescription: string;
  costSharing: CostSharing;
  limitations?: string[];
  messages?: string[];
}

export interface Claim {
  id: string;
  patientId: string;
  memberId: string;
  payorId: string;
  providerId: string;
  providerName: string;
  providerNPI: string;
  serviceDate: Date;
  submissionDate: Date;
  claimType: 'institutional' | 'professional' | 'dental' | 'pharmacy';
  status: ClaimStatus;
  totalCharges: number;
  allowedAmount?: number;
  paidAmount?: number;
  patientResponsibility?: number;
  lineItems: ClaimLineItem[];
  diagnosisCodes: DiagnosisCode[];
  priorAuthNumber?: string;
  referralNumber?: string;
  adjustmentReasons?: AdjustmentReason[];
  remittanceInfo?: RemittanceAdvice;
}

export enum ClaimStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PENDING = 'pending',
  PROCESSED = 'processed',
  PAID = 'paid',
  DENIED = 'denied',
  REJECTED = 'rejected',
  CORRECTED = 'corrected'
}

export interface ClaimLineItem {
  lineNumber: number;
  serviceDate: Date;
  procedureCode: string;
  modifiers?: string[];
  units: number;
  chargedAmount: number;
  allowedAmount?: number;
  paidAmount?: number;
  deductibleAmount?: number;
  coinsuranceAmount?: number;
  copayAmount?: number;
  placeOfService: string;
  renderingProviderId?: string;
}

export interface DiagnosisCode {
  code: string;
  codeSystem: 'ICD-10-CM' | 'ICD-9-CM';
  description: string;
  primary: boolean;
  admittingDiagnosis?: boolean;
}

export interface AdjustmentReason {
  code: string;
  description: string;
  amount: number;
}

export interface RemittanceAdvice {
  checkNumber?: string;
  checkDate?: Date;
  paymentMethod: 'check' | 'eft' | 'credit-card';
  totalPaid: number;
  adjustments: AdjustmentReason[];
}

export interface PriorAuthRequest {
  id: string;
  patientId: string;
  memberId: string;
  payorId: string;
  providerId: string;
  serviceType: string;
  procedureCodes: string[];
  diagnosisCodes: string[];
  requestedDate: Date;
  serviceFromDate: Date;
  serviceToDate: Date;
  urgency: 'routine' | 'urgent' | 'emergency';
  status: PriorAuthStatus;
  authorizationNumber?: string;
  approvedUnits?: number;
  validFromDate?: Date;
  validToDate?: Date;
  denialReason?: string;
  supportingDocuments?: string[];
}

export enum PriorAuthStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
  PARTIAL = 'partial',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export class InsuranceIntegrationService extends EventEmitter {
  private eligibilityCache: Map<string, EligibilityResponse> = new Map();
  private claims: Map<string, Claim> = new Map();
  private priorAuths: Map<string, PriorAuthRequest> = new Map();
  private cacheExpiryMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    super();
    this.initializeService();
  }

  /**
   * Initialize insurance integration service
   */
  private async initializeService(): Promise<void> {
    logger.info('Initializing insurance integration service');
    // TODO: Initialize connections to clearinghouses, establish secure channels
  }

  /**
   * Verify patient insurance eligibility
   */
  async verifyEligibility(request: EligibilityRequest): Promise<EligibilityResponse> {
    try {
      logger.debug(`Verifying eligibility for member ${request.memberId}`);

      // Check cache first
      const cacheKey = `${request.memberId}_${request.serviceDate.toISOString().split('T')[0]}`;
      const cached = this.eligibilityCache.get(cacheKey);
      
      if (cached && this.isCacheValid(cached.responseDate)) {
        logger.debug('Returning cached eligibility response');
        return cached;
      }

      // Generate request ID if not provided
      const requestId = request.requestId || this.generateRequestId();

      // TODO: Send real-time eligibility request to clearinghouse (270/271 transaction)
      
      // Mock response for now
      const response: EligibilityResponse = {
        requestId,
        memberId: request.memberId,
        status: 'active',
        effectiveDate: new Date(),
        plans: [{
          id: 'plan_123',
          name: 'Health Plus Gold',
          payorId: 'PAYOR_001',
          payorName: 'Blue Cross Blue Shield',
          planType: 'PPO',
          network: ['Primary Network'],
          effectiveDate: new Date(),
          coverageLevel: 'Individual',
          deductible: {
            individual: 1000,
            family: 2000,
            remaining: 500
          },
          outOfPocketMax: {
            individual: 5000,
            family: 10000,
            remaining: 3000
          },
          benefits: [
            {
              serviceCategory: 'medical',
              serviceType: 'office-visit',
              network: 'in-network',
              costSharing: {
                copay: 25,
                description: '$25 copay for primary care'
              },
              priorAuthRequired: false,
              referralRequired: false
            }
          ]
        }],
        eligibilityDetails: [
          {
            serviceType: 'medical',
            covered: true,
            coverageLevel: 'in-network',
            benefitDescription: 'Covered medical services',
            costSharing: {
              copay: 25,
              coinsurance: 20
            }
          }
        ],
        responseDate: new Date()
      };

      // Cache response
      this.eligibilityCache.set(cacheKey, response);

      this.emit('eligibilityVerified', response);
      logger.info(`Eligibility verified for member ${request.memberId}`);
      
      return response;
    } catch (error) {
      logger.error('Failed to verify eligibility:', error);
      throw new Error(`Eligibility verification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Submit insurance claim
   */
  async submitClaim(claimData: Partial<Claim>): Promise<Claim> {
    try {
      logger.debug('Submitting insurance claim');

      const claim: Claim = {
        id: this.generateClaimId(),
        patientId: claimData.patientId!,
        memberId: claimData.memberId!,
        payorId: claimData.payorId!,
        providerId: claimData.providerId!,
        providerName: claimData.providerName!,
        providerNPI: claimData.providerNPI!,
        serviceDate: claimData.serviceDate!,
        submissionDate: new Date(),
        claimType: claimData.claimType!,
        status: ClaimStatus.SUBMITTED,
        totalCharges: claimData.totalCharges!,
        lineItems: claimData.lineItems!,
        diagnosisCodes: claimData.diagnosisCodes!,
        ...claimData
      };

      // Validate claim
      await this.validateClaim(claim);

      // Store claim
      this.claims.set(claim.id, claim);

      // TODO: Submit to clearinghouse (837 transaction)
      
      this.emit('claimSubmitted', claim);
      logger.info(`Claim ${claim.id} submitted for patient ${claim.patientId}`);
      
      return claim;
    } catch (error) {
      logger.error('Failed to submit claim:', error);
      throw new Error(`Claim submission error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check claim status
   */
  async checkClaimStatus(claimId: string): Promise<Claim> {
    try {
      const claim = this.claims.get(claimId);
      if (!claim) {
        throw new Error('Claim not found');
      }

      logger.debug(`Checking status for claim ${claimId}`);

      // TODO: Query clearinghouse for real-time claim status (276/277 transaction)
      
      return claim;
    } catch (error) {
      logger.error('Failed to check claim status:', error);
      throw new Error(`Claim status check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process electronic remittance advice (ERA)
   */
  async processRemittanceAdvice(eraData: string): Promise<void> {
    try {
      logger.debug('Processing electronic remittance advice');

      // TODO: Parse 835 transaction and update claim statuses
      
      this.emit('remittanceProcessed', { eraData });
      logger.info('Electronic remittance advice processed');
    } catch (error) {
      logger.error('Failed to process remittance advice:', error);
      throw new Error(`ERA processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Submit prior authorization request
   */
  async submitPriorAuthRequest(requestData: Partial<PriorAuthRequest>): Promise<PriorAuthRequest> {
    try {
      logger.debug('Submitting prior authorization request');

      const request: PriorAuthRequest = {
        id: this.generatePriorAuthId(),
        patientId: requestData.patientId!,
        memberId: requestData.memberId!,
        payorId: requestData.payorId!,
        providerId: requestData.providerId!,
        serviceType: requestData.serviceType!,
        procedureCodes: requestData.procedureCodes!,
        diagnosisCodes: requestData.diagnosisCodes!,
        requestedDate: new Date(),
        serviceFromDate: requestData.serviceFromDate!,
        serviceToDate: requestData.serviceToDate!,
        urgency: requestData.urgency || 'routine',
        status: PriorAuthStatus.PENDING,
        ...requestData
      };

      // Store request
      this.priorAuths.set(request.id, request);

      // TODO: Submit to payor system or clearinghouse (278 transaction)
      
      this.emit('priorAuthSubmitted', request);
      logger.info(`Prior authorization request ${request.id} submitted`);
      
      return request;
    } catch (error) {
      logger.error('Failed to submit prior authorization request:', error);
      throw new Error(`Prior auth submission error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check prior authorization status
   */
  async checkPriorAuthStatus(requestId: string): Promise<PriorAuthRequest> {
    try {
      const request = this.priorAuths.get(requestId);
      if (!request) {
        throw new Error('Prior authorization request not found');
      }

      logger.debug(`Checking prior authorization status for ${requestId}`);

      // TODO: Query payor system for status updates
      
      return request;
    } catch (error) {
      logger.error('Failed to check prior authorization status:', error);
      throw new Error(`Prior auth status check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get formulary information for medication
   */
  async getFormularyInfo(payorId: string, medicationCode: string): Promise<FormularyMedication | null> {
    try {
      logger.debug(`Getting formulary info for medication ${medicationCode}`);

      // TODO: Query payor formulary database
      
      const formularyInfo: FormularyMedication = {
        ndc: medicationCode,
        name: 'Sample Medication',
        tier: 2,
        priorAuthRequired: false,
        stepTherapyRequired: false,
        quantityLimits: {
          maxQuantity: 30,
          period: '30 days'
        }
      };

      logger.info(`Formulary info retrieved for ${medicationCode}`);
      return formularyInfo;
    } catch (error) {
      logger.error('Failed to get formulary info:', error);
      throw new Error(`Formulary lookup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate patient cost estimate
   */
  async calculateCostEstimate(
    memberId: string,
    procedureCodes: string[],
    diagnosisCodes: string[],
    serviceDate: Date
  ): Promise<{
    totalEstimate: number;
    patientResponsibility: number;
    insuranceResponsibility: number;
    breakdown: any[];
  }> {
    try {
      logger.debug(`Calculating cost estimate for member ${memberId}`);

      // Get eligibility info
      const eligibility = await this.verifyEligibility({
        memberId,
        patientId: '',
        patientName: '',
        dateOfBirth: new Date(),
        serviceDate,
        providerId: ''
      });

      // TODO: Calculate estimates based on benefits and contracted rates
      
      const estimate = {
        totalEstimate: 500.00,
        patientResponsibility: 125.00,
        insuranceResponsibility: 375.00,
        breakdown: [
          {
            procedureCode: procedureCodes[0],
            description: 'Office Visit',
            chargedAmount: 200.00,
            allowedAmount: 150.00,
            patientCopay: 25.00,
            insurancePaid: 125.00
          }
        ]
      };

      logger.info(`Cost estimate calculated for member ${memberId}`);
      return estimate;
    } catch (error) {
      logger.error('Failed to calculate cost estimate:', error);
      throw new Error(`Cost estimation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate claim before submission
   */
  private async validateClaim(claim: Claim): Promise<void> {
    const errors: string[] = [];

    // Basic validation
    if (!claim.patientId) errors.push('Patient ID is required');
    if (!claim.memberId) errors.push('Member ID is required');
    if (!claim.providerId) errors.push('Provider ID is required');
    if (!claim.lineItems?.length) errors.push('At least one line item is required');
    if (!claim.diagnosisCodes?.length) errors.push('At least one diagnosis code is required');

    // Line item validation
    claim.lineItems?.forEach((item, index) => {
      if (!item.procedureCode) {
        errors.push(`Line item ${index + 1}: Procedure code is required`);
      }
      if (!item.chargedAmount || item.chargedAmount <= 0) {
        errors.push(`Line item ${index + 1}: Valid charged amount is required`);
      }
    });

    if (errors.length > 0) {
      throw new Error(`Claim validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Check if cached response is still valid
   */
  private isCacheValid(responseDate: Date): boolean {
    return (Date.now() - responseDate.getTime()) < this.cacheExpiryMs;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `req_${timestamp}${random}`;
  }

  /**
   * Generate unique claim ID
   */
  private generateClaimId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `clm_${timestamp}${random}`;
  }

  /**
   * Generate unique prior authorization ID
   */
  private generatePriorAuthId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `pa_${timestamp}${random}`;
  }

  /**
   * Get service health status
   */
  getHealthStatus(): { status: string; details: any } {
    return {
      status: 'UP',
      details: {
        cachedEligibilityResponses: this.eligibilityCache.size,
        claimsCount: this.claims.size,
        priorAuthsCount: this.priorAuths.size,
        cacheExpiryHours: this.cacheExpiryMs / (60 * 60 * 1000)
      }
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, response] of this.eligibilityCache.entries()) {
      if (!this.isCacheValid(response.responseDate)) {
        this.eligibilityCache.delete(key);
      }
    }
    logger.debug('Expired cache entries cleared');
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.removeAllListeners();
    this.eligibilityCache.clear();
    this.claims.clear();
    this.priorAuths.clear();
    logger.info('Insurance integration service shut down');
  }
}

// Export singleton instance
export const insuranceIntegrationService = new InsuranceIntegrationService();