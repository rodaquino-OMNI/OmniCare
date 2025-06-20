/**
 * OmniCare Evidence-Based Recommendation Service
 * 
 * Provides evidence-based clinical recommendations using latest research
 */

import {
  Patient,
  EvidenceRecommendation,
  ClinicalContext,
  Evidence,
  ImplementationGuidance,
  ApplicabilityCriteria,
  Medication,
  MedicalCondition
} from '../types/CDSTypes';

export class EvidenceRecommendationService {
  private evidenceDatabase: Map<string, EvidenceRecommendation[]> = new Map();

  constructor() {
    this.initializeEvidenceBase();
  }

  /**
   * Get evidence-based recommendations for a patient condition
   */
  async getRecommendationsForCondition(
    condition: MedicalCondition,
    patient: Patient
  ): Promise<EvidenceRecommendation[]> {
    const recommendations = this.evidenceDatabase.get(condition.icd10Code) || [];
    
    return recommendations.filter(rec => 
      this.isRecommendationApplicable(rec, patient)
    );
  }

  /**
   * Get medication-specific evidence recommendations
   */
  async getMedicationEvidence(
    medication: Medication,
    indication: string,
    patient: Patient
  ): Promise<EvidenceRecommendation[]> {
    const recommendations: EvidenceRecommendation[] = [];
    
    // Search for evidence related to medication and indication
    for (const [condition, recs] of this.evidenceDatabase) {
      const relevantRecs = recs.filter(rec => 
        rec.context.intervention.toLowerCase().includes(medication.name.toLowerCase()) ||
        rec.context.intervention.toLowerCase().includes(indication.toLowerCase())
      );
      
      recommendations.push(...relevantRecs.filter(rec => 
        this.isRecommendationApplicable(rec, patient)
      ));
    }
    
    return recommendations;
  }

  /**
   * Get comparative effectiveness research
   */
  async getComparativeEffectiveness(
    intervention1: string,
    intervention2: string,
    condition: string
  ): Promise<EvidenceRecommendation[]> {
    const recommendations: EvidenceRecommendation[] = [];
    
    for (const recs of this.evidenceDatabase.values()) {
      const comparativeRecs = recs.filter(rec => 
        rec.context.comparison &&
        (rec.context.intervention.toLowerCase().includes(intervention1.toLowerCase()) ||
         rec.context.intervention.toLowerCase().includes(intervention2.toLowerCase())) &&
        rec.context.comparison.toLowerCase().includes('vs')
      );
      
      recommendations.push(...comparativeRecs);
    }
    
    return recommendations;
  }

  /**
   * Get latest evidence updates
   */
  async getLatestEvidenceUpdates(
    daysBack: number = 30
  ): Promise<EvidenceRecommendation[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    const recentRecommendations: EvidenceRecommendation[] = [];
    
    for (const recs of this.evidenceDatabase.values()) {
      const recent = recs.filter(rec => 
        rec.evidence.some(ev => new Date(ev.reference.split('.')[0]) > cutoffDate)
      );
      recentRecommendations.push(...recent);
    }
    
    return recentRecommendations.sort((a, b) => 
      this.getLatestEvidenceDate(b) - this.getLatestEvidenceDate(a)
    );
  }

  /**
   * Search evidence by clinical question
   */
  async searchEvidence(query: string): Promise<EvidenceRecommendation[]> {
    const results: EvidenceRecommendation[] = [];
    const queryLower = query.toLowerCase();
    
    for (const recs of this.evidenceDatabase.values()) {
      const matching = recs.filter(rec => 
        rec.title.toLowerCase().includes(queryLower) ||
        rec.recommendation.toLowerCase().includes(queryLower) ||
        rec.context.population.toLowerCase().includes(queryLower) ||
        rec.context.intervention.toLowerCase().includes(queryLower) ||
        rec.context.outcome.toLowerCase().includes(queryLower)
      );
      
      results.push(...matching);
    }
    
    return results;
  }

  private initializeEvidenceBase(): void {
    // Type 2 Diabetes Evidence
    const diabetesEvidence: EvidenceRecommendation[] = [
      {
        recommendationId: 'dm-metformin-first-line',
        title: 'Metformin as First-Line Therapy for Type 2 Diabetes',
        context: {
          population: 'Adults with type 2 diabetes',
          intervention: 'Metformin',
          comparison: 'Other antidiabetic medications',
          outcome: 'Glycemic control and cardiovascular outcomes',
          setting: 'Primary care and endocrinology'
        },
        evidence: [
          {
            studyType: 'RCT',
            population: 'Adults with newly diagnosed T2DM',
            sampleSize: 4075,
            findings: 'Metformin reduced cardiovascular events by 39% compared to conventional treatment',
            reference: 'UKPDS 34. Lancet. 1998;352(9131):854-865.',
            evidenceLevel: 'I'
          }
        ],
        recommendation: 'Metformin should be the first-line pharmacological therapy for type 2 diabetes',
        strength: 'Strong for',
        qualityOfEvidence: 'High',
        applicability: {
          ageRange: { min: 18 },
          conditions: ['E11.9'],
          labValues: [
            { testName: 'HbA1c', operator: '>=', value: 7, unit: '%' }
          ]
        },
        implementation: {
          barriers: ['GI intolerance', 'Kidney disease', 'Patient preference'],
          facilitators: ['Low cost', 'Proven cardiovascular benefit', 'Weight neutral'],
          resources: ['Patient education materials', 'Dosing guidelines'],
          monitoring: ['Kidney function', 'B12 levels', 'GI symptoms'],
          evaluation: ['HbA1c every 3 months', 'Annual comprehensive metabolic panel']
        }
      }
    ];

    // Hypertension Evidence
    const hypertensionEvidence: EvidenceRecommendation[] = [
      {
        recommendationId: 'htn-ace-first-line',
        title: 'ACE Inhibitors as First-Line for Hypertension with Diabetes',
        context: {
          population: 'Adults with hypertension and diabetes',
          intervention: 'ACE inhibitors',
          comparison: 'Other antihypertensive classes',
          outcome: 'Cardiovascular events and nephroprotection',
          setting: 'Primary care'
        },
        evidence: [
          {
            studyType: 'RCT',
            population: 'Patients with diabetes and hypertension',
            sampleSize: 9297,
            findings: 'ACE inhibitors reduced cardiovascular events by 25% vs placebo',
            reference: 'HOPE Study. NEJM. 2000;342(3):145-153.',
            evidenceLevel: 'I'
          }
        ],
        recommendation: 'ACE inhibitors are preferred first-line therapy for hypertension in patients with diabetes',
        strength: 'Strong for',
        qualityOfEvidence: 'High',
        applicability: {
          conditions: ['I10', 'E11.9']
        },
        implementation: {
          barriers: ['Cough', 'Hyperkalemia', 'Angioedema'],
          facilitators: ['Proven cardiovascular benefit', 'Nephroprotection'],
          resources: ['Blood pressure monitoring', 'Lab monitoring protocols'],
          monitoring: ['Blood pressure', 'Kidney function', 'Potassium'],
          evaluation: ['BP control assessment', 'Annual kidney function']
        }
      }
    ];

    // Anticoagulation Evidence
    const anticoagulationEvidence: EvidenceRecommendation[] = [
      {
        recommendationId: 'afib-doac-preferred',
        title: 'Direct Oral Anticoagulants for Atrial Fibrillation',
        context: {
          population: 'Adults with non-valvular atrial fibrillation',
          intervention: 'Direct oral anticoagulants (DOACs)',
          comparison: 'Warfarin',
          outcome: 'Stroke prevention and bleeding risk',
          setting: 'Cardiology and primary care'
        },
        evidence: [
          {
            studyType: 'RCT',
            population: 'Patients with non-valvular atrial fibrillation',
            sampleSize: 18113,
            findings: 'DOACs reduced stroke by 19% and intracranial bleeding by 52% vs warfarin',
            reference: 'RE-LY Trial. NEJM. 2009;361(12):1139-1151.',
            evidenceLevel: 'I'
          }
        ],
        recommendation: 'DOACs are preferred over warfarin for stroke prevention in non-valvular atrial fibrillation',
        strength: 'Strong for',
        qualityOfEvidence: 'High',
        applicability: {
          conditions: ['I48'],
          labValues: [
            { testName: 'creatinine', operator: '<', value: 2.5, unit: 'mg/dL' }
          ]
        },
        implementation: {
          barriers: ['Cost', 'No reversal agent for some DOACs', 'Dosing complexity'],
          facilitators: ['No routine monitoring', 'Lower bleeding risk', 'Better efficacy'],
          resources: ['Dosing calculators', 'Patient education'],
          monitoring: ['Kidney function', 'Bleeding signs'],
          evaluation: ['Annual assessment of bleeding/stroke risk']
        }
      }
    ];

    // Store evidence in database
    this.evidenceDatabase.set('E11.9', diabetesEvidence);
    this.evidenceDatabase.set('I10', hypertensionEvidence);
    this.evidenceDatabase.set('I48', anticoagulationEvidence);
  }

  private isRecommendationApplicable(
    recommendation: EvidenceRecommendation,
    patient: Patient
  ): boolean {
    const criteria = recommendation.applicability;
    
    // Check age range
    if (criteria.ageRange) {
      if (criteria.ageRange.min && patient.demographics.age < criteria.ageRange.min) {
        return false;
      }
      if (criteria.ageRange.max && patient.demographics.age > criteria.ageRange.max) {
        return false;
      }
    }
    
    // Check gender
    if (criteria.gender && criteria.gender !== 'Any' && 
        criteria.gender !== patient.demographics.gender) {
      return false;
    }
    
    // Check conditions
    if (criteria.conditions) {
      const hasCondition = criteria.conditions.some(conditionCode =>
        patient.medicalHistory.some(condition =>
          condition.status === 'Active' &&
          condition.icd10Code.startsWith(conditionCode)
        )
      );
      if (!hasCondition) return false;
    }
    
    // Check lab values
    if (criteria.labValues && patient.labResults) {
      for (const labCriteria of criteria.labValues) {
        const hasMatchingLab = patient.labResults.some(lab => {
          if (!lab.testName.toLowerCase().includes(labCriteria.testName.toLowerCase())) {
            return false;
          }
          if (typeof lab.value !== 'number') return false;
          
          switch (labCriteria.operator) {
            case '>': return lab.value > labCriteria.value;
            case '<': return lab.value < labCriteria.value;
            case '>=': return lab.value >= labCriteria.value;
            case '<=': return lab.value <= labCriteria.value;
            case '=': return lab.value === labCriteria.value;
            case '!=': return lab.value !== labCriteria.value;
            default: return false;
          }
        });
        
        if (!hasMatchingLab) return false;
      }
    }
    
    return true;
  }

  private getLatestEvidenceDate(recommendation: EvidenceRecommendation): number {
    const dates = recommendation.evidence.map(ev => {
      const match = ev.reference.match(/(\d{4})/);
      return match ? parseInt(match[1]) : 0;
    });
    
    return Math.max(...dates);
  }
}