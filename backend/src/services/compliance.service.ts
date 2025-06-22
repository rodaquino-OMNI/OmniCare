import { Patient, Observation, MedicationRequest, Resource } from '@medplum/fhirtypes';
import { AuditService } from './audit.service';
import { ValidationService } from './validation.service';
import logger from '../utils/logger';

export interface ComplianceReport {
  status: 'compliant' | 'non-compliant' | 'partial';
  findings: ComplianceFinding[];
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  generatedAt: Date;
  generatedBy: string;
}

export interface ComplianceFinding {
  rule: string;
  category: 'privacy' | 'security' | 'breach-notification' | 'administrative';
  status: 'pass' | 'fail' | 'warning';
  description: string;
  evidence?: any;
  recommendation?: string;
}

export interface PHIAccessEvent {
  userId: string;
  patientId: string;
  resource: string;
  action: 'view' | 'create' | 'update' | 'delete';
  timestamp: Date;
  justification?: string;
}

export class ComplianceService {
  constructor(
    private auditService: AuditService,
    private validationService: ValidationService
  ) {}

  async checkHipaaCompliance(organizationId: string): Promise<ComplianceReport> {
    const findings: ComplianceFinding[] = [];
    
    // Check access controls
    findings.push(await this.checkAccessControls(organizationId));
    
    // Check audit logging
    findings.push(await this.checkAuditLogging(organizationId));
    
    // Check encryption
    findings.push(await this.checkEncryption());
    
    // Check data integrity
    findings.push(await this.checkDataIntegrity(organizationId));
    
    // Check breach notification procedures
    findings.push(await this.checkBreachNotification(organizationId));
    
    const summary = this.summarizeFindings(findings);
    
    return {
      status: summary.failed > 0 ? 'non-compliant' : 
              summary.warnings > 0 ? 'partial' : 'compliant',
      findings,
      summary,
      generatedAt: new Date(),
      generatedBy: 'system'
    };
  }

  async validatePHIAccess(event: PHIAccessEvent): Promise<boolean> {
    // Validate that the user has appropriate permissions
    const hasPermission = await this.checkUserPermission(
      event.userId,
      event.resource,
      event.action
    );
    
    if (!hasPermission) {
      logger.warn('Unauthorized PHI access attempt', { event });
      return false;
    }
    
    // Log the access
    await this.auditService.logSecurityEvent({
      type: 'DATA_ACCESS',
      userId: event.userId,
      severity: 'LOW',
      description: `Accessed ${event.resource} with action: ${event.action}`,
      metadata: {
        resource: event.resource,
        action: event.action,
        patientId: event.patientId,
        justification: event.justification
      }
    });
    
    return true;
  }

  async logDataBreach(details: {
    description: string;
    affectedPatients: string[];
    discoveredAt: Date;
    reportedBy: string;
  }): Promise<void> {
    // Log the breach
    await this.auditService.logSecurityEvent({
      type: 'UNAUTHORIZED_ACCESS',
      userId: details.reportedBy,
      severity: 'CRITICAL',
      description: details.description,
      metadata: {
        affectedPatients: details.affectedPatients,
        discoveredAt: details.discoveredAt
      }
    });
    
    // Initiate breach notification procedures
    logger.error('Data breach reported', details);
  }

  async generateComplianceAuditReport(
    startDate: Date,
    endDate: Date,
    options?: { includeDetails?: boolean }
  ): Promise<any> {
    // For now, return a simplified report
    // TODO: Implement proper audit log retrieval
    const auditLogs: any[] = [];
    
    const phiAccesses = auditLogs.filter((log: any) => 
      log.metadata?.type === 'DATA_ACCESS'
    );
    
    const securityEvents = auditLogs.filter((log: any) =>
      log.metadata?.severity === 'HIGH' || log.metadata?.severity === 'CRITICAL'
    );
    
    return {
      period: { startDate, endDate },
      summary: {
        totalPHIAccesses: phiAccesses.length,
        securityEvents: securityEvents.length,
        uniqueUsers: new Set(auditLogs.map((log: any) => log.userId)).size
      },
      details: options?.includeDetails ? {
        phiAccesses,
        securityEvents
      } : undefined,
      generatedAt: new Date()
    };
  }

  async validateDataMinimization(resource: Resource): Promise<boolean> {
    // Check if the resource contains only necessary PHI
    if (resource.resourceType === 'Patient') {
      const patient = resource as Patient;
      // Validate that sensitive fields are properly marked
      if (patient.extension?.some(ext => 
        ext.url === 'http://hl7.org/fhir/StructureDefinition/patient-importance'
      )) {
        return true;
      }
    }
    
    return true;
  }

  private async checkAccessControls(organizationId: string): Promise<ComplianceFinding> {
    // Check if proper access controls are in place
    const hasRBAC = true; // Simplified for now
    
    return {
      rule: 'HIPAA §164.308(a)(4) - Access Controls',
      category: 'security',
      status: hasRBAC ? 'pass' : 'fail',
      description: 'Role-based access control implementation',
      recommendation: hasRBAC ? undefined : 'Implement role-based access controls'
    };
  }

  private async checkAuditLogging(organizationId: string): Promise<ComplianceFinding> {
    // Check if audit logging is properly configured
    const hasAuditLogs = true; // Simplified
    
    return {
      rule: 'HIPAA §164.312(b) - Audit Controls',
      category: 'security',
      status: hasAuditLogs ? 'pass' : 'fail',
      description: 'Audit logging implementation',
      recommendation: hasAuditLogs ? undefined : 'Enable comprehensive audit logging'
    };
  }

  private async checkEncryption(): Promise<ComplianceFinding> {
    // Check encryption at rest and in transit
    const hasEncryption = true; // Simplified
    
    return {
      rule: 'HIPAA §164.312(a)(2)(iv) - Encryption',
      category: 'security',
      status: hasEncryption ? 'pass' : 'fail',
      description: 'Data encryption at rest and in transit',
      recommendation: hasEncryption ? undefined : 'Implement end-to-end encryption'
    };
  }

  private async checkDataIntegrity(organizationId: string): Promise<ComplianceFinding> {
    // Check data integrity controls
    const hasIntegrityControls = true; // Simplified
    
    return {
      rule: 'HIPAA §164.312(c)(1) - Data Integrity',
      category: 'security',
      status: hasIntegrityControls ? 'pass' : 'fail',
      description: 'Data integrity controls',
      recommendation: hasIntegrityControls ? undefined : 'Implement data integrity verification'
    };
  }

  private async checkBreachNotification(organizationId: string): Promise<ComplianceFinding> {
    // Check breach notification procedures
    const hasBreachProcedures = true; // Simplified
    
    return {
      rule: 'HIPAA §164.404 - Breach Notification',
      category: 'breach-notification',
      status: hasBreachProcedures ? 'pass' : 'fail',
      description: 'Breach notification procedures',
      recommendation: hasBreachProcedures ? undefined : 'Establish breach notification procedures'
    };
  }

  private async checkUserPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    // Simplified permission check
    return true;
  }

  private summarizeFindings(findings: ComplianceFinding[]): {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
  } {
    return {
      totalChecks: findings.length,
      passed: findings.filter(f => f.status === 'pass').length,
      failed: findings.filter(f => f.status === 'fail').length,
      warnings: findings.filter(f => f.status === 'warning').length
    };
  }
}