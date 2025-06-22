/**
 * OmniCare Drug Interaction Service
 * 
 * Comprehensive drug interaction checking system with real-time alerts
 * Integrates with external drug databases and maintains local interaction rules
 */

import {
  Medication,
  DrugInteraction,
  Patient,
  Alert,
  CDSCard
} from '../types/CDSTypes';

// Drug interaction database entries
interface DrugInteractionDatabase {
  interactions: Map<string, DrugInteraction[]>;
  therapeuticClasses: Map<string, string[]>;
  contraindications: Map<string, string[]>;
  lastUpdated: Date;
}

export class DrugInteractionService {
  private interactionDatabase: DrugInteractionDatabase;
  private externalDatabaseUrl: string;
  private cacheTimeout: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor(externalDatabaseUrl?: string) {
    this.externalDatabaseUrl = externalDatabaseUrl || 'https://api.drugbank.com';
    this.interactionDatabase = {
      interactions: new Map(),
      therapeuticClasses: new Map(),
      contraindications: new Map(),
      lastUpdated: new Date()
    };
    
    this.initializeLocalDatabase();
  }

  /**
   * Check for drug interactions between a proposed medication and current medications
   */
  async checkInteractions(
    proposedMedication: Medication,
    currentMedications: Medication[]
  ): Promise<DrugInteraction[]> {
    const interactions: DrugInteraction[] = [];

    // Check each current medication against the proposed medication
    for (const currentMed of currentMedications.filter(m => m.status === 'Active')) {
      const drugInteractions = await this.getInteractionsBetweenDrugs(
        proposedMedication,
        currentMed
      );
      interactions.push(...drugInteractions);
    }

    // Check for duplicate therapeutic class interactions
    const classInteractions = await this.checkTherapeuticClassDuplication(
      proposedMedication,
      currentMedications
    );
    interactions.push(...classInteractions);

    // Sort by severity
    return this.sortInteractionsBySeverity(interactions);
  }

  /**
   * Get interactions between two specific drugs
   */
  async getInteractionsBetweenDrugs(
    drug1: Medication,
    drug2: Medication
  ): Promise<DrugInteraction[]> {
    const key1 = this.createInteractionKey(drug1.name, drug2.name);
    const key2 = this.createInteractionKey(drug2.name, drug1.name);

    // Check local database first
    let interactions = this.interactionDatabase.interactions.get(key1) || 
                      this.interactionDatabase.interactions.get(key2) || [];

    // If not found locally or data is stale, check external database
    if (interactions.length === 0 || this.isDatabaseStale()) {
      interactions = await this.fetchExternalInteractions(drug1, drug2);
      
      // Cache the results
      if (interactions.length > 0) {
        this.interactionDatabase.interactions.set(key1, interactions);
      }
    }

    return interactions;
  }

  /**
   * Check for therapeutic class duplication
   */
  private async checkTherapeuticClassDuplication(
    proposedMedication: Medication,
    currentMedications: Medication[]
  ): Promise<DrugInteraction[]> {
    const interactions: DrugInteraction[] = [];
    const proposedClass = await this.getTherapeuticClass(proposedMedication.name);

    if (!proposedClass) return interactions;

    for (const currentMed of currentMedications.filter(m => m.status === 'Active')) {
      const currentClass = await this.getTherapeuticClass(currentMed.name);
      
      if (currentClass === proposedClass && currentMed.name !== proposedMedication.name) {
        interactions.push({
          interactionId: `dup-${Date.now()}`,
          drug1: proposedMedication.name,
          drug2: currentMed.name,
          severity: 'Moderate',
          mechanism: 'Duplicate therapeutic class',
          effect: 'Potential for additive effects or increased risk of adverse reactions',
          management: 'Consider discontinuing one medication or adjusting doses. Monitor for enhanced therapeutic effects.',
          evidence: 'Good'
        });
      }
    }

    return interactions;
  }

  /**
   * Get comprehensive drug interaction report for a patient
   */
  async getPatientInteractionReport(patient: Patient): Promise<{
    interactions: DrugInteraction[];
    riskScore: number;
    recommendations: string[];
  }> {
    const allInteractions: DrugInteraction[] = [];
    const medications = patient.currentMedications.filter(m => m.status === 'Active');

    // Check all medication pairs
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const interactions = await this.getInteractionsBetweenDrugs(
          medications[i],
          medications[j]
        );
        allInteractions.push(...interactions);
      }
    }

    // Calculate risk score
    const riskScore = this.calculateInteractionRiskScore(allInteractions);

    // Generate recommendations
    const recommendations = this.generateInteractionRecommendations(
      allInteractions,
      patient
    );

    return {
      interactions: this.sortInteractionsBySeverity(allInteractions),
      riskScore,
      recommendations
    };
  }

  /**
   * Check for specific high-risk drug combinations
   */
  async checkHighRiskCombinations(medications: Medication[]): Promise<DrugInteraction[]> {
    const highRiskInteractions: DrugInteraction[] = [];

    // Define high-risk combinations
    const highRiskPairs = [
      { drugs: ['warfarin', 'aspirin'], risk: 'bleeding' },
      { drugs: ['warfarin', 'clopidogrel'], risk: 'bleeding' },
      { drugs: ['metformin', 'contrast'], risk: 'lactic acidosis' },
      { drugs: ['ace inhibitor', 'potassium'], risk: 'hyperkalemia' },
      { drugs: ['digoxin', 'amiodarone'], risk: 'toxicity' },
      { drugs: ['warfarin', 'amiodarone'], risk: 'bleeding' },
      { drugs: ['lithium', 'ace inhibitor'], risk: 'lithium toxicity' },
      { drugs: ['tramadol', 'ssri'], risk: 'serotonin syndrome' }
    ];

    const activeMeds = medications.filter(m => m.status === 'Active');

    for (const riskPair of highRiskPairs) {
      const med1 = activeMeds.find(m => 
        this.drugContainsIngredient(m.name, riskPair.drugs[0])
      );
      const med2 = activeMeds.find(m => 
        this.drugContainsIngredient(m.name, riskPair.drugs[1])
      );

      if (med1 && med2) {
        highRiskInteractions.push({
          interactionId: `high-risk-${riskPair.risk}-${Date.now()}`,
          drug1: med1.name,
          drug2: med2.name,
          severity: 'Major',
          mechanism: `High-risk combination for ${riskPair.risk}`,
          effect: `Increased risk of ${riskPair.risk}`,
          management: `Monitor closely for signs of ${riskPair.risk}. Consider alternative therapy.`,
          evidence: 'Excellent'
        });
      }
    }

    return highRiskInteractions;
  }

  /**
   * Check for contraindicated medications based on patient conditions
   */
  async checkContraindications(
    medication: Medication,
    patient: Patient
  ): Promise<DrugInteraction[]> {
    const contraindications: DrugInteraction[] = [];
    
    // Check against medical conditions
    for (const condition of patient.medicalHistory) {
      if (condition.status === 'Active') {
        const isContraindicated = await this.isContraindicated(
          medication.name,
          condition.icd10Code
        );
        
        if (isContraindicated) {
          contraindications.push({
            interactionId: `contra-${condition.conditionId}-${Date.now()}`,
            drug1: medication.name,
            drug2: condition.description,
            severity: 'Contraindicated',
            mechanism: 'Disease-drug contraindication',
            effect: `Contraindicated in ${condition.description}`,
            management: 'Select alternative medication. Do not administer.',
            evidence: 'Excellent'
          });
        }
      }
    }

    // Check against allergies
    for (const allergy of patient.allergies) {
      if (allergy.status === 'Active' && allergy.allergenType === 'Drug') {
        const isCrossReactive = await this.checkCrossReactivity(
          medication.name,
          allergy.allergen
        );
        
        if (isCrossReactive) {
          contraindications.push({
            interactionId: `allergy-${allergy.allergen}-${Date.now()}`,
            drug1: medication.name,
            drug2: allergy.allergen,
            severity: allergy.severity === 'Severe' ? 'Contraindicated' : 'Major',
            mechanism: 'Cross-reactivity with known allergy',
            effect: `Risk of allergic reaction due to cross-reactivity with ${allergy.allergen}`,
            management: 'Consider alternative medication. If no alternative, proceed with caution and monitoring.',
            evidence: 'Good'
          });
        }
      }
    }

    return contraindications;
  }

  /**
   * Get age-specific drug interaction warnings
   */
  async getAgeSpecificWarnings(
    medication: Medication,
    age: number
  ): Promise<DrugInteraction[]> {
    const warnings: DrugInteraction[] = [];

    // Pediatric warnings (< 18 years)
    if (age < 18) {
      const pediatricWarnings = await this.getPediatricWarnings(medication);
      warnings.push(...pediatricWarnings);
    }

    // Geriatric warnings (>= 65 years)
    if (age >= 65) {
      const geriatricWarnings = await this.getGeriatricWarnings(medication);
      warnings.push(...geriatricWarnings);
    }

    return warnings;
  }

  /**
   * Initialize local drug interaction database with common interactions
   */
  private initializeLocalDatabase(): void {
    // Initialize contraindications database
    this.initializeContraindications();
    
    // Common drug interactions - in a real system, this would be loaded from a database
    const commonInteractions: DrugInteraction[] = [
      {
        interactionId: 'warfarin-aspirin-001',
        drug1: 'warfarin',
        drug2: 'aspirin',
        severity: 'Major',
        mechanism: 'Additive anticoagulant and antiplatelet effects',
        effect: 'Increased risk of bleeding',
        management: 'Monitor INR more frequently. Consider gastroprotection. Watch for signs of bleeding.',
        evidence: 'Excellent',
        references: ['Holbrook A, et al. Chest. 2012;141(2 Suppl):e152S-e184S.']
      },
      {
        interactionId: 'ace-inhibitor-potassium-001',
        drug1: 'lisinopril',
        drug2: 'potassium chloride',
        severity: 'Major',
        mechanism: 'ACE inhibitors reduce potassium excretion',
        effect: 'Risk of hyperkalemia',
        management: 'Monitor serum potassium levels. Consider dose reduction or discontinuation of potassium supplementation.',
        evidence: 'Excellent'
      },
      {
        interactionId: 'digoxin-amiodarone-001',
        drug1: 'digoxin',
        drug2: 'amiodarone',
        severity: 'Major',
        mechanism: 'Amiodarone inhibits P-glycoprotein, increasing digoxin levels',
        effect: 'Increased risk of digoxin toxicity',
        management: 'Reduce digoxin dose by 50%. Monitor digoxin levels and signs of toxicity.',
        evidence: 'Excellent'
      }
    ];

    // Store interactions in database
    for (const interaction of commonInteractions) {
      const key = this.createInteractionKey(interaction.drug1, interaction.drug2);
      this.interactionDatabase.interactions.set(key, [interaction]);
    }

    // Initialize therapeutic classes
    this.initializeTherapeuticClasses();
  }

  /**
   * Initialize contraindications database
   */
  private initializeContraindications(): void {
    // Common drug-disease contraindications
    this.interactionDatabase.contraindications.set('metformin', ['N18.3', 'N18.4', 'N18.5', 'N18.6']);
    this.interactionDatabase.contraindications.set('nsaid', ['I50.0', 'I50.1', 'I50.9']);
    this.interactionDatabase.contraindications.set('warfarin', ['K92.2', 'I85.0']); // Bleeding disorders
  }

  private initializeTherapeuticClasses(): void {
    const therapeuticClasses = new Map([
      ['ACE Inhibitors', ['lisinopril', 'enalapril', 'captopril', 'ramipril']],
      ['ARBs', ['losartan', 'valsartan', 'irbesartan', 'candesartan']],
      ['Beta Blockers', ['metoprolol', 'atenolol', 'propranolol', 'carvedilol']],
      ['Statins', ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin']],
      ['Proton Pump Inhibitors', ['omeprazole', 'lansoprazole', 'pantoprazole', 'esomeprazole']],
      ['SSRIs', ['sertraline', 'fluoxetine', 'paroxetine', 'citalopram']],
      ['NSAIDs', ['ibuprofen', 'naproxen', 'diclofenac', 'celecoxib']]
    ]);

    // Reverse mapping: drug name -> therapeutic class
    for (const [className, drugs] of therapeuticClasses) {
      for (const drug of drugs) {
        this.interactionDatabase.therapeuticClasses.set(drug.toLowerCase(), [className]);
      }
    }
  }

  private async fetchExternalInteractions(
    drug1: Medication,
    drug2: Medication
  ): Promise<DrugInteraction[]> {
    try {
      // In a real implementation, this would call an external drug database API
      // For now, return empty array
      console.log(`Fetching interactions for ${drug1.name} + ${drug2.name} from external database`);
      return [];
    } catch (error) {
      console.error('Error fetching external drug interactions:', error);
      return [];
    }
  }

  private createInteractionKey(drug1: string, drug2: string): string {
    const [first, second] = [drug1.toLowerCase(), drug2.toLowerCase()].sort();
    return `${first}|${second}`;
  }

  private async getTherapeuticClass(drugName: string): Promise<string | null> {
    const classes = this.interactionDatabase.therapeuticClasses.get(drugName.toLowerCase());
    return classes?.[0] || null;
  }

  private sortInteractionsBySeverity(interactions: DrugInteraction[]): DrugInteraction[] {
    const severityOrder = ['Contraindicated', 'Major', 'Moderate', 'Minor'];
    return interactions.sort((a, b) => 
      severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
    );
  }

  private calculateInteractionRiskScore(interactions: DrugInteraction[]): number {
    let score = 0;
    const severityScores = { 'Contraindicated': 10, 'Major': 7, 'Moderate': 4, 'Minor': 1 };
    
    for (const interaction of interactions) {
      score += severityScores[interaction.severity] || 0;
    }
    
    return Math.min(score, 100); // Cap at 100
  }

  private generateInteractionRecommendations(
    interactions: DrugInteraction[],
    patient: Patient
  ): string[] {
    const recommendations: string[] = [];
    
    if (interactions.length === 0) {
      recommendations.push('No significant drug interactions detected.');
      return recommendations;
    }

    const severeCounts = interactions.filter(i => 
      i.severity === 'Contraindicated' || i.severity === 'Major'
    ).length;

    if (severeCounts > 0) {
      recommendations.push(`${severeCounts} major/contraindicated interaction(s) require immediate attention.`);
    }

    recommendations.push('Review all medication interactions with patient.');
    recommendations.push('Consider therapeutic alternatives where appropriate.');
    recommendations.push('Implement enhanced monitoring protocols.');
    
    if (patient.demographics.age >= 65) {
      recommendations.push('Apply extra caution due to patient age (≥65 years).');
    }

    return recommendations;
  }

  private isDatabaseStale(): boolean {
    const staleTime = Date.now() - this.cacheTimeout;
    return this.interactionDatabase.lastUpdated.getTime() < staleTime;
  }

  private drugContainsIngredient(drugName: string, ingredient: string): boolean {
    return drugName.toLowerCase().includes(ingredient.toLowerCase());
  }

  private async isContraindicated(drugName: string, icd10Code: string): Promise<boolean> {
    // This would check against a comprehensive contraindication database
    // Mock implementation with common contraindications
    const contraindications = this.interactionDatabase.contraindications.get(drugName.toLowerCase()) || [];
    
    // Add some common contraindications
    if (drugName.toLowerCase().includes('metformin') && icd10Code.startsWith('N18')) {
      return true; // Metformin contraindicated in chronic kidney disease
    }
    
    if (drugName.toLowerCase().includes('nsaid') && icd10Code.startsWith('I50')) {
      return true; // NSAIDs contraindicated in heart failure
    }
    
    return contraindications.includes(icd10Code);
  }

  private async checkCrossReactivity(drugName: string, allergen: string): Promise<boolean> {
    // Check for drug cross-reactivity patterns
    // This is a simplified implementation
    const crossReactivityPatterns = [
      { pattern: 'penicillin', crossReactive: ['amoxicillin', 'ampicillin'] },
      { pattern: 'sulfa', crossReactive: ['sulfamethoxazole', 'sulfasalazine'] },
      { pattern: 'aspirin', crossReactive: ['nsaid', 'ibuprofen', 'naproxen'] }
    ];

    for (const pattern of crossReactivityPatterns) {
      if (allergen.toLowerCase().includes(pattern.pattern)) {
        return pattern.crossReactive.some(drug => 
          drugName.toLowerCase().includes(drug.toLowerCase())
        );
      }
    }

    return false;
  }

  private async getPediatricWarnings(medication: Medication): Promise<DrugInteraction[]> {
    const pediatricWarnings: DrugInteraction[] = [];
    
    // Common pediatric warnings
    const pediatricConcerns = [
      { drug: 'aspirin', concern: 'Reye syndrome risk' },
      { drug: 'tetracycline', concern: 'Tooth discoloration' },
      { drug: 'fluoroquinolone', concern: 'Cartilage development concerns' }
    ];

    for (const concern of pediatricConcerns) {
      if (medication.name.toLowerCase().includes(concern.drug)) {
        pediatricWarnings.push({
          interactionId: `pediatric-${concern.drug}-${Date.now()}`,
          drug1: medication.name,
          drug2: 'Pediatric Population',
          severity: 'Major',
          mechanism: 'Age-related contraindication',
          effect: concern.concern,
          management: 'Consider alternative therapy appropriate for pediatric use.',
          evidence: 'Good'
        });
      }
    }

    return pediatricWarnings;
  }

  private async getGeriatricWarnings(medication: Medication): Promise<DrugInteraction[]> {
    const geriatricWarnings: DrugInteraction[] = [];
    
    // Beers Criteria medications potentially inappropriate for elderly
    const beersCriteria = [
      { drug: 'diphenhydramine', concern: 'Anticholinergic effects, cognitive impairment' },
      { drug: 'diazepam', concern: 'Falls risk, cognitive impairment' },
      { drug: 'amitriptyline', concern: 'Anticholinergic effects, sedation' }
    ];

    for (const criteria of beersCriteria) {
      if (medication.name.toLowerCase().includes(criteria.drug)) {
        geriatricWarnings.push({
          interactionId: `geriatric-${criteria.drug}-${Date.now()}`,
          drug1: medication.name,
          drug2: 'Geriatric Population',
          severity: 'Moderate',
          mechanism: 'Age-related increased sensitivity',
          effect: criteria.concern,
          management: 'Consider alternative therapy or dose reduction. Monitor closely.',
          evidence: 'Good'
        });
      }
    }

    return geriatricWarnings;
  }
}