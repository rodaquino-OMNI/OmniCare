/**
 * OmniCare Quality Measures Service
 * 
 * Implementation of clinical quality measures tracking and reporting
 * Supports HEDIS, CMS, and custom quality measures
 */

import {
  Patient,
  QualityMeasure,
  PopulationCriteria,
  MeasureCriteria,
  ClinicalCriteria,
  MedicalCondition,
  Medication,
  LabResult
} from '../types/CDSTypes';

// Quality measure result
interface QualityMeasureResult {
  measureId: string;
  measureName: string;
  eligible: boolean;
  compliant: boolean;
  numeratorMet: boolean;
  denominatorMet: boolean;
  exclusions: string[];
  gapDescription?: string;
  dueDate?: Date;
  recommendations: string[];
}

// Quality measure performance data
interface QualityPerformance {
  measureId: string;
  measureName: string;
  totalEligible: number;
  totalCompliant: number;
  complianceRate: number;
  benchmark?: number;
  trend: 'Improving' | 'Stable' | 'Declining';
  gaps: Array<{
    patientId: string;
    gapDescription: string;
    dueDate?: Date;
  }>;
}

export class QualityMeasuresService {
  private qualityMeasures: Map<string, QualityMeasure> = new Map();

  constructor() {
    this.initializeQualityMeasures();
  }

  /**
   * Evaluate quality measures for a patient
   */
  async evaluatePatientQualityMeasures(patient: Patient): Promise<QualityMeasureResult[]> {
    const results: QualityMeasureResult[] = [];

    for (const measure of this.qualityMeasures.values()) {
      const result = await this.evaluateMeasure(measure, patient);
      results.push(result);
    }

    return results.filter(r => r.eligible);
  }

  /**
   * Get quality measure gaps for a patient
   */
  async getQualityGaps(patient: Patient): Promise<QualityMeasureResult[]> {
    const results = await this.evaluatePatientQualityMeasures(patient);
    return results.filter(r => r.eligible && !r.compliant);
  }

  /**
   * Evaluate population performance for quality measures
   */
  async evaluatePopulationPerformance(
    patientIds: string[],
    measureIds?: string[]
  ): Promise<QualityPerformance[]> {
    const targetMeasures = measureIds 
      ? Array.from(this.qualityMeasures.values()).filter(m => measureIds.includes(m.measureId))
      : Array.from(this.qualityMeasures.values());

    const performanceResults: QualityPerformance[] = [];

    for (const measure of targetMeasures) {
      const performance: QualityPerformance = {
        measureId: measure.measureId,
        measureName: measure.title,
        totalEligible: 0,
        totalCompliant: 0,
        complianceRate: 0,
        trend: 'Stable',
        gaps: []
      };

      // Evaluate each patient
      for (const patientId of patientIds) {
        try {
          const patient = await this.getPatientData(patientId);
          const result = await this.evaluateMeasure(measure, patient);

          if (result.eligible) {
            performance.totalEligible++;
            
            if (result.compliant) {
              performance.totalCompliant++;
            } else {
              performance.gaps.push({
                patientId,
                gapDescription: result.gapDescription || 'Quality measure not met',
                dueDate: result.dueDate || new Date()
              });
            }
          }
        } catch (error) {
          console.error(`Error evaluating patient ${patientId} for measure ${measure.measureId}:`, error);
        }
      }

      performance.complianceRate = performance.totalEligible > 0 
        ? (performance.totalCompliant / performance.totalEligible) * 100 
        : 0;

      performanceResults.push(performance);
    }

    return performanceResults;
  }

  /**
   * Get HEDIS measures
   */
  getHEDISMeasures(): QualityMeasure[] {
    return Array.from(this.qualityMeasures.values())
      .filter(m => m.measureId.startsWith('HEDIS'));
  }

  /**
   * Get CMS measures
   */
  getCMSMeasures(): QualityMeasure[] {
    return Array.from(this.qualityMeasures.values())
      .filter(m => m.measureId.startsWith('CMS'));
  }

  /**
   * Evaluate a specific quality measure for a patient
   */
  private async evaluateMeasure(
    measure: QualityMeasure,
    patient: Patient
  ): Promise<QualityMeasureResult> {
    const result: QualityMeasureResult = {
      measureId: measure.measureId,
      measureName: measure.title,
      eligible: false,
      compliant: false,
      numeratorMet: false,
      denominatorMet: false,
      exclusions: [],
      recommendations: []
    };

    // Check denominator (population criteria)
    result.denominatorMet = this.evaluateCriteria(measure.denominator.criteria, patient);
    
    if (!result.denominatorMet) {
      return result;
    }

    // Check exclusions
    if (measure.exclusions) {
      const excluded = this.evaluateCriteria(measure.exclusions.criteria, patient);
      if (excluded) {
        result.exclusions.push(measure.exclusions.description);
        return result;
      }
    }

    // Patient is eligible
    result.eligible = true;

    // Check numerator (performance criteria)
    result.numeratorMet = this.evaluateCriteria(measure.numerator.criteria, patient);
    result.compliant = result.numeratorMet;

    // Generate gap description and recommendations if not compliant
    if (!result.compliant) {
      result.gapDescription = this.generateGapDescription(measure, patient);
      result.recommendations = this.generateRecommendations(measure, patient);
      result.dueDate = this.calculateDueDate(measure, patient);
    }

    return result;
  }

  /**
   * Evaluate clinical criteria against patient data
   */
  private evaluateCriteria(criteria: ClinicalCriteria[], patient: Patient): boolean {
    return criteria.every(criterion => this.evaluateSingleCriterion(criterion, patient));
  }

  /**
   * Evaluate a single clinical criterion
   */
  private evaluateSingleCriterion(criterion: ClinicalCriteria, patient: Patient): boolean {
    switch (criterion.type) {
      case 'Age':
        return this.evaluateAge(criterion, patient.demographics.age);
      
      case 'Gender':
        return criterion.value === patient.demographics.gender;
      
      case 'Condition':
        return this.hasCondition(patient, criterion.codes || []);
      
      case 'Medication':
        return this.hasMedication(patient, criterion.codes || []);
      
      case 'Lab':
        return this.hasLabResult(patient, criterion);
      
      case 'Procedure':
        return this.hasProcedure(patient, criterion.codes || []);
      
      default:
        return false;
    }
  }

  /**
   * Initialize quality measures
   */
  private initializeQualityMeasures(): void {
    // HEDIS Diabetes HbA1c Control
    this.qualityMeasures.set('HEDIS-CDC-HbA1c', {
      measureId: 'HEDIS-CDC-HbA1c',
      title: 'Diabetes HbA1c Control (<8%)',
      description: 'Percentage of patients with diabetes whose HbA1c is <8%',
      category: 'Process',
      population: {
        description: 'Patients with diabetes aged 18-75',
        criteria: [
          { type: 'Age', operator: '>=', value: 18 },
          { type: 'Age', operator: '<=', value: 75 },
          { type: 'Condition', codes: ['E11.9'], codeSystem: 'ICD-10' }
        ]
      },
      numerator: {
        description: 'HbA1c <8% in measurement period',
        criteria: [
          { type: 'Lab', operator: '<', value: 8, codes: ['HbA1c'] }
        ]
      },
      denominator: {
        description: 'Patients with diabetes aged 18-75',
        criteria: [
          { type: 'Age', operator: '>=', value: 18 },
          { type: 'Age', operator: '<=', value: 75 },
          { type: 'Condition', codes: ['E11.9'], codeSystem: 'ICD-10' }
        ]
      },
      reportingPeriod: {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31')
      }
    });

    // HEDIS Breast Cancer Screening
    this.qualityMeasures.set('HEDIS-BCS', {
      measureId: 'HEDIS-BCS',
      title: 'Breast Cancer Screening',
      description: 'Percentage of women aged 50-74 who had mammography in past 2 years',
      category: 'Process',
      population: {
        description: 'Women aged 50-74',
        criteria: [
          { type: 'Age', operator: '>=', value: 50 },
          { type: 'Age', operator: '<=', value: 74 },
          { type: 'Gender', value: 'F' }
        ]
      },
      numerator: {
        description: 'Mammography in past 2 years',
        criteria: [
          { type: 'Procedure', codes: ['77057', '77052'], codeSystem: 'CPT' }
        ]
      },
      denominator: {
        description: 'Women aged 50-74',
        criteria: [
          { type: 'Age', operator: '>=', value: 50 },
          { type: 'Age', operator: '<=', value: 74 },
          { type: 'Gender', value: 'F' }
        ]
      },
      reportingPeriod: {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31')
      }
    });

    // CMS Hypertension Control
    this.qualityMeasures.set('CMS-165', {
      measureId: 'CMS-165',
      title: 'Controlling High Blood Pressure',
      description: 'Percentage of patients with hypertension whose BP is <140/90',
      category: 'Outcome',
      population: {
        description: 'Patients aged 18-85 with hypertension',
        criteria: [
          { type: 'Age', operator: '>=', value: 18 },
          { type: 'Age', operator: '<=', value: 85 },
          { type: 'Condition', codes: ['I10'], codeSystem: 'ICD-10' }
        ]
      },
      numerator: {
        description: 'Blood pressure <140/90 mmHg',
        criteria: [
          { type: 'Vital', operator: '<', value: 140, codes: ['systolic'] },
          { type: 'Vital', operator: '<', value: 90, codes: ['diastolic'] }
        ]
      },
      denominator: {
        description: 'Patients aged 18-85 with hypertension',
        criteria: [
          { type: 'Age', operator: '>=', value: 18 },
          { type: 'Age', operator: '<=', value: 85 },
          { type: 'Condition', codes: ['I10'], codeSystem: 'ICD-10' }
        ]
      },
      reportingPeriod: {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31')
      }
    });
  }

  // Helper methods
  private evaluateAge(criterion: ClinicalCriteria, age: number): boolean {
    if (!criterion.operator || criterion.value === undefined) return false;
    
    switch (criterion.operator) {
      case '>': return age > criterion.value;
      case '<': return age < criterion.value;
      case '>=': return age >= criterion.value;
      case '<=': return age <= criterion.value;
      case '=': return age === criterion.value;
      case '!=': return age !== criterion.value;
      default: return false;
    }
  }

  private hasCondition(patient: Patient, codes: string[]): boolean {
    return patient.medicalHistory.some(condition =>
      condition.status === 'Active' &&
      codes.some(code => condition.icd10Code.startsWith(code))
    );
  }

  private hasMedication(patient: Patient, codes: string[]): boolean {
    return patient.currentMedications.some(med =>
      med.status === 'Active' &&
      codes.some(code => med.name.toLowerCase().includes(code.toLowerCase()))
    );
  }

  private hasLabResult(patient: Patient, criterion: ClinicalCriteria): boolean {
    if (!patient.labResults || !criterion.codes || !criterion.operator) return false;
    
    const labs = patient.labResults.filter(lab =>
      criterion.codes!.some(code => lab.testName.toLowerCase().includes(code.toLowerCase())) &&
      lab.status === 'Final'
    );

    return labs.some(lab => {
      if (typeof lab.value !== 'number') return false;
      
      switch (criterion.operator) {
        case '>': return lab.value > criterion.value;
        case '<': return lab.value < criterion.value;
        case '>=': return lab.value >= criterion.value;
        case '<=': return lab.value <= criterion.value;
        case '=': return lab.value === criterion.value;
        case '!=': return lab.value !== criterion.value;
        default: return false;
      }
    });
  }

  private hasProcedure(patient: Patient, codes: string[]): boolean {
    // This would check procedure history - mock implementation
    return Math.random() > 0.5;
  }

  private generateGapDescription(measure: QualityMeasure, patient: Patient): string {
    switch (measure.measureId) {
      case 'HEDIS-CDC-HbA1c':
        return 'Recent HbA1c result ≥8% or missing';
      case 'HEDIS-BCS':
        return 'Mammography screening overdue or missing';
      case 'CMS-165':
        return 'Blood pressure not controlled or recent reading missing';
      default:
        return `${measure.title} requirements not met`;
    }
  }

  private generateRecommendations(measure: QualityMeasure, patient: Patient): string[] {
    switch (measure.measureId) {
      case 'HEDIS-CDC-HbA1c':
        return [
          'Order HbA1c test',
          'Review diabetes management plan',
          'Consider medication adjustment if HbA1c ≥8%'
        ];
      case 'HEDIS-BCS':
        return [
          'Schedule mammography',
          'Patient education on breast cancer screening',
          'Address barriers to screening'
        ];
      case 'CMS-165':
        return [
          'Measure blood pressure',
          'Review antihypertensive medications',
          'Lifestyle counseling for hypertension management'
        ];
      default:
        return ['Review quality measure requirements'];
    }
  }

  private calculateDueDate(measure: QualityMeasure, patient: Patient): Date {
    const now = new Date();
    // Default to end of reporting period or 90 days, whichever is sooner
    const endOfPeriod = measure.reportingPeriod.end;
    const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    
    return endOfPeriod < ninetyDaysOut ? endOfPeriod : ninetyDaysOut;
  }

  private async getPatientData(patientId: string): Promise<Patient> {
    // Mock patient data - would integrate with patient service
    return {
      patientId,
      demographics: { age: 55, gender: 'F' as const, weight: 65, height: 160, bmi: 25.4 },
      allergies: [],
      currentMedications: [],
      medicalHistory: [],
      labResults: [],
      preferences: {
        languagePreference: 'en',
        communicationPreferences: ['email']
      }
    };
  }
}