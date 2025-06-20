/**
 * OmniCare Clinical Calculator Service
 * 
 * Collection of clinical calculators and tools for decision support
 */

import {
  Patient,
  ClinicalCalculator,
  CalculatorInput,
  CalculatorOption,
  CalculatorInterpretation,
  ValidationRule,
  LabResult,
  VitalSigns
} from '../types/CDSTypes';

export class ClinicalCalculatorService {
  private calculators: Map<string, ClinicalCalculator> = new Map();

  constructor() {
    this.initializeCalculators();
  }

  /**
   * Get all available calculators
   */
  getAvailableCalculators(): ClinicalCalculator[] {
    return Array.from(this.calculators.values());
  }

  /**
   * Get calculator by ID
   */
  getCalculator(calculatorId: string): ClinicalCalculator | null {
    return this.calculators.get(calculatorId) || null;
  }

  /**
   * Calculate BMI
   */
  calculateBMI(height: number, weight: number): {
    value: number;
    category: string;
    interpretation: string;
  } {
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    
    let category: string;
    let interpretation: string;

    if (bmi < 18.5) {
      category = 'Underweight';
      interpretation = 'Below normal weight';
    } else if (bmi < 25) {
      category = 'Normal weight';
      interpretation = 'Normal weight range';
    } else if (bmi < 30) {
      category = 'Overweight';
      interpretation = 'Above normal weight';
    } else {
      category = 'Obesity';
      interpretation = 'Obesity - increased health risks';
    }

    return {
      value: Math.round(bmi * 10) / 10,
      category,
      interpretation
    };
  }

  /**
   * Calculate eGFR (estimated Glomerular Filtration Rate)
   */
  calculateEGFR(creatinine: number, age: number, gender: 'M' | 'F', race?: string): {
    value: number;
    stage: string;
    interpretation: string;
  } {
    // CKD-EPI equation
    const k = gender === 'F' ? 0.7 : 0.9;
    const alpha = gender === 'F' ? -0.329 : -0.411;
    const genderFactor = gender === 'F' ? 1.018 : 1;
    const raceFactor = race === 'African American' ? 1.159 : 1;

    const egfr = 141 * Math.pow(Math.min(creatinine / k, 1), alpha) * 
                 Math.pow(Math.max(creatinine / k, 1), -1.209) * 
                 Math.pow(0.993, age) * genderFactor * raceFactor;

    let stage: string;
    let interpretation: string;

    if (egfr >= 90) {
      stage = 'Stage 1';
      interpretation = 'Normal or high kidney function';
    } else if (egfr >= 60) {
      stage = 'Stage 2';
      interpretation = 'Mild decrease in kidney function';
    } else if (egfr >= 45) {
      stage = 'Stage 3a';
      interpretation = 'Mild to moderate decrease in kidney function';
    } else if (egfr >= 30) {
      stage = 'Stage 3b';
      interpretation = 'Moderate to severe decrease in kidney function';
    } else if (egfr >= 15) {
      stage = 'Stage 4';
      interpretation = 'Severe decrease in kidney function';
    } else {
      stage = 'Stage 5';
      interpretation = 'Kidney failure';
    }

    return {
      value: Math.round(egfr),
      stage,
      interpretation
    };
  }

  /**
   * Calculate Framingham Risk Score
   */
  calculateFraminghamRisk(params: {
    age: number;
    gender: 'M' | 'F';
    totalCholesterol: number;
    hdlCholesterol: number;
    systolicBP: number;
    smoker: boolean;
    diabetes: boolean;
  }): {
    score: number;
    risk: string;
    tenYearRisk: number;
  } {
    let points = 0;

    // Age points
    if (params.gender === 'M') {
      if (params.age >= 20 && params.age <= 34) points += -9;
      else if (params.age >= 35 && params.age <= 39) points += -4;
      else if (params.age >= 40 && params.age <= 44) points += 0;
      else if (params.age >= 45 && params.age <= 49) points += 3;
      else if (params.age >= 50 && params.age <= 54) points += 6;
      else if (params.age >= 55 && params.age <= 59) points += 8;
      else if (params.age >= 60 && params.age <= 64) points += 10;
      else if (params.age >= 65 && params.age <= 69) points += 11;
      else if (params.age >= 70 && params.age <= 74) points += 12;
      else if (params.age >= 75) points += 13;
    } else {
      if (params.age >= 20 && params.age <= 34) points += -7;
      else if (params.age >= 35 && params.age <= 39) points += -3;
      else if (params.age >= 40 && params.age <= 44) points += 0;
      else if (params.age >= 45 && params.age <= 49) points += 3;
      else if (params.age >= 50 && params.age <= 54) points += 6;
      else if (params.age >= 55 && params.age <= 59) points += 8;
      else if (params.age >= 60 && params.age <= 64) points += 10;
      else if (params.age >= 65 && params.age <= 69) points += 12;
      else if (params.age >= 70 && params.age <= 74) points += 14;
      else if (params.age >= 75) points += 16;
    }

    // Total cholesterol points
    if (params.totalCholesterol < 160) points += 0;
    else if (params.totalCholesterol < 200) points += 4;
    else if (params.totalCholesterol < 240) points += 7;
    else if (params.totalCholesterol < 280) points += 9;
    else points += 11;

    // HDL cholesterol points
    if (params.hdlCholesterol >= 60) points += -1;
    else if (params.hdlCholesterol >= 50) points += 0;
    else if (params.hdlCholesterol >= 40) points += 1;
    else points += 2;

    // Blood pressure points
    if (params.systolicBP < 120) points += 0;
    else if (params.systolicBP < 130) points += 1;
    else if (params.systolicBP < 140) points += 2;
    else if (params.systolicBP < 160) points += 3;
    else points += 4;

    // Smoking
    if (params.smoker) points += 4;

    // Diabetes
    if (params.diabetes) points += 2;

    // Calculate 10-year risk
    const tenYearRisk = Math.round(1 - Math.pow(0.89, Math.exp(points - 5)) * 100);

    let risk: string;
    if (tenYearRisk < 10) risk = 'Low';
    else if (tenYearRisk < 20) risk = 'Intermediate';
    else risk = 'High';

    return {
      score: points,
      risk,
      tenYearRisk
    };
  }

  private initializeCalculators(): void {
    // BMI Calculator
    this.calculators.set('bmi', {
      calculatorId: 'bmi',
      name: 'Body Mass Index (BMI)',
      description: 'Calculate BMI and weight category',
      category: 'General',
      inputs: [
        {
          inputId: 'height',
          label: 'Height',
          type: 'number',
          unit: 'cm',
          required: true,
          validationRules: [
            { type: 'min', value: 100, message: 'Height must be at least 100 cm' },
            { type: 'max', value: 250, message: 'Height must be less than 250 cm' }
          ]
        },
        {
          inputId: 'weight',
          label: 'Weight',
          type: 'number',
          unit: 'kg',
          required: true,
          validationRules: [
            { type: 'min', value: 20, message: 'Weight must be at least 20 kg' },
            { type: 'max', value: 300, message: 'Weight must be less than 300 kg' }
          ]
        }
      ],
      formula: 'BMI = weight (kg) / height (m)²',
      interpretation: [
        { range: { max: 18.5 }, interpretation: 'Underweight', riskLevel: 'Low' },
        { range: { min: 18.5, max: 24.9 }, interpretation: 'Normal weight', riskLevel: 'Low' },
        { range: { min: 25, max: 29.9 }, interpretation: 'Overweight', riskLevel: 'Moderate' },
        { range: { min: 30 }, interpretation: 'Obesity', riskLevel: 'High' }
      ]
    });

    // eGFR Calculator
    this.calculators.set('egfr', {
      calculatorId: 'egfr',
      name: 'Estimated GFR (CKD-EPI)',
      description: 'Calculate estimated glomerular filtration rate',
      category: 'Nephrology',
      inputs: [
        {
          inputId: 'creatinine',
          label: 'Serum Creatinine',
          type: 'number',
          unit: 'mg/dL',
          required: true,
          validationRules: [
            { type: 'min', value: 0.1, message: 'Creatinine must be greater than 0.1' }
          ]
        },
        {
          inputId: 'age',
          label: 'Age',
          type: 'number',
          unit: 'years',
          required: true,
          validationRules: [
            { type: 'min', value: 18, message: 'Age must be at least 18' },
            { type: 'max', value: 120, message: 'Age must be less than 120' }
          ]
        },
        {
          inputId: 'gender',
          label: 'Gender',
          type: 'select',
          required: true,
          options: [
            { value: 'M', label: 'Male' },
            { value: 'F', label: 'Female' }
          ]
        }
      ],
      formula: 'CKD-EPI equation',
      interpretation: [
        { range: { min: 90 }, interpretation: 'Normal or high', riskLevel: 'Low' },
        { range: { min: 60, max: 89 }, interpretation: 'Mildly decreased', riskLevel: 'Low' },
        { range: { min: 45, max: 59 }, interpretation: 'Mild to moderately decreased', riskLevel: 'Moderate' },
        { range: { min: 30, max: 44 }, interpretation: 'Moderately to severely decreased', riskLevel: 'High' },
        { range: { min: 15, max: 29 }, interpretation: 'Severely decreased', riskLevel: 'Very High' },
        { range: { max: 15 }, interpretation: 'Kidney failure', riskLevel: 'Very High' }
      ]
    });
  }
}