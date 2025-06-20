/**
 * OmniCare Risk Scoring Service
 * 
 * Implementation of clinical risk scoring calculations including:
 * - MELD Score (Model for End-Stage Liver Disease)
 * - CHA2DS2-VASc Score (Stroke risk in atrial fibrillation)
 * - ASCVD Risk Calculator
 * - HAS-BLED Score
 * - CURB-65 Score
 * - And other clinical risk assessment tools
 */

import {
  Patient,
  RiskScore,
  RiskFactor,
  LabResult,
  MedicalCondition,
  VitalSigns
} from '../types/CDSTypes';

// Risk score calculation interfaces
interface ScoreInput {
  name: string;
  value: any;
  unit?: string;
  required: boolean;
}

interface ScoreResult {
  score: number;
  risk: 'Low' | 'Intermediate' | 'High' | 'Very High';
  interpretation: string;
  recommendations: string[];
  validity?: string;
}

export class RiskScoringService {
  /**
   * Calculate MELD Score for liver disease severity
   */
  async calculateMELDScore(patient: Patient): Promise<RiskScore | null> {
    const requiredLabs = ['creatinine', 'bilirubin', 'inr'];
    const labs = this.extractLabValues(patient.labResults || [], requiredLabs);

    if (!labs.creatinine || !labs.bilirubin || !labs.inr) {
      return null; // Cannot calculate without required values
    }

    const creatinine = Math.min(Math.max(labs.creatinine, 1.0), 4.0); // Clamp between 1.0-4.0
    const bilirubin = Math.max(labs.bilirubin, 1.0); // Minimum 1.0
    const inr = Math.max(labs.inr, 1.0); // Minimum 1.0

    // MELD formula: 3.78×ln(serum bilirubin) + 11.2×ln(INR) + 9.57×ln(serum creatinine) + 6.43
    const score = Math.round(
      3.78 * Math.log(bilirubin) +
      11.2 * Math.log(inr) +
      9.57 * Math.log(creatinine) +
      6.43
    );

    const finalScore = Math.max(6, Math.min(40, score)); // MELD score range 6-40

    const riskFactors: RiskFactor[] = [
      { name: 'Serum Creatinine', value: labs.creatinine, points: 0, weight: 9.57, description: 'mg/dL' },
      { name: 'Total Bilirubin', value: labs.bilirubin, points: 0, weight: 3.78, description: 'mg/dL' },
      { name: 'INR', value: labs.inr, points: 0, weight: 11.2, description: 'ratio' }
    ];

    let risk: 'Low' | 'Intermediate' | 'High' | 'Very High';
    let interpretation: string;

    if (finalScore < 15) {
      risk = 'Low';
      interpretation = 'Low mortality risk. 3-month mortality ~3%';
    } else if (finalScore < 25) {
      risk = 'Intermediate';
      interpretation = 'Intermediate mortality risk. 3-month mortality ~10-20%';
    } else if (finalScore < 35) {
      risk = 'High';
      interpretation = 'High mortality risk. 3-month mortality ~50%';
    } else {
      risk = 'Very High';
      interpretation = 'Very high mortality risk. 3-month mortality >70%';
    }

    return {
      scoreId: `meld-${Date.now()}`,
      scoreName: 'MELD Score',
      patient,
      score: finalScore,
      risk,
      factors: riskFactors,
      calculatedDate: new Date(),
      validityPeriod: 90 // 3 months
    };
  }

  /**
   * Calculate CHA2DS2-VASc Score for stroke risk in atrial fibrillation
   */
  async calculateCHA2DS2VAScScore(patient: Patient): Promise<RiskScore> {
    let score = 0;
    const riskFactors: RiskFactor[] = [];

    // Congestive heart failure (1 point)
    if (this.hasCondition(patient, ['I50'])) {
      score += 1;
      riskFactors.push({ name: 'Congestive Heart Failure', value: true, points: 1, weight: 1 });
    }

    // Hypertension (1 point)
    if (this.hasCondition(patient, ['I10', 'I11', 'I12', 'I13'])) {
      score += 1;
      riskFactors.push({ name: 'Hypertension', value: true, points: 1, weight: 1 });
    }

    // Age (1-2 points)
    const age = patient.demographics.age;
    if (age >= 75) {
      score += 2;
      riskFactors.push({ name: 'Age ≥75', value: age, points: 2, weight: 1, description: 'years' });
    } else if (age >= 65) {
      score += 1;
      riskFactors.push({ name: 'Age 65-74', value: age, points: 1, weight: 1, description: 'years' });
    }

    // Diabetes (1 point)
    if (this.hasCondition(patient, ['E10', 'E11', 'E12', 'E13', 'E14'])) {
      score += 1;
      riskFactors.push({ name: 'Diabetes Mellitus', value: true, points: 1, weight: 1 });
    }

    // Stroke/TIA history (2 points)
    if (this.hasCondition(patient, ['I63', 'G93.1', 'Z87.891'])) {
      score += 2;
      riskFactors.push({ name: 'Prior Stroke/TIA', value: true, points: 2, weight: 1 });
    }

    // Vascular disease (1 point)
    if (this.hasCondition(patient, ['I25', 'I70', 'I73'])) {
      score += 1;
      riskFactors.push({ name: 'Vascular Disease', value: true, points: 1, weight: 1 });
    }

    // Female sex (1 point)
    if (patient.demographics.gender === 'F') {
      score += 1;
      riskFactors.push({ name: 'Female Sex', value: true, points: 1, weight: 1 });
    }

    let risk: 'Low' | 'Intermediate' | 'High' | 'Very High';
    let interpretation: string;

    if (score === 0) {
      risk = 'Low';
      interpretation = 'Low stroke risk. Annual stroke rate ~0%';
    } else if (score === 1) {
      risk = 'Low';
      interpretation = 'Low stroke risk. Annual stroke rate ~1.3%';
    } else if (score === 2) {
      risk = 'Intermediate';
      interpretation = 'Moderate stroke risk. Annual stroke rate ~2.2%';
    } else if (score <= 4) {
      risk = 'High';
      interpretation = 'High stroke risk. Annual stroke rate ~4-7%';
    } else {
      risk = 'Very High';
      interpretation = 'Very high stroke risk. Annual stroke rate >7%';
    }

    return {
      scoreId: `cha2ds2vasc-${Date.now()}`,
      scoreName: 'CHA2DS2-VASc Score',
      patient,
      score,
      risk,
      factors: riskFactors,
      calculatedDate: new Date(),
      validityPeriod: 365 // 1 year
    };
  }

  /**
   * Calculate HAS-BLED Score for bleeding risk
   */
  async calculateHASBLEDScore(patient: Patient): Promise<RiskScore> {
    let score = 0;
    const riskFactors: RiskFactor[] = [];

    // Hypertension (1 point)
    if (this.hasCondition(patient, ['I10', 'I11', 'I12', 'I13'])) {
      score += 1;
      riskFactors.push({ name: 'Hypertension', value: true, points: 1, weight: 1 });
    }

    // Abnormal renal/liver function (1 point each)
    const labs = patient.labResults || [];
    const creatinine = this.getLabValue(labs, 'creatinine');
    if (creatinine && creatinine > 2.3) {
      score += 1;
      riskFactors.push({ name: 'Abnormal Renal Function', value: creatinine, points: 1, weight: 1, description: 'mg/dL' });
    }

    // Age > 65 (1 point)
    if (patient.demographics.age > 65) {
      score += 1;
      riskFactors.push({ name: 'Age >65', value: patient.demographics.age, points: 1, weight: 1, description: 'years' });
    }

    // Bleeding history (1 point)
    if (this.hasCondition(patient, ['K92.2', 'I85.0', 'S06'])) {
      score += 1;
      riskFactors.push({ name: 'Bleeding History', value: true, points: 1, weight: 1 });
    }

    // Labile INR (1 point) - if on warfarin
    const onWarfarin = patient.currentMedications.some(med => 
      med.name.toLowerCase().includes('warfarin') && med.status === 'Active'
    );
    if (onWarfarin) {
      score += 1;
      riskFactors.push({ name: 'Labile INR (on warfarin)', value: true, points: 1, weight: 1 });
    }

    // Drugs/alcohol (1 point each)
    const onAntiplatelets = patient.currentMedications.some(med => 
      ['aspirin', 'clopidogrel', 'prasugrel'].some(drug => 
        med.name.toLowerCase().includes(drug) && med.status === 'Active'
      )
    );
    if (onAntiplatelets) {
      score += 1;
      riskFactors.push({ name: 'Antiplatelet Drugs', value: true, points: 1, weight: 1 });
    }

    let risk: 'Low' | 'Intermediate' | 'High' | 'Very High';
    let interpretation: string;

    if (score <= 2) {
      risk = 'Low';
      interpretation = 'Low bleeding risk. Annual major bleeding rate ~1-2%';
    } else if (score === 3) {
      risk = 'Intermediate';
      interpretation = 'Moderate bleeding risk. Annual major bleeding rate ~3-4%';
    } else {
      risk = 'High';
      interpretation = 'High bleeding risk. Annual major bleeding rate >4%';
    }

    return {
      scoreId: `hasbled-${Date.now()}`,
      scoreName: 'HAS-BLED Score',
      patient,
      score,
      risk,
      factors: riskFactors,
      calculatedDate: new Date(),
      validityPeriod: 365 // 1 year
    };
  }

  /**
   * Calculate CURB-65 Score for pneumonia severity
   */
  async calculateCURB65Score(patient: Patient): Promise<RiskScore | null> {
    // This score requires clinical assessment and may not be fully calculable from patient data alone
    let score = 0;
    const riskFactors: RiskFactor[] = [];

    // Confusion (1 point) - would need assessment
    // Urea > 7 mmol/L (BUN > 19 mg/dL) (1 point)
    const labs = patient.labResults || [];
    const bun = this.getLabValue(labs, 'bun') || this.getLabValue(labs, 'urea');
    if (bun && bun > 19) {
      score += 1;
      riskFactors.push({ name: 'Elevated BUN', value: bun, points: 1, weight: 1, description: 'mg/dL' });
    }

    // Respiratory rate ≥ 30 (1 point)
    if (patient.vitalSigns?.respiratoryRate && patient.vitalSigns.respiratoryRate >= 30) {
      score += 1;
      riskFactors.push({ name: 'Respiratory Rate ≥30', value: patient.vitalSigns.respiratoryRate, points: 1, weight: 1, description: '/min' });
    }

    // Blood pressure (systolic < 90 or diastolic ≤ 60) (1 point)
    if (patient.vitalSigns?.bloodPressure) {
      const bp = patient.vitalSigns.bloodPressure;
      if (bp.systolic < 90 || bp.diastolic <= 60) {
        score += 1;
        riskFactors.push({ name: 'Hypotension', value: `${bp.systolic}/${bp.diastolic}`, points: 1, weight: 1, description: 'mmHg' });
      }
    }

    // Age ≥ 65 (1 point)
    if (patient.demographics.age >= 65) {
      score += 1;
      riskFactors.push({ name: 'Age ≥65', value: patient.demographics.age, points: 1, weight: 1, description: 'years' });
    }

    let risk: 'Low' | 'Intermediate' | 'High' | 'Very High';
    let interpretation: string;

    if (score <= 1) {
      risk = 'Low';
      interpretation = 'Low mortality risk. Consider outpatient treatment';
    } else if (score === 2) {
      risk = 'Intermediate';
      interpretation = 'Intermediate mortality risk. Consider short hospital stay';
    } else {
      risk = 'High';
      interpretation = 'High mortality risk. Hospitalization recommended';
    }

    return {
      scoreId: `curb65-${Date.now()}`,
      scoreName: 'CURB-65 Score',
      patient,
      score,
      risk,
      factors: riskFactors,
      calculatedDate: new Date(),
      validityPeriod: 7 // 1 week for acute condition
    };
  }

  /**
   * Calculate ASCVD Risk Score (10-year cardiovascular risk)
   */
  async calculateASCVDRisk(patient: Patient): Promise<RiskScore | null> {
    const labs = patient.labResults || [];
    const totalCholesterol = this.getLabValue(labs, 'total cholesterol');
    const hdl = this.getLabValue(labs, 'hdl');

    if (!totalCholesterol || !hdl) {
      return null; // Cannot calculate without lipid values
    }

    let score = 0;
    const riskFactors: RiskFactor[] = [];

    // Age component (varies by gender and race - simplified calculation)
    const age = patient.demographics.age;
    const ageCoeff = patient.demographics.gender === 'M' ? 12.344 : 17.114;
    score += ageCoeff * Math.log(age);
    riskFactors.push({ name: 'Age', value: age, points: 0, weight: ageCoeff, description: 'years' });

    // Total cholesterol
    const tcCoeff = patient.demographics.gender === 'M' ? 11.853 : 13.540;
    score += tcCoeff * Math.log(totalCholesterol);
    riskFactors.push({ name: 'Total Cholesterol', value: totalCholesterol, points: 0, weight: tcCoeff, description: 'mg/dL' });

    // HDL cholesterol
    const hdlCoeff = patient.demographics.gender === 'M' ? -7.990 : -13.578;
    score += hdlCoeff * Math.log(hdl);
    riskFactors.push({ name: 'HDL Cholesterol', value: hdl, points: 0, weight: hdlCoeff, description: 'mg/dL' });

    // Smoking (if documented)
    const isSmoker = this.hasCondition(patient, ['Z87.891', 'F17']);
    if (isSmoker) {
      const smokingCoeff = patient.demographics.gender === 'M' ? 7.837 : 7.574;
      score += smokingCoeff;
      riskFactors.push({ name: 'Current Smoker', value: true, points: 0, weight: smokingCoeff });
    }

    // Diabetes
    if (this.hasCondition(patient, ['E10', 'E11', 'E12', 'E13', 'E14'])) {
      const diabetesCoeff = patient.demographics.gender === 'M' ? 0.658 : 0.661;
      score += diabetesCoeff;
      riskFactors.push({ name: 'Diabetes', value: true, points: 0, weight: diabetesCoeff });
    }

    // Calculate risk percentage (simplified)
    const riskPercent = Math.round((1 - Math.pow(0.9533, Math.exp(score - 61.18))) * 100);

    let risk: 'Low' | 'Intermediate' | 'High' | 'Very High';
    let interpretation: string;

    if (riskPercent < 5) {
      risk = 'Low';
      interpretation = `Low 10-year ASCVD risk (${riskPercent}%)`;
    } else if (riskPercent < 7.5) {
      risk = 'Intermediate';
      interpretation = `Borderline 10-year ASCVD risk (${riskPercent}%)`;
    } else if (riskPercent < 20) {
      risk = 'High';
      interpretation = `Intermediate 10-year ASCVD risk (${riskPercent}%)`;
    } else {
      risk = 'Very High';
      interpretation = `High 10-year ASCVD risk (${riskPercent}%)`;
    }

    return {
      scoreId: `ascvd-${Date.now()}`,
      scoreName: 'ASCVD Risk Calculator',
      patient,
      score: riskPercent,
      risk,
      factors: riskFactors,
      calculatedDate: new Date(),
      validityPeriod: 365 // 1 year
    };
  }

  /**
   * Get all applicable risk scores for a patient
   */
  async getAllRiskScores(patient: Patient): Promise<RiskScore[]> {
    const scores: RiskScore[] = [];

    // Calculate MELD if liver disease present
    if (this.hasCondition(patient, ['K70', 'K71', 'K72', 'K73', 'K74', 'K76'])) {
      const meld = await this.calculateMELDScore(patient);
      if (meld) scores.push(meld);
    }

    // Calculate CHA2DS2-VASc if atrial fibrillation present
    if (this.hasCondition(patient, ['I48'])) {
      const cha2ds2vasc = await this.calculateCHA2DS2VAScScore(patient);
      scores.push(cha2ds2vasc);

      const hasbled = await this.calculateHASBLEDScore(patient);
      scores.push(hasbled);
    }

    // Calculate ASCVD for cardiovascular risk assessment
    if (patient.demographics.age >= 40 && patient.demographics.age <= 79) {
      const ascvd = await this.calculateASCVDRisk(patient);
      if (ascvd) scores.push(ascvd);
    }

    // Calculate CURB-65 if pneumonia suspected (would need clinical context)
    if (this.hasCondition(patient, ['J12', 'J13', 'J14', 'J15', 'J16', 'J18'])) {
      const curb65 = await this.calculateCURB65Score(patient);
      if (curb65) scores.push(curb65);
    }

    return scores;
  }

  /**
   * Get risk score recommendations based on calculated scores
   */
  async getRiskScoreRecommendations(scores: RiskScore[]): Promise<string[]> {
    const recommendations: string[] = [];

    for (const score of scores) {
      switch (score.scoreName) {
        case 'MELD Score':
          if (score.score >= 15) {
            recommendations.push('Consider liver transplant evaluation');
            recommendations.push('Hepatology consultation recommended');
          }
          break;

        case 'CHA2DS2-VASc Score':
          if (score.score >= 2) {
            recommendations.push('Consider anticoagulation therapy');
          } else if (score.score === 1) {
            recommendations.push('Consider anticoagulation or antiplatelet therapy');
          }
          break;

        case 'HAS-BLED Score':
          if (score.score >= 3) {
            recommendations.push('High bleeding risk - enhanced monitoring if anticoagulated');
            recommendations.push('Address modifiable bleeding risk factors');
          }
          break;

        case 'ASCVD Risk Calculator':
          if (score.score >= 7.5) {
            recommendations.push('Consider statin therapy for primary prevention');
            recommendations.push('Lifestyle modifications recommended');
          }
          break;

        case 'CURB-65 Score':
          if (score.score >= 3) {
            recommendations.push('Consider hospitalization');
            recommendations.push('IV antibiotics may be required');
          }
          break;
      }
    }

    return recommendations;
  }

  // Utility methods
  private extractLabValues(labs: LabResult[], requiredTests: string[]): Record<string, number> {
    const values: Record<string, number> = {};
    
    for (const test of requiredTests) {
      const lab = labs.find(l => 
        l.testName.toLowerCase().includes(test.toLowerCase()) &&
        l.status === 'Final'
      );
      
      if (lab && typeof lab.value === 'number') {
        values[test] = lab.value;
      }
    }
    
    return values;
  }

  private getLabValue(labs: LabResult[], testName: string): number | null {
    const lab = labs.find(l => 
      l.testName.toLowerCase().includes(testName.toLowerCase()) &&
      l.status === 'Final'
    );
    
    return lab && typeof lab.value === 'number' ? lab.value : null;
  }

  private hasCondition(patient: Patient, icd10Prefixes: string[]): boolean {
    return patient.medicalHistory.some(condition => 
      condition.status === 'Active' &&
      icd10Prefixes.some(prefix => condition.icd10Code.startsWith(prefix))
    );
  }
}