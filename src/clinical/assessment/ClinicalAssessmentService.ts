/**
 * Clinical Assessment Service
 * OmniCare EMR - Clinical Workflow Implementation
 */

import {
  Patient,
  VitalSigns,
  NursingAssessment,
  PhysicianAssessment,
  ClinicalEncounter,
  ClinicalAlert,
  ClinicalOrder,
  RiskAssessment,
  PainAssessment,
  SkinAssessment,
  NeuroAssessment,
  IntakeOutput
} from './types';

export class ClinicalAssessmentService {
  private assessments: Map<string, NursingAssessment | PhysicianAssessment> = new Map();
  private encounters: Map<string, ClinicalEncounter> = new Map();
  private alerts: ClinicalAlert[] = [];

  /**
   * NURSING WORKFLOWS
   */

  /**
   * Perform initial patient assessment (Nursing Staff)
   */
  async performInitialNursingAssessment(
    patient: Patient,
    nurseName: string,
    nurseId: string,
    chiefComplaint: string,
    vitalSigns: VitalSigns
  ): Promise<NursingAssessment> {
    const assessment: NursingAssessment = {
      id: this.generateId(),
      patientId: patient.id,
      nurseName,
      nurseId,
      assessmentDate: new Date(),
      chiefComplaint,
      vitalSigns,
      allergies: patient.allergies,
      currentMedications: patient.medications.filter(med => med.active),
      acuityLevel: this.calculateAcuityLevel(vitalSigns, chiefComplaint),
      painAssessment: {
        painLevel: vitalSigns.painLevel || 0,
        location: '',
        character: '',
        frequency: '',
        duration: ''
      },
      nursingNotes: 'Initial nursing assessment completed',
      riskAssessments: []
    };

    // Perform risk assessments
    assessment.riskAssessments = await this.performRiskAssessments(patient, assessment);

    this.assessments.set(assessment.id, assessment);

    // Generate alerts if needed
    await this.checkForClinicalAlerts(patient, assessment);

    return assessment;
  }

  /**
   * Record serial vital signs (Nursing Staff - Exclusive)
   */
  async recordVitalSigns(
    patientId: string,
    vitalSigns: VitalSigns,
    recordedBy: string
  ): Promise<VitalSigns> {
    vitalSigns.id = this.generateId();
    vitalSigns.patientId = patientId;
    vitalSigns.recordedBy = recordedBy;
    vitalSigns.recordedAt = new Date();

    // Check for critical values
    await this.checkVitalSignsAlerts(vitalSigns);

    return vitalSigns;
  }

  /**
   * Perform nursing assessment (Nursing Staff - Exclusive)
   */
  async performNursingAssessment(
    patientId: string,
    nurseId: string,
    assessmentType: 'Pain' | 'Skin' | 'Neurological' | 'Intake/Output'
  ): Promise<Partial<NursingAssessment>> {
    const baseAssessment = {
      patientId,
      nurseName: await this.getNurseName(nurseId),
      nurseId,
      assessmentDate: new Date()
    };

    switch (assessmentType) {
      case 'Pain':
        return {
          ...baseAssessment,
          painAssessment: await this.performPainAssessment(patientId)
        };
      case 'Skin':
        return {
          ...baseAssessment,
          skinAssessment: await this.performSkinAssessment(patientId)
        };
      case 'Neurological':
        return {
          ...baseAssessment,
          neurologicalAssessment: await this.performNeuroAssessment(patientId)
        };
      case 'Intake/Output':
        return {
          ...baseAssessment,
          intakeOutput: await this.recordIntakeOutput(patientId)
        };
      default:
        throw new Error(`Unknown assessment type: ${assessmentType}`);
    }
  }

  /**
   * Document response to treatments (Nursing Staff - Exclusive)
   */
  async documentTreatmentResponse(
    patientId: string,
    treatmentId: string,
    response: string,
    nurseId: string
  ): Promise<void> {
    const nursingNote = {
      patientId,
      treatmentId,
      response,
      documentedBy: nurseId,
      documentedAt: new Date(),
      type: 'Treatment Response'
    };

    // Store nursing note and update patient status
    await this.storeNursingNote(nursingNote);
  }

  /**
   * PHYSICIAN WORKFLOWS
   */

  /**
   * Perform comprehensive clinical examination (Physician - Exclusive)
   */
  async performPhysicianAssessment(
    patient: Patient,
    physicianName: string,
    physicianId: string,
    nursingAssessment?: NursingAssessment
  ): Promise<PhysicianAssessment> {
    const assessment: PhysicianAssessment = {
      id: this.generateId(),
      patientId: patient.id,
      physicianName,
      physicianId,
      assessmentDate: new Date(),
      historyOfPresentIllness: '',
      pastMedicalHistory: '',
      familyHistory: '',
      socialHistory: '',
      reviewOfSystems: {
        constitutional: '',
        cardiovascular: '',
        respiratory: '',
        gastrointestinal: '',
        genitourinary: '',
        musculoskeletal: '',
        neurological: '',
        psychiatric: '',
        endocrine: '',
        hematologic: '',
        allergicImmunologic: ''
      },
      physicalExamination: {
        generalAppearance: '',
        vitalSigns: nursingAssessment?.vitalSigns || {} as VitalSigns,
        heent: '',
        cardiovascular: '',
        respiratory: '',
        abdominal: '',
        extremities: '',
        neurological: '',
        skin: '',
        psychiatric: ''
      },
      diagnosticImpressions: [],
      differentialDiagnosis: [],
      assessmentAndPlan: [],
      clinicalDecisionMaking: ''
    };

    this.assessments.set(assessment.id, assessment);
    return assessment;
  }

  /**
   * Update diagnostic impressions (Physician - Exclusive)
   */
  async updateDiagnosticImpressions(
    assessmentId: string,
    impressions: any[],
    physicianId: string
  ): Promise<void> {
    const assessment = this.assessments.get(assessmentId) as PhysicianAssessment;
    if (!assessment || assessment.physicianId !== physicianId) {
      throw new Error('Unauthorized: Only the assessing physician can update impressions');
    }

    assessment.diagnosticImpressions = impressions;
    assessment.assessmentDate = new Date();
  }

  /**
   * Create clinical orders (Physician - Exclusive)
   */
  async createClinicalOrders(
    patientId: string,
    orders: ClinicalOrder[],
    physicianId: string
  ): Promise<ClinicalOrder[]> {
    const createdOrders: ClinicalOrder[] = [];

    for (const order of orders) {
      const clinicalOrder: ClinicalOrder = {
        ...order,
        id: this.generateId(),
        orderedBy: physicianId,
        orderDate: new Date(),
        status: 'Pending'
      };

      // Check for drug interactions and contraindications for medication orders
      if (order.type === 'Medication') {
        await this.checkMedicationSafety(patientId, order.description);
      }

      createdOrders.push(clinicalOrder);
    }

    return createdOrders;
  }

  /**
   * CLINICAL DECISION SUPPORT
   */

  /**
   * Calculate acuity level based on vital signs and complaint
   */
  private calculateAcuityLevel(vitalSigns: VitalSigns, chiefComplaint: string): 'Low' | 'Medium' | 'High' | 'Critical' {
    let score = 0;

    // Vital signs scoring
    if (vitalSigns.temperature > 101.3 || vitalSigns.temperature < 96.8) score += 2;
    if (vitalSigns.bloodPressure.systolic > 180 || vitalSigns.bloodPressure.systolic < 90) score += 3;
    if (vitalSigns.bloodPressure.diastolic > 110 || vitalSigns.bloodPressure.diastolic < 60) score += 2;
    if (vitalSigns.heartRate > 120 || vitalSigns.heartRate < 50) score += 2;
    if (vitalSigns.respiratoryRate > 24 || vitalSigns.respiratoryRate < 12) score += 2;
    if (vitalSigns.oxygenSaturation < 92) score += 3;
    if (vitalSigns.painLevel && vitalSigns.painLevel >= 8) score += 2;

    // Chief complaint scoring
    const criticalComplaints = ['chest pain', 'shortness of breath', 'stroke', 'trauma', 'overdose'];
    const highComplaints = ['severe pain', 'fever', 'bleeding', 'altered mental status'];
    
    if (criticalComplaints.some(complaint => chiefComplaint.toLowerCase().includes(complaint))) {
      score += 4;
    } else if (highComplaints.some(complaint => chiefComplaint.toLowerCase().includes(complaint))) {
      score += 2;
    }

    if (score >= 8) return 'Critical';
    if (score >= 5) return 'High';
    if (score >= 2) return 'Medium';
    return 'Low';
  }

  /**
   * Perform comprehensive risk assessments
   */
  private async performRiskAssessments(patient: Patient, assessment: NursingAssessment): Promise<RiskAssessment[]> {
    const riskAssessments: RiskAssessment[] = [];

    // Fall risk assessment
    const fallRisk = await this.calculateFallRisk(patient, assessment);
    riskAssessments.push(fallRisk);

    // Pressure ulcer risk assessment
    const pressureUlcerRisk = await this.calculatePressureUlcerRisk(patient, assessment);
    riskAssessments.push(pressureUlcerRisk);

    // DVT risk assessment
    const dvtRisk = await this.calculateDVTRisk(patient, assessment);
    riskAssessments.push(dvtRisk);

    return riskAssessments;
  }

  /**
   * Check for clinical alerts based on assessment
   */
  private async checkForClinicalAlerts(patient: Patient, assessment: NursingAssessment): Promise<void> {
    // Check for drug allergies
    if (patient.allergies.length > 0) {
      this.alerts.push({
        id: this.generateId(),
        patientId: patient.id,
        type: 'Drug Allergy',
        severity: 'High',
        message: `Patient has documented allergies: ${patient.allergies.map(a => a.allergen).join(', ')}`,
        createdBy: assessment.nurseId,
        createdAt: new Date(),
        acknowledged: false
      });
    }

    // Check vital signs for critical values
    await this.checkVitalSignsAlerts(assessment.vitalSigns);
  }

  /**
   * Check vital signs for critical values
   */
  private async checkVitalSignsAlerts(vitalSigns: VitalSigns): Promise<void> {
    const criticalAlerts: string[] = [];

    if (vitalSigns.temperature > 104 || vitalSigns.temperature < 95) {
      criticalAlerts.push(`Critical temperature: ${vitalSigns.temperature}°F`);
    }
    if (vitalSigns.bloodPressure.systolic > 200 || vitalSigns.bloodPressure.systolic < 70) {
      criticalAlerts.push(`Critical systolic BP: ${vitalSigns.bloodPressure.systolic}`);
    }
    if (vitalSigns.heartRate > 150 || vitalSigns.heartRate < 40) {
      criticalAlerts.push(`Critical heart rate: ${vitalSigns.heartRate}`);
    }
    if (vitalSigns.oxygenSaturation < 88) {
      criticalAlerts.push(`Critical oxygen saturation: ${vitalSigns.oxygenSaturation}%`);
    }

    for (const alertMessage of criticalAlerts) {
      this.alerts.push({
        id: this.generateId(),
        patientId: vitalSigns.patientId,
        type: 'Critical Value',
        severity: 'High',
        message: alertMessage,
        createdBy: vitalSigns.recordedBy,
        createdAt: new Date(),
        acknowledged: false
      });
    }
  }

  /**
   * ASSESSMENT HELPERS
   */

  private async performPainAssessment(patientId: string): Promise<PainAssessment> {
    // This would integrate with patient input or nursing documentation
    return {
      painLevel: 0,
      location: '',
      character: '',
      frequency: '',
      duration: '',
      alleviatingFactors: '',
      aggravatingFactors: ''
    };
  }

  private async performSkinAssessment(patientId: string): Promise<SkinAssessment> {
    return {
      integrityStatus: 'Intact',
      color: 'Normal',
      temperature: 'Normal',
      turgor: 'Normal',
      pressureUlcerRisk: 0
    };
  }

  private async performNeuroAssessment(patientId: string): Promise<NeuroAssessment> {
    return {
      levelOfConsciousness: 'Alert',
      orientation: {
        person: true,
        place: true,
        time: true
      },
      pupilResponse: 'PERRL',
      motorResponse: 'Normal',
      sensoryResponse: 'Normal'
    };
  }

  private async recordIntakeOutput(patientId: string): Promise<IntakeOutput> {
    return {
      date: new Date(),
      intakeOral: 0,
      intakeIV: 0,
      outputUrine: 0,
      outputDrainage: 0,
      outputEmesis: 0,
      netBalance: 0
    };
  }

  private async calculateFallRisk(patient: Patient, assessment: NursingAssessment): Promise<RiskAssessment> {
    let score = 0;
    // Morse Fall Scale calculation
    // This would use actual assessment data
    
    return {
      type: 'Fall',
      score,
      riskLevel: score > 50 ? 'High' : score > 25 ? 'Medium' : 'Low',
      interventions: [],
      assessedBy: assessment.nurseId,
      assessmentDate: new Date()
    };
  }

  private async calculatePressureUlcerRisk(patient: Patient, assessment: NursingAssessment): Promise<RiskAssessment> {
    let score = 0;
    // Braden Scale calculation
    
    return {
      type: 'Pressure Ulcer',
      score,
      riskLevel: score < 12 ? 'High' : score < 15 ? 'Medium' : 'Low',
      interventions: [],
      assessedBy: assessment.nurseId,
      assessmentDate: new Date()
    };
  }

  private async calculateDVTRisk(patient: Patient, assessment: NursingAssessment): Promise<RiskAssessment> {
    let score = 0;
    // DVT risk assessment
    
    return {
      type: 'DVT',
      score,
      riskLevel: score > 3 ? 'High' : score > 1 ? 'Medium' : 'Low',
      interventions: [],
      assessedBy: assessment.nurseId,
      assessmentDate: new Date()
    };
  }

  private async checkMedicationSafety(patientId: string, medication: string): Promise<void> {
    // This would integrate with drug interaction databases
    // and patient allergy checking
  }

  private async getNurseName(nurseId: string): Promise<string> {
    // This would query the user/staff database
    return 'Nurse Name';
  }

  private async storeNursingNote(note: any): Promise<void> {
    // Store nursing documentation
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * PUBLIC API METHODS
   */

  public async getAssessment(assessmentId: string): Promise<NursingAssessment | PhysicianAssessment | undefined> {
    return this.assessments.get(assessmentId);
  }

  public async getPatientAssessments(patientId: string): Promise<(NursingAssessment | PhysicianAssessment)[]> {
    return Array.from(this.assessments.values()).filter(assessment => assessment.patientId === patientId);
  }

  public async getClinicalAlerts(patientId?: string): Promise<ClinicalAlert[]> {
    if (patientId) {
      return this.alerts.filter(alert => alert.patientId === patientId);
    }
    return this.alerts;
  }

  public async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
    }
  }
}