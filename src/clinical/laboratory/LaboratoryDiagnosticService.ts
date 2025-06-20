/**
 * Laboratory and Diagnostic Service
 * OmniCare EMR - Clinical Workflow Implementation
 */

import {
  DiagnosticOrder,
  DiagnosticTest,
  SpecimenCollection,
  Specimen,
  LaboratoryProcessing,
  DiagnosticResult,
  ImagingStudy,
  PathologySpecimen,
  ResultsManagement,
  DiagnosticAlert,
  PatientPreparation,
  CriticalValueHandling,
  QualityControlCheck,
  TestResult,
  ReferenceRange,
  SpecimenQuality,
  NotificationProtocol
} from './types';

import { Patient, ClinicalOrder } from '../assessment/types';

export class LaboratoryDiagnosticService {
  private diagnosticOrders: Map<string, DiagnosticOrder> = new Map();
  private specimenCollections: Map<string, SpecimenCollection> = new Map();
  private laboratoryProcessing: Map<string, LaboratoryProcessing[]> = new Map();
  private diagnosticResults: Map<string, DiagnosticResult[]> = new Map();
  private imagingStudies: Map<string, ImagingStudy> = new Map();
  private pathologySpecimens: Map<string, PathologySpecimen> = new Map();
  private pendingResults: Map<string, ResultsManagement> = new Map();
  private diagnosticAlerts: DiagnosticAlert[] = [];
  private testDatabase: Map<string, DiagnosticTest> = new Map();

  /**
   * DIAGNOSTIC ORDER MANAGEMENT WORKFLOWS (Physician - Exclusive)
   */

  /**
   * Select appropriate diagnostic tests and create order
   */
  async createDiagnosticOrder(
    patientId: string,
    orderingPhysician: string,
    physicianId: string,
    tests: string[],
    clinicalIndication: string,
    urgency: DiagnosticOrder['urgency'] = 'Routine',
    specialInstructions?: string
  ): Promise<DiagnosticOrder> {
    
    // Validate tests and get test details
    const diagnosticTests = await this.validateAndGetTests(tests);
    
    // Generate patient preparation instructions
    const patientPreparation = await this.generatePatientPreparation(diagnosticTests);
    
    const diagnosticOrder: DiagnosticOrder = {
      id: this.generateId(),
      patientId,
      orderedBy: physicianId,
      orderingPhysician,
      orderDate: new Date(),
      orderType: this.determineOrderType(diagnosticTests),
      tests: diagnosticTests,
      clinicalIndication,
      specialInstructions,
      urgency,
      patientPreparation,
      status: 'Pending',
      qualityControl: {
        performedBy: 'System',
        performedDate: new Date(),
        specimenQuality: {} as SpecimenQuality,
        labelAccuracy: true,
        chainOfCustody: true,
        processingCompliance: true,
        resultReview: false,
        issues: [],
        overallStatus: 'Pass'
      },
      billing: {
        cptCodes: diagnosticTests.map(test => test.cptCode),
        icd10Codes: [],
        insurance: {
          primaryInsurance: '',
          policyNumber: '',
          groupNumber: '',
          coverageVerified: false
        },
        authorization: {
          required: await this.checkAuthorizationRequired(diagnosticTests),
          approvedTests: []
        },
        billingStatus: 'Pending',
        charges: await this.calculateCharges(diagnosticTests)
      }
    };

    // Schedule if not STAT
    if (urgency !== 'STAT') {
      diagnosticOrder.scheduledDate = await this.scheduleTests(diagnosticTests, urgency);
    }

    // Check for drug interactions or preparation conflicts
    await this.checkPreparationConflicts(patientId, patientPreparation);

    this.diagnosticOrders.set(diagnosticOrder.id, diagnosticOrder);

    // Create quality control documentation
    await this.createQualityControlDocumentation(diagnosticOrder);

    return diagnosticOrder;
  }

  /**
   * Document clinical indication and special instructions
   */
  async updateOrderIndication(
    orderId: string,
    physicianId: string,
    clinicalIndication: string,
    specialInstructions?: string
  ): Promise<void> {
    const order = this.diagnosticOrders.get(orderId);
    if (!order || order.orderedBy !== physicianId) {
      throw new Error('Unauthorized: Only the ordering physician can update indications');
    }

    order.clinicalIndication = clinicalIndication;
    order.specialInstructions = specialInstructions;
    
    this.diagnosticOrders.set(orderId, order);
  }

  /**
   * Specify result urgency and notification requirements
   */
  async setResultUrgency(
    orderId: string,
    physicianId: string,
    urgency: DiagnosticOrder['urgency'],
    notificationProtocol?: NotificationProtocol
  ): Promise<void> {
    const order = this.diagnosticOrders.get(orderId);
    if (!order || order.orderedBy !== physicianId) {
      throw new Error('Unauthorized: Only the ordering physician can set urgency');
    }

    order.urgency = urgency;

    // Update notification protocols for critical values
    for (const test of order.tests) {
      if (test.criticalValues && notificationProtocol) {
        test.criticalValues.forEach(cv => cv.notificationProtocol = notificationProtocol);
      }
    }

    this.diagnosticOrders.set(orderId, order);
  }

  /**
   * SPECIMEN COLLECTION WORKFLOWS (Nursing Staff)
   */

  /**
   * Review orders for completeness and prepare for collection
   */
  async reviewOrdersForCollection(
    orderId: string,
    nurseId: string
  ): Promise<{ complete: boolean; issues: string[]; preparations: string[] }> {
    const order = this.diagnosticOrders.get(orderId);
    if (!order) {
      throw new Error('Diagnostic order not found');
    }

    const issues: string[] = [];
    const preparations: string[] = [];

    // Check order completeness
    if (!order.clinicalIndication) {
      issues.push('Clinical indication missing');
    }

    // Verify patient preparation
    const preparationStatus = await this.verifyPatientPreparation(order.patientId, order.patientPreparation);
    if (!preparationStatus.complete) {
      issues.push(...preparationStatus.issues);
      preparations.push(...preparationStatus.requiredPreparations);
    }

    // Check for medication holds
    const medicationHolds = order.patientPreparation.medicationHold;
    if (medicationHolds.length > 0) {
      const holdsVerified = await this.verifyMedicationHolds(order.patientId, medicationHolds);
      if (!holdsVerified) {
        issues.push('Medication holds not verified');
      }
    }

    return {
      complete: issues.length === 0,
      issues,
      preparations
    };
  }

  /**
   * Prepare patient for specimen collection
   */
  async preparePatientForCollection(
    orderId: string,
    patientId: string,
    nurseId: string
  ): Promise<{ ready: boolean; preparations: string[] }> {
    const order = this.diagnosticOrders.get(orderId);
    if (!order) {
      throw new Error('Diagnostic order not found');
    }

    const preparations: string[] = [];

    // Verify patient identity
    const identityVerified = await this.verifyPatientIdentity(patientId);
    if (!identityVerified) {
      throw new Error('Patient identity verification failed');
    }

    // Check fasting status
    if (order.patientPreparation.fastingHours) {
      const fastingStatus = await this.checkFastingStatus(patientId, order.patientPreparation.fastingHours);
      if (!fastingStatus.adequate) {
        preparations.push(`Patient needs to fast for ${order.patientPreparation.fastingHours} hours`);
      }
    }

    // Verify dietary restrictions
    if (order.patientPreparation.dietaryRestrictions.length > 0) {
      preparations.push('Verify dietary restriction compliance');
    }

    // Position patient for collection
    preparations.push('Position patient appropriately for collection');

    return {
      ready: preparations.length === 0,
      preparations
    };
  }

  /**
   * Collect specimens according to protocol
   */
  async collectSpecimens(
    orderId: string,
    patientId: string,
    nurseId: string,
    nurseName: string,
    collectionSite: string,
    collectionNotes?: string
  ): Promise<SpecimenCollection> {
    const order = this.diagnosticOrders.get(orderId);
    if (!order) {
      throw new Error('Diagnostic order not found');
    }

    // Verify patient identity
    const identityVerified = await this.verifyPatientIdentity(patientId);
    if (!identityVerified) {
      throw new Error('Patient identity verification failed');
    }

    const specimens: Specimen[] = [];

    // Collect specimens for each test
    for (const test of order.tests) {
      const specimen: Specimen = {
        id: this.generateId(),
        specimenId: this.generateSpecimenId(),
        testCodes: [test.testCode],
        specimenType: test.specimenType,
        collectionContainer: test.containerType,
        volume: test.volumeRequired,
        quality: await this.assessSpecimenQuality(test.specimenType),
        transportConditions: {
          temperature: this.getRequiredTemperature(test.specimenType),
          timeLimit: test.turnaroundTime,
          specialHandling: test.specimenType.specialHandling,
          transportMethod: 'Pneumatic Tube',
          trackingNumber: this.generateTrackingNumber()
        },
        processingStatus: 'Collected'
      };

      specimens.push(specimen);
    }

    const specimenCollection: SpecimenCollection = {
      id: this.generateId(),
      orderId,
      patientId,
      collectedBy: nurseName,
      collectionDate: new Date(),
      collectionTime: new Date(),
      collectionSite,
      specimens,
      collectionComplications: false,
      patientIdentityVerified: true,
      labelsAccurate: await this.verifyLabels(specimens),
      transportArranged: true,
      collectionNotes
    };

    // Update order status
    order.status = 'In Progress';
    this.diagnosticOrders.set(orderId, order);

    // Schedule diagnostic procedures if needed
    await this.scheduleDiagnosticProcedures(order);

    this.specimenCollections.set(specimenCollection.id, specimenCollection);

    return specimenCollection;
  }

  /**
   * Label specimens accurately and arrange transport
   */
  async arrangeSpecimenTransport(
    collectionId: string,
    nurseId: string
  ): Promise<void> {
    const collection = this.specimenCollections.get(collectionId);
    if (!collection) {
      throw new Error('Specimen collection not found');
    }

    // Verify all labels are accurate
    collection.labelsAccurate = await this.verifyLabels(collection.specimens);
    
    if (!collection.labelsAccurate) {
      throw new Error('Specimen labels are inaccurate - cannot transport');
    }

    // Arrange transport for each specimen
    for (const specimen of collection.specimens) {
      specimen.processingStatus = 'In Transit';
      
      // Send transport notification
      await this.notifyLaboratory(specimen, collection.orderId);
    }

    collection.transportArranged = true;
    this.specimenCollections.set(collectionId, collection);
  }

  /**
   * LABORATORY PROCESSING WORKFLOWS (Laboratory Technician - Exclusive)
   */

  /**
   * Process specimens and perform ordered tests
   */
  async processSpecimen(
    specimenId: string,
    technicianId: string,
    technicianName: string,
    instrumentId: string
  ): Promise<LaboratoryProcessing> {
    const specimen = await this.getSpecimen(specimenId);
    if (!specimen) {
      throw new Error('Specimen not found');
    }

    // Verify specimen quality
    if (!specimen.quality.acceptable) {
      throw new Error(`Specimen rejected: ${specimen.quality.issues.map(i => i.issue).join(', ')}`);
    }

    const processing: LaboratoryProcessing = {
      id: this.generateId(),
      specimenId,
      testCode: specimen.testCodes[0], // Primary test
      technician: technicianName,
      processingDate: new Date(),
      instrument: await this.getInstrument(instrumentId),
      methodology: await this.getTestMethodology(specimen.testCodes[0]),
      calibrationStatus: await this.verifyCalibration(instrumentId),
      qualityControlResults: await this.performQualityControl(specimen.testCodes[0]),
      processingSteps: [],
      result: {} as TestResult,
      repeat: false,
      criticalValue: false,
      criticalValueNotified: false
    };

    // Perform processing steps
    processing.processingSteps = await this.executeProcessingSteps(specimen, processing.instrument);

    // Generate test result
    processing.result = await this.generateTestResult(specimen.testCodes[0], processing);

    // Check for critical values
    if (await this.isCriticalValue(processing.result)) {
      processing.criticalValue = true;
      await this.handleCriticalValue(specimenId, processing.result);
      processing.criticalValueNotified = true;
      processing.notificationTime = new Date();
    }

    // Document quality control
    await this.documentQualityControl(processing);

    // Store processing record
    if (!this.laboratoryProcessing.has(specimenId)) {
      this.laboratoryProcessing.set(specimenId, []);
    }
    this.laboratoryProcessing.get(specimenId)!.push(processing);

    // Update specimen status
    specimen.processingStatus = 'Completed';

    return processing;
  }

  /**
   * Document quality control measures
   */
  async documentQualityControlMeasures(
    processingId: string,
    technicianId: string,
    qualityMeasures: QualityControlCheck
  ): Promise<void> {
    // Find the processing record
    for (const [specimenId, processings] of this.laboratoryProcessing.entries()) {
      const processing = processings.find(p => p.id === processingId);
      if (processing) {
        // Update quality control documentation
        processing.qualityControlResults = processing.qualityControlResults.map(qc => ({
          ...qc,
          ...qualityMeasures
        }));
        break;
      }
    }
  }

  /**
   * Enter test results and flag abnormal findings
   */
  async enterTestResults(
    processingId: string,
    technicianId: string,
    results: { testCode: string; value: string; unit: string }[]
  ): Promise<DiagnosticResult[]> {
    const diagnosticResults: DiagnosticResult[] = [];

    for (const result of results) {
      // Get reference range for the test
      const referenceRange = await this.getReferenceRange(result.testCode);
      
      // Determine flag based on reference range
      const flag = this.determineResultFlag(result.value, referenceRange);

      const diagnosticResult: DiagnosticResult = {
        id: this.generateId(),
        orderId: await this.getOrderIdForProcessing(processingId),
        testCode: result.testCode,
        testName: await this.getTestName(result.testCode),
        result: {
          value: result.value,
          unit: result.unit,
          referenceRange,
          flag,
          methodUsed: await this.getTestMethodology(result.testCode),
          precision: 2,
          accuracy: 95,
          resultDate: new Date(),
          resultTime: new Date(),
          verified: false
        },
        interpretation: {
          interpretation: this.generateInterpretation(flag, result.testCode),
          clinicalCorrelation: 'Clinical correlation recommended',
          recommendedFollowUp: flag === 'Normal' ? undefined : 'Consider repeat testing if clinically indicated'
        },
        resultStatus: 'Preliminary',
        reportedDate: new Date(),
        reportedBy: technicianId,
        criticalValue: flag.includes('Critical'),
        deltaCheck: await this.performDeltaCheck(result.testCode, result.value),
        correlationCheck: await this.performCorrelationCheck(result.testCode, result.value)
      };

      // Handle critical values
      if (diagnosticResult.criticalValue) {
        diagnosticResult.criticalValueHandling = await this.handleCriticalValueNotification(diagnosticResult);
      }

      diagnosticResults.push(diagnosticResult);
    }

    // Store results
    const orderId = await this.getOrderIdForProcessing(processingId);
    if (!this.diagnosticResults.has(orderId)) {
      this.diagnosticResults.set(orderId, []);
    }
    this.diagnosticResults.get(orderId)!.push(...diagnosticResults);

    return diagnosticResults;
  }

  /**
   * Escalate critical values per protocol
   */
  async escalateCriticalValues(
    resultId: string,
    technicianId: string,
    escalationReason: string
  ): Promise<void> {
    // Find the result
    for (const [orderId, results] of this.diagnosticResults.entries()) {
      const result = results.find(r => r.id === resultId);
      if (result && result.criticalValue) {
        // Create escalation alert
        const alert: DiagnosticAlert = {
          id: this.generateId(),
          alertType: 'Critical Value',
          severity: 'High',
          message: `Critical value escalation: ${result.testName} = ${result.result.value}`,
          patientId: await this.getPatientIdForOrder(orderId),
          orderId,
          testCode: result.testCode,
          value: result.result.value,
          generatedDate: new Date(),
          generatedBy: technicianId,
          acknowledged: false,
          resolved: false
        };

        this.diagnosticAlerts.push(alert);

        // Notify physician immediately
        await this.notifyPhysicianCriticalValue(orderId, result, escalationReason);
        break;
      }
    }
  }

  /**
   * RESULTS MANAGEMENT WORKFLOWS (Physician - Exclusive)
   */

  /**
   * Review incoming results
   */
  async reviewIncomingResults(
    orderId: string,
    physicianId: string
  ): Promise<ResultsManagement> {
    const order = this.diagnosticOrders.get(orderId);
    if (!order || order.orderedBy !== physicianId) {
      throw new Error('Unauthorized: Only the ordering physician can review results');
    }

    const results = this.diagnosticResults.get(orderId) || [];
    
    const resultsManagement: ResultsManagement = {
      id: this.generateId(),
      orderId,
      patientId: order.patientId,
      results,
      reviewStatus: 'Pending',
      acknowledgmentRequired: results.some(r => r.criticalValue || r.result.flag !== 'Normal'),
      patientNotification: {
        notificationRequired: true,
        notificationMethod: 'Portal',
        patientContacted: false,
        messageDelivered: false,
        followUpScheduled: false
      },
      clinicalCorrelation: '',
      resultsSummary: this.generateResultsSummary(results)
    };

    this.pendingResults.set(orderId, resultsManagement);
    return resultsManagement;
  }

  /**
   * Acknowledge normal findings
   */
  async acknowledgeNormalFindings(
    orderId: string,
    physicianId: string,
    acknowledgmentComments?: string
  ): Promise<void> {
    const resultsManagement = this.pendingResults.get(orderId);
    if (!resultsManagement) {
      throw new Error('Results management record not found');
    }

    const order = this.diagnosticOrders.get(orderId);
    if (!order || order.orderedBy !== physicianId) {
      throw new Error('Unauthorized: Only the ordering physician can acknowledge results');
    }

    // Only acknowledge if all results are normal
    const allNormal = resultsManagement.results.every(r => r.result.flag === 'Normal');
    if (!allNormal) {
      throw new Error('Cannot acknowledge - abnormal results present');
    }

    resultsManagement.reviewStatus = 'Acknowledged';
    resultsManagement.acknowledgedBy = physicianId;
    resultsManagement.acknowledgmentDate = new Date();
    resultsManagement.clinicalCorrelation = acknowledgmentComments || 'Normal findings acknowledged';

    this.pendingResults.set(orderId, resultsManagement);
  }

  /**
   * Document interpretation of abnormal results
   */
  async interpretAbnormalResults(
    orderId: string,
    physicianId: string,
    interpretations: { resultId: string; interpretation: string; followUpPlan: string }[]
  ): Promise<void> {
    const resultsManagement = this.pendingResults.get(orderId);
    if (!resultsManagement) {
      throw new Error('Results management record not found');
    }

    const order = this.diagnosticOrders.get(orderId);
    if (!order || order.orderedBy !== physicianId) {
      throw new Error('Unauthorized: Only the ordering physician can interpret results');
    }

    // Update interpretations
    for (const interp of interpretations) {
      const result = resultsManagement.results.find(r => r.id === interp.resultId);
      if (result) {
        result.interpretation.interpretation = interp.interpretation;
        result.interpretation.recommendedFollowUp = interp.followUpPlan;
        result.reviewedBy = physicianId;
        result.reviewDate = new Date();
        result.resultStatus = 'Final';
      }
    }

    resultsManagement.reviewStatus = 'Reviewed';
    resultsManagement.reviewedBy = physicianId;
    resultsManagement.reviewDate = new Date();

    this.pendingResults.set(orderId, resultsManagement);
  }

  /**
   * Create follow-up plans for abnormal results
   */
  async createFollowUpPlans(
    orderId: string,
    physicianId: string,
    followUpPlans: string[]
  ): Promise<void> {
    const resultsManagement = this.pendingResults.get(orderId);
    if (!resultsManagement) {
      throw new Error('Results management record not found');
    }

    const order = this.diagnosticOrders.get(orderId);
    if (!order || order.orderedBy !== physicianId) {
      throw new Error('Unauthorized: Only the ordering physician can create follow-up plans');
    }

    resultsManagement.followUpOrders = followUpPlans;
    resultsManagement.reviewStatus = 'Acted Upon';

    this.pendingResults.set(orderId, resultsManagement);
  }

  /**
   * HELPER METHODS
   */

  private async validateAndGetTests(testCodes: string[]): Promise<DiagnosticTest[]> {
    const tests: DiagnosticTest[] = [];
    for (const code of testCodes) {
      const test = this.testDatabase.get(code);
      if (test) {
        tests.push(test);
      } else {
        throw new Error(`Invalid test code: ${code}`);
      }
    }
    return tests;
  }

  private async generatePatientPreparation(tests: DiagnosticTest[]): Promise<PatientPreparation> {
    const preparation: PatientPreparation = {
      dietaryRestrictions: [],
      medicationHold: [],
      activityRestrictions: [],
      preparationInstructions: []
    };

    // Check if any tests require fasting
    const fastingTests = tests.filter(test => test.specimenType.fastingRequired);
    if (fastingTests.length > 0) {
      preparation.fastingHours = 12; // Default fasting time
      preparation.preparationInstructions.push('Patient must fast for 12 hours before collection');
    }

    return preparation;
  }

  private determineOrderType(tests: DiagnosticTest[]): DiagnosticOrder['orderType'] {
    const types = tests.map(test => {
      if (['Chemistry', 'Hematology', 'Microbiology', 'Immunology', 'Molecular'].includes(test.testCategory)) {
        return 'Laboratory';
      } else if (test.testCategory === 'Radiology') {
        return 'Imaging';
      } else if (test.testCategory === 'Cardiology') {
        return 'Cardiology';
      } else if (test.testCategory === 'Pathology') {
        return 'Pathology';
      }
      return 'Laboratory';
    });

    // Return the most common type
    const typeCounts = types.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.keys(typeCounts).reduce((a, b) => typeCounts[a] > typeCounts[b] ? a : b) as DiagnosticOrder['orderType'];
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateSpecimenId(): string {
    return 'SPEC' + Math.random().toString(36).substr(2, 8).toUpperCase();
  }

  private generateTrackingNumber(): string {
    return 'TRK' + Math.random().toString(36).substr(2, 8).toUpperCase();
  }

  /**
   * PUBLIC API METHODS
   */

  public async getDiagnosticOrder(orderId: string): Promise<DiagnosticOrder | undefined> {
    return this.diagnosticOrders.get(orderId);
  }

  public async getPatientOrders(patientId: string): Promise<DiagnosticOrder[]> {
    return Array.from(this.diagnosticOrders.values()).filter(order => order.patientId === patientId);
  }

  public async getDiagnosticResults(orderId: string): Promise<DiagnosticResult[]> {
    return this.diagnosticResults.get(orderId) || [];
  }

  public async getPendingResults(physicianId: string): Promise<ResultsManagement[]> {
    return Array.from(this.pendingResults.values()).filter(rm => 
      rm.reviewStatus === 'Pending' && 
      this.diagnosticOrders.get(rm.orderId)?.orderedBy === physicianId
    );
  }

  public async getDiagnosticAlerts(): Promise<DiagnosticAlert[]> {
    return this.diagnosticAlerts.filter(alert => !alert.acknowledged);
  }

  public async acknowledgeAlert(alertId: string, acknowledgedBy: string, actionTaken?: string): Promise<void> {
    const alert = this.diagnosticAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedDate = new Date();
      alert.actionTaken = actionTaken;
    }
  }
}