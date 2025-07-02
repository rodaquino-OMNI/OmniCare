/**
 * Clinical Decision Support (CDS) Service
 * Provides clinical decision support alerts and recommendations
 */

export interface CDSAlert {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  category: 'drug-interaction' | 'allergy' | 'duplicate-therapy' | 'dosing' | 'contraindication';
  actionable: boolean;
  recommendations?: string[];
}

export interface CDSHookContext {
  patientId: string;
  encounterId?: string;
  medications?: any[];
  allergies?: any[];
  conditions?: any[];
  orders?: any[];
}

export interface CDSResponse {
  alerts: CDSAlert[];
  recommendations: string[];
  score?: number;
}

export class CDSService {
  private hooks: Map<string, Function> = new Map();

  constructor() {
    this.initializeHooks();
  }

  private initializeHooks() {
    // Register default CDS hooks
    this.hooks.set('medication-prescribe', this.medicationPrescribeHook.bind(this));
    this.hooks.set('patient-view', this.patientViewHook.bind(this));
    this.hooks.set('order-review', this.orderReviewHook.bind(this));
  }

  async processHook(hookName: string, context: CDSHookContext): Promise<CDSResponse> {
    const hook = this.hooks.get(hookName);
    
    if (!hook) {
      return {
        alerts: [],
        recommendations: []
      };
    }

    return await hook(context);
  }

  private async medicationPrescribeHook(context: CDSHookContext): Promise<CDSResponse> {
    const alerts: CDSAlert[] = [];
    const recommendations: string[] = [];

    // Check for drug interactions
    if (context.medications && context.medications.length > 1) {
      alerts.push({
        id: 'drug-interaction-check',
        title: 'Potential Drug Interaction',
        message: 'Review potential interactions between prescribed medications',
        severity: 'warning',
        category: 'drug-interaction',
        actionable: true,
        recommendations: [
          'Review medication interaction database',
          'Consider alternative medications',
          'Monitor patient for adverse effects'
        ]
      });
    }

    // Check for allergies
    if (context.allergies && context.allergies.length > 0) {
      alerts.push({
        id: 'allergy-check',
        title: 'Allergy Alert',
        message: 'Patient has documented allergies - verify medication compatibility',
        severity: 'critical',
        category: 'allergy',
        actionable: true,
        recommendations: [
          'Cross-reference medication with allergy list',
          'Consider alternative if contraindicated'
        ]
      });
    }

    // General recommendations
    recommendations.push('Verify correct dosing for patient age and weight');
    recommendations.push('Review medication adherence history');

    return { alerts, recommendations };
  }

  private async patientViewHook(context: CDSHookContext): Promise<CDSResponse> {
    const alerts: CDSAlert[] = [];
    const recommendations: string[] = [];

    // Check for overdue screenings based on conditions
    if (context.conditions) {
      recommendations.push('Review preventive care recommendations');
      recommendations.push('Check for overdue screenings and vaccinations');
    }

    return { alerts, recommendations };
  }

  private async orderReviewHook(context: CDSHookContext): Promise<CDSResponse> {
    const alerts: CDSAlert[] = [];
    const recommendations: string[] = [];

    // Check for duplicate orders
    if (context.orders && context.orders.length > 0) {
      alerts.push({
        id: 'duplicate-order-check',
        title: 'Duplicate Order Check',
        message: 'Review for potential duplicate orders',
        severity: 'info',
        category: 'duplicate-therapy',
        actionable: true,
        recommendations: [
          'Verify order is not duplicating existing orders',
          'Check for similar orders in different categories'
        ]
      });
    }

    return { alerts, recommendations };
  }

  registerHook(name: string, handler: Function): void {
    this.hooks.set(name, handler);
  }

  getAvailableHooks(): string[] {
    return Array.from(this.hooks.keys());
  }

  async getPatientRiskScore(patientId: string): Promise<number> {
    // Simplified risk scoring - in real implementation would use clinical algorithms
    const baseScore = Math.random() * 10;
    return Math.round(baseScore);
  }

  async getQualityMeasures(patientId: string): Promise<any[]> {
    // Return quality measures for the patient
    return [
      {
        measure: 'Diabetes HbA1c Control',
        status: 'compliant',
        lastValue: '6.8%',
        target: '<7.ResourceHistoryTable%'
      },
      {
        measure: 'Blood Pressure Control',
        status: 'non-compliant',
        lastValue: '145/9',
        target: '<13/8'
      }
    ];
  }
}