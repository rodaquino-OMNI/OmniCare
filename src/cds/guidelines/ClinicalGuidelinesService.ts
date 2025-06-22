/**
 * OmniCare Clinical Guidelines Service
 * 
 * Implementation of evidence-based clinical guidelines and pathways
 * Provides real-time clinical decision support based on current best practices
 */

import {
  Patient,
  Medication,
  ClinicalGuideline,
  Recommendation,
  ApplicabilityCriteria,
  RecommendedAction,
  MedicalCondition,
  LabResult
} from '../types/CDSTypes';

// Guideline repository interface
interface GuidelineRepository {
  guidelines: Map<string, ClinicalGuideline>;
  conditionGuidelines: Map<string, string[]>; // ICD-10 -> guideline IDs
  medicationGuidelines: Map<string, string[]>; // medication -> guideline IDs
  lastUpdated: Date;
}

export class ClinicalGuidelinesService {
  private guidelineRepository: GuidelineRepository;
  private externalGuidelineService?: string;

  constructor(externalGuidelineService?: string) {
    this.externalGuidelineService = externalGuidelineService || '';
    this.guidelineRepository = {
      guidelines: new Map(),
      conditionGuidelines: new Map(),
      medicationGuidelines: new Map(),
      lastUpdated: new Date()
    };

    this.initializeGuidelines();
  }

  /**
   * Get applicable guidelines for a medication
   */
  async getApplicableGuidelines(
    medication: Medication,
    patient: Patient
  ): Promise<ClinicalGuideline[]> {
    const applicableGuidelines: ClinicalGuideline[] = [];

    // Get guidelines related to the medication
    const medicationGuidelineIds = this.guidelineRepository.medicationGuidelines.get(
      medication.name.toLowerCase()
    ) || [];

    for (const guidelineId of medicationGuidelineIds) {
      const guideline = this.guidelineRepository.guidelines.get(guidelineId);
      if (guideline && await this.isGuidelineApplicable(guideline, patient)) {
        applicableGuidelines.push(guideline);
      }
    }

    return applicableGuidelines;
  }

  /**
   * Get guidelines for patient conditions
   */
  async getGuidelinesForConditions(
    conditions: MedicalCondition[],
    patient: Patient
  ): Promise<ClinicalGuideline[]> {
    const applicableGuidelines: ClinicalGuideline[] = [];
    const activeConditions = conditions.filter(c => c.status === 'Active');

    for (const condition of activeConditions) {
      const conditionGuidelineIds = this.guidelineRepository.conditionGuidelines.get(
        condition.icd10Code
      ) || [];

      for (const guidelineId of conditionGuidelineIds) {
        const guideline = this.guidelineRepository.guidelines.get(guidelineId);
        if (guideline && await this.isGuidelineApplicable(guideline, patient)) {
          applicableGuidelines.push(guideline);
        }
      }
    }

    // Remove duplicates
    return this.removeDuplicateGuidelines(applicableGuidelines);
  }

  /**
   * Get preventive care recommendations
   */
  async getPreventiveCareRecommendations(patient: Patient): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const age = patient.demographics.age;
    const gender = patient.demographics.gender;

    // Age-based screening recommendations
    if (age >= 50) {
      recommendations.push({
        recommendationId: 'colorectal-screening',
        title: 'Colorectal Cancer Screening',
        description: 'Regular screening for colorectal cancer is recommended for adults aged 50 and older',
        strength: 'Strong',
        category: 'Screening',
        applicability: {
          ageRange: { min: 50, max: 75 },
          gender: 'Any'
        },
        actions: [{
          actionType: 'Order',
          description: 'Order colonoscopy or alternative screening method',
          frequency: 'Every 10 years',
          priority: 'Medium'
        }]
      });
    }

    // Gender-specific recommendations
    if (gender === 'F' && age >= 21) {
      recommendations.push({
        recommendationId: 'cervical-screening',
        title: 'Cervical Cancer Screening',
        description: 'Cervical cancer screening with Pap smear for women aged 21-65',
        strength: 'Strong',
        category: 'Screening',
        applicability: {
          ageRange: { min: 21, max: 65 },
          gender: 'F'
        },
        actions: [{
          actionType: 'Order',
          description: 'Pap smear',
          frequency: 'Every 3 years',
          priority: 'High'
        }]
      });
    }

    if (gender === 'F' && age >= 40) {
      recommendations.push({
        recommendationId: 'mammography-screening',
        title: 'Breast Cancer Screening',
        description: 'Mammography screening for women aged 40 and older',
        strength: 'Strong',
        category: 'Screening',
        applicability: {
          ageRange: { min: 40 },
          gender: 'F'
        },
        actions: [{
          actionType: 'Order',
          description: 'Mammography',
          frequency: 'Annually',
          priority: 'High'
        }]
      });
    }

    // Cardiovascular risk assessment
    if (age >= 40) {
      recommendations.push({
        recommendationId: 'cardiovascular-risk',
        title: 'Cardiovascular Risk Assessment',
        description: 'Assess cardiovascular risk factors including blood pressure, cholesterol, and diabetes screening',
        strength: 'Strong',
        category: 'Prevention',
        applicability: {
          ageRange: { min: 40 }
        },
        actions: [
          {
            actionType: 'Order',
            description: 'Lipid panel',
            frequency: 'Every 5 years',
            priority: 'Medium'
          },
          {
            actionType: 'Monitoring',
            description: 'Blood pressure monitoring',
            frequency: 'At each visit',
            priority: 'High'
          }
        ]
      });
    }

    return recommendations;
  }

  /**
   * Get treatment recommendations for specific conditions
   */
  async getTreatmentRecommendations(
    condition: MedicalCondition,
    patient: Patient
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Diabetes management
    if (condition.icd10Code.startsWith('E11')) { // Type 2 Diabetes
      recommendations.push({
        recommendationId: 'diabetes-hba1c-monitoring',
        title: 'HbA1c Monitoring',
        description: 'Regular HbA1c monitoring for diabetes management',
        strength: 'Strong',
        category: 'Monitoring',
        applicability: {
          conditions: ['E11']
        },
        actions: [{
          actionType: 'Order',
          description: 'HbA1c',
          frequency: 'Every 3-6 months',
          priority: 'High'
        }]
      });

      recommendations.push({
        recommendationId: 'diabetes-metformin',
        title: 'First-line Metformin Therapy',
        description: 'Metformin is recommended as first-line therapy for type 2 diabetes',
        strength: 'Strong',
        category: 'Treatment',
        applicability: {
          conditions: ['E11']
        },
        actions: [{
          actionType: 'Medication',
          description: 'Initiate metformin if no contraindications',
          priority: 'High'
        }]
      });
    }

    // Hypertension management
    if (condition.icd10Code.startsWith('I10')) { // Essential hypertension
      recommendations.push({
        recommendationId: 'hypertension-lifestyle',
        title: 'Lifestyle Modifications',
        description: 'Lifestyle modifications including diet, exercise, and weight management',
        strength: 'Strong',
        category: 'Prevention',
        applicability: {
          conditions: ['I10']
        },
        actions: [{
          actionType: 'Education',
          description: 'Patient education on lifestyle modifications',
          priority: 'High'
        }]
      });

      recommendations.push({
        recommendationId: 'hypertension-medication',
        title: 'Antihypertensive Therapy',
        description: 'Pharmacological treatment based on blood pressure targets',
        strength: 'Strong',
        category: 'Treatment',
        applicability: {
          conditions: ['I10']
        },
        actions: [{
          actionType: 'Medication',
          description: 'Initiate ACE inhibitor or ARB as first-line therapy',
          priority: 'High'
        }]
      });
    }

    return recommendations;
  }

  /**
   * Check for guideline-based drug interactions or contraindications
   */
  async checkGuidelineContraindications(
    medication: Medication,
    patient: Patient
  ): Promise<{
    contraindications: string[];
    warnings: string[];
    adjustments: string[];
  }> {
    const contraindications: string[] = [];
    const warnings: string[] = [];
    const adjustments: string[] = [];

    // Check age-based contraindications
    if (patient.demographics.age < 18) {
      const pediatricContraindications = await this.getPediatricContraindications(medication);
      contraindications.push(...pediatricContraindications);
    }

    if (patient.demographics.age >= 65) {
      const geriatricWarnings = await this.getGeriatricWarnings(medication);
      warnings.push(...geriatricWarnings);
    }

    // Check condition-based contraindications
    for (const condition of patient.medicalHistory) {
      if (condition.status === 'Active') {
        const conditionContraindications = await this.getConditionContraindications(
          medication,
          condition
        );
        contraindications.push(...conditionContraindications);
      }
    }

    // Check for dose adjustments based on lab values
    if (patient.labResults) {
      const doseAdjustments = await this.checkDoseAdjustments(medication, patient.labResults);
      adjustments.push(...doseAdjustments);
    }

    return { contraindications, warnings, adjustments };
  }

  /**
   * Get quality improvement recommendations
   */
  async getQualityImprovementRecommendations(
    patient: Patient
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Medication adherence
    if (patient.currentMedications.length > 3) {
      recommendations.push({
        recommendationId: 'medication-adherence',
        title: 'Medication Adherence Assessment',
        description: 'Assess and improve medication adherence for patients on multiple medications',
        strength: 'Weak',
        category: 'Monitoring',
        applicability: {},
        actions: [{
          actionType: 'Education',
          description: 'Medication adherence counseling',
          priority: 'Medium'
        }]
      });
    }

    // Polypharmacy review
    if (patient.currentMedications.filter(m => m.status === 'Active').length > 5) {
      recommendations.push({
        recommendationId: 'polypharmacy-review',
        title: 'Polypharmacy Review',
        description: 'Regular review of medications to minimize polypharmacy risks',
        strength: 'Strong',
        category: 'Monitoring',
        applicability: {},
        actions: [{
          actionType: 'Referral',
          description: 'Pharmacist consultation for medication review',
          priority: 'Medium'
        }]
      });
    }

    return recommendations;
  }

  /**
   * Initialize clinical guidelines database
   */
  private initializeGuidelines(): void {
    // Diabetes Management Guideline (ADA)
    const diabetesGuideline: ClinicalGuideline = {
      guidelineId: 'ada-diabetes-2023',
      title: 'Standards of Medical Care in Diabetes',
      organization: 'American Diabetes Association',
      version: '2023',
      lastUpdated: new Date('2023-01-01'),
      conditions: ['E11.9'], // Type 2 Diabetes
      evidenceLevel: 'A',
      recommendations: [
        {
          recommendationId: 'diabetes-hba1c-target',
          title: 'HbA1c Target',
          description: 'HbA1c target of <7% for most adults with diabetes',
          strength: 'Strong',
          category: 'Treatment',
          applicability: {
            conditions: ['E11.9']
          },
          actions: [{
            actionType: 'Monitoring',
            description: 'Monitor HbA1c every 3-6 months',
            priority: 'High'
          }]
        }
      ]
    };

    // Hypertension Management Guideline (AHA/ACC)
    const hypertensionGuideline: ClinicalGuideline = {
      guidelineId: 'aha-acc-hypertension-2017',
      title: 'High Blood Pressure Clinical Practice Guideline',
      organization: 'American Heart Association/American College of Cardiology',
      version: '2017',
      lastUpdated: new Date('2017-11-13'),
      conditions: ['I10'], // Essential hypertension
      evidenceLevel: 'A',
      recommendations: [
        {
          recommendationId: 'hypertension-bp-target',
          title: 'Blood Pressure Target',
          description: 'Blood pressure target <130/80 mmHg for most adults',
          strength: 'Strong',
          category: 'Treatment',
          applicability: {
            conditions: ['I10']
          },
          actions: [{
            actionType: 'Monitoring',
            description: 'Regular blood pressure monitoring',
            priority: 'High'
          }]
        }
      ]
    };

    // Store guidelines
    this.guidelineRepository.guidelines.set(diabetesGuideline.guidelineId, diabetesGuideline);
    this.guidelineRepository.guidelines.set(hypertensionGuideline.guidelineId, hypertensionGuideline);

    // Map conditions to guidelines
    this.guidelineRepository.conditionGuidelines.set('E11.9', ['ada-diabetes-2023']);
    this.guidelineRepository.conditionGuidelines.set('I10', ['aha-acc-hypertension-2017']);

    // Map medications to guidelines
    this.guidelineRepository.medicationGuidelines.set('metformin', ['ada-diabetes-2023']);
    this.guidelineRepository.medicationGuidelines.set('lisinopril', ['aha-acc-hypertension-2017']);
  }

  private async isGuidelineApplicable(
    guideline: ClinicalGuideline,
    patient: Patient
  ): Promise<boolean> {
    // Check if patient has any of the conditions mentioned in the guideline
    const hasApplicableCondition = patient.medicalHistory.some(condition =>
      condition.status === 'Active' &&
      guideline.conditions.some(guidelineCondition =>
        condition.icd10Code === guidelineCondition ||
        condition.icd10Code.startsWith(guidelineCondition.split('.')[0])
      )
    );

    return hasApplicableCondition;
  }

  private removeDuplicateGuidelines(guidelines: ClinicalGuideline[]): ClinicalGuideline[] {
    const unique = new Map<string, ClinicalGuideline>();
    for (const guideline of guidelines) {
      unique.set(guideline.guidelineId, guideline);
    }
    return Array.from(unique.values());
  }

  private async getPediatricContraindications(medication: Medication): Promise<string[]> {
    const contraindications: string[] = [];
    
    // Common pediatric contraindications
    const pediatricContraindicated = [
      { drug: 'aspirin', reason: 'Risk of Reye syndrome' },
      { drug: 'tetracycline', reason: 'Tooth discoloration and enamel defects' },
      { drug: 'fluoroquinolone', reason: 'Potential cartilage damage' }
    ];

    for (const contraindication of pediatricContraindicated) {
      if (medication.name.toLowerCase().includes(contraindication.drug)) {
        contraindications.push(`Contraindicated in pediatric patients: ${contraindication.reason}`);
      }
    }

    return contraindications;
  }

  private async getGeriatricWarnings(medication: Medication): Promise<string[]> {
    const warnings: string[] = [];
    
    // Beers Criteria medications
    const beersWarnings = [
      { drug: 'diphenhydramine', reason: 'Anticholinergic effects, falls risk' },
      { drug: 'diazepam', reason: 'Prolonged sedation, falls risk' },
      { drug: 'amitriptyline', reason: 'Anticholinergic effects' }
    ];

    for (const warning of beersWarnings) {
      if (medication.name.toLowerCase().includes(warning.drug)) {
        warnings.push(`Use with caution in elderly: ${warning.reason}`);
      }
    }

    return warnings;
  }

  private async getConditionContraindications(
    medication: Medication,
    condition: MedicalCondition
  ): Promise<string[]> {
    const contraindications: string[] = [];
    
    // Common condition-drug contraindications
    const conditionContraindications = [
      { condition: 'N18', drug: 'metformin', reason: 'Risk of lactic acidosis in kidney disease' },
      { condition: 'J44', drug: 'beta-blocker', reason: 'May worsen bronchospasm in COPD' },
      { condition: 'I50', drug: 'nsaid', reason: 'May worsen heart failure' }
    ];

    for (const contraindication of conditionContraindications) {
      if (condition.icd10Code.startsWith(contraindication.condition) &&
          medication.name.toLowerCase().includes(contraindication.drug)) {
        contraindications.push(`Contraindicated with ${condition.description}: ${contraindication.reason}`);
      }
    }

    return contraindications;
  }

  private async checkDoseAdjustments(
    medication: Medication,
    labResults: LabResult[]
  ): Promise<string[]> {
    const adjustments: string[] = [];
    
    // Check for renal dose adjustments
    const creatinine = labResults.find(lab => 
      lab.testName.toLowerCase().includes('creatinine')
    );
    
    if (creatinine && typeof creatinine.value === 'number' && creatinine.value > 1.5) {
      const renalAdjustmentDrugs = ['metformin', 'gabapentin', 'digoxin'];
      for (const drug of renalAdjustmentDrugs) {
        if (medication.name.toLowerCase().includes(drug)) {
          adjustments.push(`Consider dose reduction due to elevated creatinine (${creatinine.value} mg/dL)`);
        }
      }
    }

    // Check for hepatic dose adjustments
    const alt = labResults.find(lab => 
      lab.testName.toLowerCase().includes('alt') || 
      lab.testName.toLowerCase().includes('alanine')
    );
    
    if (alt && typeof alt.value === 'number' && alt.value > 40) {
      const hepaticAdjustmentDrugs = ['acetaminophen', 'statins'];
      for (const drug of hepaticAdjustmentDrugs) {
        if (medication.name.toLowerCase().includes(drug)) {
          adjustments.push(`Consider dose reduction due to elevated liver enzymes (ALT: ${alt.value} U/L)`);
        }
      }
    }

    return adjustments;
  }
}