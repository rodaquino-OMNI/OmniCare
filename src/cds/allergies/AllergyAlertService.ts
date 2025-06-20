/**
 * OmniCare Allergy Alert Service
 * 
 * Comprehensive allergy cross-referencing and safety alert system
 * Provides real-time allergy checking for medications, foods, and environmental allergens
 */

import {
  Allergy,
  Medication,
  Patient,
  AllergyAlert,
  CDSCard
} from '../types/CDSTypes';

// Cross-reactivity patterns for drug allergies
interface CrossReactivityRule {
  allergen: string;
  crossReactiveWith: string[];
  mechanism: string;
  severity: 'High' | 'Medium' | 'Low';
  likelihood: number; // 0-100%
}

// Allergy database for cross-reactivity checking
interface AllergyDatabase {
  drugCrossReactivity: Map<string, CrossReactivityRule[]>;
  drugClasses: Map<string, string[]>;
  foodDrugInteractions: Map<string, string[]>;
  lastUpdated: Date;
}

export class AllergyAlertService {
  private allergyDatabase: AllergyDatabase;
  private severityThreshold: 'High' | 'Medium' | 'Low' = 'Medium';

  constructor() {
    this.allergyDatabase = {
      drugCrossReactivity: new Map(),
      drugClasses: new Map(),
      foodDrugInteractions: new Map(),
      lastUpdated: new Date()
    };

    this.initializeAllergyDatabase();
  }

  /**
   * Check for allergy alerts when prescribing a medication
   */
  async checkAllergies(
    medication: Medication,
    patientAllergies: Allergy[]
  ): Promise<AllergyAlert[]> {
    const alerts: AllergyAlert[] = [];
    const activeAllergies = patientAllergies.filter(a => a.status === 'Active');

    for (const allergy of activeAllergies) {
      // Direct match check
      if (this.isDirectMatch(medication.name, allergy.allergen)) {
        alerts.push(this.createDirectAllergyAlert(medication, allergy));
        continue;
      }

      // Cross-reactivity check
      const crossReactivityAlerts = await this.checkCrossReactivity(medication, allergy);
      alerts.push(...crossReactivityAlerts);

      // Drug class check
      const classAlerts = await this.checkDrugClassReactivity(medication, allergy);
      alerts.push(...classAlerts);
    }

    // Food-drug interaction checks
    const foodAllergyAlerts = await this.checkFoodDrugInteractions(medication, activeAllergies);
    alerts.push(...foodAllergyAlerts);

    return this.sortAlertsBySeverity(alerts);
  }

  /**
   * Get comprehensive allergy profile for a patient
   */
  async getPatientAllergyProfile(patient: Patient): Promise<{
    activeAllergies: Allergy[];
    riskMedications: string[];
    recommendedPrecautions: string[];
    alertLevel: 'Low' | 'Medium' | 'High';
  }> {
    const activeAllergies = patient.allergies.filter(a => a.status === 'Active');
    const riskMedications: string[] = [];
    const recommendedPrecautions: string[] = [];

    // Identify high-risk medications based on allergies
    for (const allergy of activeAllergies) {
      if (allergy.allergenType === 'Drug') {
        const crossReactive = await this.getCrossReactiveMedications(allergy.allergen);
        riskMedications.push(...crossReactive);
      }
    }

    // Generate precautions
    if (activeAllergies.some(a => a.severity === 'Severe')) {
      recommendedPrecautions.push('Emergency medications readily available');
      recommendedPrecautions.push('Consider allergy specialist consultation');
    }

    if (activeAllergies.some(a => a.allergenType === 'Drug' && a.severity !== 'Mild')) {
      recommendedPrecautions.push('Enhanced medication verification protocols');
      recommendedPrecautions.push('Patient education on allergy management');
    }

    // Determine overall alert level
    const alertLevel = this.calculateOverallAlertLevel(activeAllergies);

    return {
      activeAllergies,
      riskMedications: [...new Set(riskMedications)],
      recommendedPrecautions,
      alertLevel
    };
  }

  /**
   * Validate allergy information for completeness and accuracy
   */
  async validateAllergyInformation(allergies: Allergy[]): Promise<{
    valid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    for (const allergy of allergies) {
      // Check for missing required information
      if (!allergy.reaction || allergy.reaction.length === 0) {
        issues.push(`Missing reaction details for ${allergy.allergen}`);
        suggestions.push(`Specify reaction symptoms for ${allergy.allergen}`);
      }

      if (allergy.severity === 'Unknown') {
        issues.push(`Unknown severity for ${allergy.allergen}`);
        suggestions.push(`Determine severity level for ${allergy.allergen}`);
      }

      if (allergy.verificationStatus === 'Unconfirmed') {
        suggestions.push(`Consider verifying allergy to ${allergy.allergen}`);
      }

      // Check for potentially outdated information
      if (allergy.onsetDate && this.isAllergyPotentiallyOutdated(allergy)) {
        suggestions.push(`Consider re-evaluating allergy to ${allergy.allergen} (reported ${this.getTimeSinceOnset(allergy)} ago)`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions
    };
  }

  /**
   * Generate allergy-safe medication alternatives
   */
  async suggestAlternatives(
    originalMedication: Medication,
    patientAllergies: Allergy[]
  ): Promise<{
    alternatives: Array<{
      medication: string;
      rationale: string;
      safetyLevel: 'Safe' | 'Caution' | 'Avoid';
    }>;
    considerations: string[];
  }> {
    const alternatives: Array<{
      medication: string;
      rationale: string;
      safetyLevel: 'Safe' | 'Caution' | 'Avoid';
    }> = [];
    const considerations: string[] = [];

    // Get therapeutic alternatives (this would integrate with a drug database)
    const therapeuticAlternatives = await this.getTherapeuticAlternatives(originalMedication);

    for (const alternative of therapeuticAlternatives) {
      const alerts = await this.checkAllergies(alternative, patientAllergies);
      
      if (alerts.length === 0) {
        alternatives.push({
          medication: alternative.name,
          rationale: 'No known allergic reactions',
          safetyLevel: 'Safe'
        });
      } else if (alerts.every(a => a.severity === 'Low')) {
        alternatives.push({
          medication: alternative.name,
          rationale: 'Low risk of allergic reaction',
          safetyLevel: 'Caution'
        });
      } else {
        alternatives.push({
          medication: alternative.name,
          rationale: 'Potential allergic reaction risk',
          safetyLevel: 'Avoid'
        });
      }
    }

    // Add general considerations
    considerations.push('Verify patient allergy history before prescribing');
    considerations.push('Monitor for unexpected allergic reactions');
    
    if (patientAllergies.some(a => a.severity === 'Severe')) {
      considerations.push('Have emergency medications available');
    }

    return {
      alternatives: alternatives.filter(a => a.safetyLevel !== 'Avoid'),
      considerations
    };
  }

  /**
   * Create allergy alert cards for CDS integration
   */
  createAllergyCards(alerts: AllergyAlert[]): CDSCard[] {
    return alerts.map(alert => ({
      summary: `Allergy Alert: ${alert.allergen}`,
      detail: alert.message,
      indicator: this.mapSeverityToIndicator(alert.severity),
      source: {
        label: 'Allergy Safety System',
        url: `https://omnicare.example.com/allergies/${alert.alertId}`,
        icon: '⚠️'
      },
      suggestions: [{
        label: 'Select alternative medication',
        actions: [{
          type: 'create',
          description: 'Open medication alternatives',
          resource: {
            resourceType: 'Task',
            code: 'select-alternative-medication',
            for: alert.medication
          }
        }]
      }],
      overrideReasons: [
        { code: 'allergy-unconfirmed', display: 'Allergy history unconfirmed' },
        { code: 'no-suitable-alternative', display: 'No suitable alternative available' },
        { code: 'benefits-outweigh-risks', display: 'Clinical benefits outweigh risks' },
        { code: 'emergency-situation', display: 'Emergency clinical situation' }
      ],
      links: [{
        label: 'View allergy details',
        url: `https://omnicare.example.com/patient/allergies/${alert.patientId}`,
        type: 'absolute'
      }]
    }));
  }

  /**
   * Initialize the allergy database with common cross-reactivity patterns
   */
  private initializeAllergyDatabase(): void {
    // Beta-lactam cross-reactivity
    this.allergyDatabase.drugCrossReactivity.set('penicillin', [
      {
        allergen: 'penicillin',
        crossReactiveWith: ['amoxicillin', 'ampicillin', 'amoxicillin/clavulanate', 'piperacillin'],
        mechanism: 'Beta-lactam ring structure similarity',
        severity: 'High',
        likelihood: 95
      },
      {
        allergen: 'penicillin',
        crossReactiveWith: ['cephalexin', 'cefazolin', 'ceftriaxone'],
        mechanism: 'Beta-lactam cross-reactivity (lower risk with newer cephalosporins)',
        severity: 'Medium',
        likelihood: 15
      }
    ]);

    // Sulfonamide cross-reactivity
    this.allergyDatabase.drugCrossReactivity.set('sulfa', [
      {
        allergen: 'sulfa',
        crossReactiveWith: ['sulfamethoxazole', 'sulfasalazine', 'sulfadiazine'],
        mechanism: 'Sulfonamide structure similarity',
        severity: 'High',
        likelihood: 90
      },
      {
        allergen: 'sulfa',
        crossReactiveWith: ['furosemide', 'hydrochlorothiazide', 'celecoxib'],
        mechanism: 'Non-antibiotic sulfonamides (lower cross-reactivity risk)',
        severity: 'Low',
        likelihood: 5
      }
    ]);

    // NSAID cross-reactivity
    this.allergyDatabase.drugCrossReactivity.set('aspirin', [
      {
        allergen: 'aspirin',
        crossReactiveWith: ['ibuprofen', 'naproxen', 'diclofenac', 'indomethacin'],
        mechanism: 'COX inhibition and prostaglandin pathway',
        severity: 'High',
        likelihood: 85
      }
    ]);

    // Drug classes mapping
    this.allergyDatabase.drugClasses.set('Beta-lactams', [
      'penicillin', 'amoxicillin', 'ampicillin', 'cephalexin', 'cefazolin', 'ceftriaxone'
    ]);

    this.allergyDatabase.drugClasses.set('Sulfonamides', [
      'sulfamethoxazole', 'sulfasalazine', 'sulfadiazine'
    ]);

    this.allergyDatabase.drugClasses.set('NSAIDs', [
      'aspirin', 'ibuprofen', 'naproxen', 'diclofenac', 'celecoxib'
    ]);

    // Food-drug interactions
    this.allergyDatabase.foodDrugInteractions.set('shellfish', [
      'iodinated contrast media' // Shellfish allergy and iodine contrast
    ]);
  }

  private isDirectMatch(medicationName: string, allergen: string): boolean {
    const medName = medicationName.toLowerCase().trim();
    const allergenName = allergen.toLowerCase().trim();
    
    return medName === allergenName || 
           medName.includes(allergenName) || 
           allergenName.includes(medName);
  }

  private createDirectAllergyAlert(medication: Medication, allergy: Allergy): AllergyAlert {
    return {
      alertId: `direct-${Date.now()}`,
      patientId: '', // Would be populated by the calling service
      allergen: allergy.allergen,
      medication: medication.name,
      crossReactivity: false,
      severity: this.mapAllergySeverityToAlertSeverity(allergy.severity),
      message: `Patient has a documented ${allergy.severity.toLowerCase()} allergy to ${allergy.allergen}. Reactions include: ${allergy.reaction.join(', ')}.`,
      recommendation: 'Do not administer. Select alternative medication.'
    };
  }

  private async checkCrossReactivity(
    medication: Medication,
    allergy: Allergy
  ): Promise<AllergyAlert[]> {
    const alerts: AllergyAlert[] = [];
    const crossReactivityRules = this.allergyDatabase.drugCrossReactivity.get(
      allergy.allergen.toLowerCase()
    );

    if (!crossReactivityRules) return alerts;

    for (const rule of crossReactivityRules) {
      const isMatch = rule.crossReactiveWith.some(drug =>
        medication.name.toLowerCase().includes(drug.toLowerCase())
      );

      if (isMatch && this.shouldAlertForSeverity(rule.severity)) {
        alerts.push({
          alertId: `cross-${Date.now()}`,
          patientId: '',
          allergen: allergy.allergen,
          medication: medication.name,
          crossReactivity: true,
          severity: rule.severity,
          message: `Potential cross-reactivity with ${allergy.allergen} allergy. ${rule.mechanism}. Likelihood: ${rule.likelihood}%.`,
          recommendation: rule.severity === 'High' 
            ? 'Consider alternative medication' 
            : 'Use with caution and monitoring'
        });
      }
    }

    return alerts;
  }

  private async checkDrugClassReactivity(
    medication: Medication,
    allergy: Allergy
  ): Promise<AllergyAlert[]> {
    const alerts: AllergyAlert[] = [];

    // Check if the medication belongs to the same class as the allergen
    for (const [className, drugs] of this.allergyDatabase.drugClasses) {
      const allergenInClass = drugs.some(drug => 
        allergy.allergen.toLowerCase().includes(drug.toLowerCase())
      );
      const medicationInClass = drugs.some(drug => 
        medication.name.toLowerCase().includes(drug.toLowerCase())
      );

      if (allergenInClass && medicationInClass && 
          !this.isDirectMatch(medication.name, allergy.allergen)) {
        alerts.push({
          alertId: `class-${Date.now()}`,
          patientId: '',
          allergen: allergy.allergen,
          medication: medication.name,
          crossReactivity: true,
          severity: 'Medium',
          message: `${medication.name} belongs to the same drug class (${className}) as ${allergy.allergen}.`,
          recommendation: 'Use with caution. Consider alternative from different drug class.'
        });
      }
    }

    return alerts;
  }

  private async checkFoodDrugInteractions(
    medication: Medication,
    allergies: Allergy[]
  ): Promise<AllergyAlert[]> {
    const alerts: AllergyAlert[] = [];
    const foodAllergies = allergies.filter(a => a.allergenType === 'Food');

    for (const foodAllergy of foodAllergies) {
      const interactingDrugs = this.allergyDatabase.foodDrugInteractions.get(
        foodAllergy.allergen.toLowerCase()
      );

      if (interactingDrugs) {
        const hasInteraction = interactingDrugs.some(drug =>
          medication.name.toLowerCase().includes(drug.toLowerCase())
        );

        if (hasInteraction) {
          alerts.push({
            alertId: `food-drug-${Date.now()}`,
            patientId: '',
            allergen: foodAllergy.allergen,
            medication: medication.name,
            crossReactivity: true,
            severity: 'Medium',
            message: `Patient has ${foodAllergy.allergen} allergy. ${medication.name} may cause cross-reaction.`,
            recommendation: 'Consider pre-medication or alternative agent if high risk.'
          });
        }
      }
    }

    return alerts;
  }

  private async getCrossReactiveMedications(allergen: string): Promise<string[]> {
    const crossReactive: string[] = [];
    const rules = this.allergyDatabase.drugCrossReactivity.get(allergen.toLowerCase());

    if (rules) {
      for (const rule of rules) {
        crossReactive.push(...rule.crossReactiveWith);
      }
    }

    return [...new Set(crossReactive)];
  }

  private calculateOverallAlertLevel(allergies: Allergy[]): 'Low' | 'Medium' | 'High' {
    if (allergies.some(a => a.severity === 'Severe')) return 'High';
    if (allergies.some(a => a.severity === 'Moderate')) return 'Medium';
    return 'Low';
  }

  private isAllergyPotentiallyOutdated(allergy: Allergy): boolean {
    if (!allergy.onsetDate) return false;
    const yearsSinceOnset = (Date.now() - allergy.onsetDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return yearsSinceOnset > 10; // Consider allergies older than 10 years for re-evaluation
  }

  private getTimeSinceOnset(allergy: Allergy): string {
    if (!allergy.onsetDate) return 'unknown time';
    const years = Math.floor((Date.now() - allergy.onsetDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
    return years === 1 ? '1 year' : `${years} years`;
  }

  private async getTherapeuticAlternatives(medication: Medication): Promise<Medication[]> {
    // This would integrate with a comprehensive drug database
    // Mock implementation returning similar therapeutic alternatives
    return [
      { ...medication, name: 'Alternative A', medicationId: 'alt-a' },
      { ...medication, name: 'Alternative B', medicationId: 'alt-b' }
    ];
  }

  private sortAlertsBySeverity(alerts: AllergyAlert[]): AllergyAlert[] {
    const severityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
    return alerts.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
  }

  private mapAllergySeverityToAlertSeverity(severity: string): 'High' | 'Medium' | 'Low' {
    switch (severity) {
      case 'Severe': return 'High';
      case 'Moderate': return 'Medium';
      default: return 'Low';
    }
  }

  private mapSeverityToIndicator(severity: 'High' | 'Medium' | 'Low'): 'info' | 'warning' | 'critical' {
    switch (severity) {
      case 'High': return 'critical';
      case 'Medium': return 'warning';
      default: return 'info';
    }
  }

  private shouldAlertForSeverity(severity: 'High' | 'Medium' | 'Low'): boolean {
    const severityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
    return severityOrder[severity] >= severityOrder[this.severityThreshold];
  }
}