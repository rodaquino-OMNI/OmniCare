import { MedplumClient } from '@medplum/core';
import { 
  Patient, 
  Practitioner, 
  Encounter, 
  Observation, 
  MedicationRequest, 
  ServiceRequest,
  DiagnosticReport,
  AllergyIntolerance,
  Condition,
  Procedure,
  DocumentReference,
  Appointment,
  Organization,
  Location,
  Device,
  Medication,
  Substance,
  Binary,
  Bundle,
  Communication,
  CommunicationRequest,
  Task,
  Questionnaire,
  QuestionnaireResponse,
  CarePlan,
  CareTeam,
  Goal,
  RiskAssessment,
  ClinicalImpression,
  Immunization,
  FamilyMemberHistory,
  Media,
  Specimen,
  ImagingStudy,
  BodyStructure,
  MolecularSequence,
  DeviceMetric,
  Group,
  Person,
  RelatedPerson,
  HealthcareService,
  Schedule,
  Slot,
  PractitionerRole,
  OrganizationAffiliation,
  Endpoint,
  InsurancePlan,
  Coverage,
  Claim,
  ClaimResponse,
  ExplanationOfBenefit,
  PaymentNotice,
  PaymentReconciliation,
  Account,
  ChargeItem,
  ChargeItemDefinition,
  Contract,
  Invoice,
  Library,
  Measure,
  MeasureReport,
  PlanDefinition,
  ActivityDefinition,
  DeviceDefinition,
  EventDefinition,
  ObservationDefinition,
  SpecimenDefinition,
  MessageDefinition,
  MessageHeader,
  OperationDefinition,
  OperationOutcome,
  Parameters,
  Subscription,
  SubscriptionStatus,
  SubscriptionTopic,
  CapabilityStatement,
  CompartmentDefinition,
  ExampleScenario,
  GraphDefinition,
  ImplementationGuide,
  NamingSystem,
  SearchParameter,
  StructureDefinition,
  StructureMap,
  TerminologyCapabilities,
  TestReport,
  TestScript,
  ValueSet,
  CodeSystem,
  ConceptMap,
  NutritionOrder,
  VisionPrescription,
  RiskEvidenceSynthesis,
  EffectEvidenceSynthesis,
  ResearchDefinition,
  ResearchElementDefinition,
  Evidence,
  EvidenceVariable,
  Citation,
  ArtifactAssessment,
  ResearchStudy,
  ResearchSubject,
  AuditEvent,
  Provenance,
  Consent,
  DetectedIssue,
  Flag,
  GuidanceResponse,
  Basic,
  ListResource
} from '@medplum/fhirtypes';

// Medplum client configuration
export const medplumClient = new MedplumClient({
  baseUrl: process.env.NEXT_PUBLIC_MEDPLUM_URL || 'https://api.medplum.com',
  clientId: process.env.NEXT_PUBLIC_MEDPLUM_CLIENT_ID,
  // For demo purposes, we'll configure the client without authentication initially
  // In production, this would be properly configured with OAuth
});

// Initialize the client
export const initializeMedplum = async () => {
  try {
    // For demo purposes, we'll use a public project or create demo data
    // In production, this would handle proper authentication
    console.log('Medplum client initialized');
    return medplumClient;
  } catch (error) {
    console.error('Failed to initialize Medplum client:', error);
    throw error;
  }
};

// FHIR Resource type mapping for better TypeScript support
export type FHIRResource = 
  | Patient 
  | Practitioner 
  | Encounter 
  | Observation 
  | MedicationRequest 
  | ServiceRequest
  | DiagnosticReport
  | AllergyIntolerance
  | Condition
  | Procedure
  | DocumentReference
  | Appointment
  | Organization
  | Location
  | Device
  | Medication
  | Substance
  | Binary
  | Bundle
  | Communication
  | CommunicationRequest
  | Task
  | Questionnaire
  | QuestionnaireResponse
  | CarePlan
  | CareTeam
  | Goal
  | RiskAssessment
  | ClinicalImpression
  | Immunization
  | FamilyMemberHistory
  | Media
  | Specimen
  | ImagingStudy;

// Helper functions for common FHIR operations
export const patientHelpers = {
  // Get patient full name
  getFullName: (patient: Patient): string => {
    const name = patient.name?.[0];
    if (!name) return 'Unknown Patient';
    
    const given = name.given?.join(' ') || '';
    const family = name.family || '';
    return `${given} ${family}`.trim();
  },

  // Get patient age
  getAge: (patient: Patient): number => {
    if (!patient.birthDate) return 0;
    const birthDate = new Date(patient.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  },

  // Get patient identifier (MRN)
  getMRN: (patient: Patient): string => {
    const mrn = patient.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR');
    return mrn?.value || patient.id || 'Unknown';
  },

  // Get patient contact information
  getContactInfo: (patient: Patient) => {
    const telecom = patient.telecom || [];
    const phone = telecom.find(t => t.system === 'phone')?.value;
    const email = telecom.find(t => t.system === 'email')?.value;
    const address = patient.address?.[0];
    
    return { phone, email, address };
  },

  // Get patient allergies
  getAllergies: async (patientId: string): Promise<AllergyIntolerance[]> => {
    try {
      const bundle = await medplumClient.searchResources('AllergyIntolerance', {
        patient: patientId,
        _sort: '-recorded-date'
      });
      return bundle;
    } catch (error) {
      console.error('Error fetching allergies:', error);
      return [];
    }
  },

  // Get patient conditions
  getConditions: async (patientId: string): Promise<Condition[]> => {
    try {
      const bundle = await medplumClient.searchResources('Condition', {
        patient: patientId,
        _sort: '-recorded-date'
      });
      return bundle;
    } catch (error) {
      console.error('Error fetching conditions:', error);
      return [];
    }
  },

  // Get patient medications
  getMedications: async (patientId: string): Promise<MedicationRequest[]> => {
    try {
      const bundle = await medplumClient.searchResources('MedicationRequest', {
        patient: patientId,
        _sort: '-authored-on'
      });
      return bundle;
    } catch (error) {
      console.error('Error fetching medications:', error);
      return [];
    }
  },

  // Get patient vital signs
  getVitalSigns: async (patientId: string): Promise<Observation[]> => {
    try {
      const bundle = await medplumClient.searchResources('Observation', {
        patient: patientId,
        category: 'vital-signs',
        _sort: '-date'
      });
      return bundle;
    } catch (error) {
      console.error('Error fetching vital signs:', error);
      return [];
    }
  },

  // Get patient lab results
  getLabResults: async (patientId: string): Promise<Observation[]> => {
    try {
      const bundle = await medplumClient.searchResources('Observation', {
        patient: patientId,
        category: 'laboratory',
        _sort: '-date'
      });
      return bundle;
    } catch (error) {
      console.error('Error fetching lab results:', error);
      return [];
    }
  },

  // Get patient encounters
  getEncounters: async (patientId: string): Promise<Encounter[]> => {
    try {
      const bundle = await medplumClient.searchResources('Encounter', {
        patient: patientId,
        _sort: '-date'
      });
      return bundle;
    } catch (error) {
      console.error('Error fetching encounters:', error);
      return [];
    }
  },

  // Get patient appointments
  getAppointments: async (patientId: string): Promise<Appointment[]> => {
    try {
      const bundle = await medplumClient.searchResources('Appointment', {
        patient: patientId,
        _sort: 'date'
      });
      return bundle;
    } catch (error) {
      console.error('Error fetching appointments:', error);
      return [];
    }
  }
};

// Helper functions for observations
export const observationHelpers = {
  // Get observation value
  getValue: (observation: Observation): string => {
    if (observation.valueQuantity) {
      return `${observation.valueQuantity.value} ${observation.valueQuantity.unit || ''}`;
    }
    if (observation.valueString) {
      return observation.valueString;
    }
    if (observation.valueCodeableConcept) {
      return observation.valueCodeableConcept.text || 
             observation.valueCodeableConcept.coding?.[0]?.display || 
             'Unknown';
    }
    return 'No value';
  },

  // Get observation reference range
  getReferenceRange: (observation: Observation): string => {
    const range = observation.referenceRange?.[0];
    if (!range) return '';
    
    const low = range.low?.value;
    const high = range.high?.value;
    const unit = range.low?.unit || range.high?.unit || '';
    
    if (low && high) {
      return `${low}-${high} ${unit}`;
    }
    if (low) {
      return `>${low} ${unit}`;
    }
    if (high) {
      return `<${high} ${unit}`;
    }
    return '';
  },

  // Check if observation is abnormal
  isAbnormal: (observation: Observation): boolean => {
    return observation.interpretation?.some(interp => 
      interp.coding?.some(code => 
        ['H', 'L', 'A', 'AA', 'HH', 'LL'].includes(code.code || '')
      )
    ) || false;
  },

  // Get observation category
  getCategory: (observation: Observation): string => {
    return observation.category?.[0]?.coding?.[0]?.display || 
           observation.category?.[0]?.coding?.[0]?.code || 
           'Unknown';
  }
};

// Helper functions for medications
export const medicationHelpers = {
  // Get medication name
  getName: (medicationRequest: MedicationRequest): string => {
    if (medicationRequest.medicationCodeableConcept) {
      return medicationRequest.medicationCodeableConcept.text ||
             medicationRequest.medicationCodeableConcept.coding?.[0]?.display ||
             'Unknown Medication';
    }
    return 'Unknown Medication';
  },

  // Get dosage instruction
  getDosageInstruction: (medicationRequest: MedicationRequest): string => {
    const dosage = medicationRequest.dosageInstruction?.[0];
    if (!dosage) return 'No instructions';
    
    return dosage.text || 'See instructions';
  },

  // Get medication status
  getStatus: (medicationRequest: MedicationRequest): string => {
    return medicationRequest.status || 'unknown';
  },

  // Get prescriber
  getPrescriber: async (medicationRequest: MedicationRequest): Promise<string> => {
    if (medicationRequest.requester?.reference) {
      try {
        const practitioner = await medplumClient.readReference(medicationRequest.requester);
        if (practitioner.resourceType === 'Practitioner') {
          const name = practitioner.name?.[0];
          const given = name?.given?.join(' ') || '';
          const family = name?.family || '';
          return `${given} ${family}`.trim() || 'Unknown Prescriber';
        }
      } catch (error) {
        console.error('Error fetching prescriber:', error);
      }
    }
    return 'Unknown Prescriber';
  }
};

// Search and query helpers
export const searchHelpers = {
  // Search patients by name or identifier
  searchPatients: async (query: string): Promise<Patient[]> => {
    try {
      const searchParams: any = {
        _sort: 'family'
      };

      // If query looks like an MRN (alphanumeric), search by identifier
      if (/^[A-Z0-9]+$/i.test(query)) {
        searchParams.identifier = query;
      } else {
        // Otherwise search by name
        searchParams.name = query;
      }

      const bundle = await medplumClient.searchResources('Patient', searchParams);
      return bundle;
    } catch (error) {
      console.error('Error searching patients:', error);
      return [];
    }
  },

  // Search practitioners
  searchPractitioners: async (query: string): Promise<Practitioner[]> => {
    try {
      const bundle = await medplumClient.searchResources('Practitioner', {
        name: query,
        _sort: 'family'
      });
      return bundle;
    } catch (error) {
      console.error('Error searching practitioners:', error);
      return [];
    }
  },

  // Search observations by code
  searchObservationsByCode: async (patientId: string, code: string): Promise<Observation[]> => {
    try {
      const bundle = await medplumClient.searchResources('Observation', {
        patient: patientId,
        code: code,
        _sort: '-date'
      });
      return bundle;
    } catch (error) {
      console.error('Error searching observations:', error);
      return [];
    }
  }
};

// Demo data helpers for development
export const demoDataHelpers = {
  // Create demo patient
  createDemoPatient: (): Patient => ({
    resourceType: 'Patient',
    id: `demo-patient-${Date.now()}`,
    identifier: [
      {
        type: {
          coding: [{ code: 'MR', display: 'Medical Record Number' }]
        },
        value: `MRN${Math.floor(Math.random() * 100000)}`
      }
    ],
    name: [
      {
        given: ['John'],
        family: 'Doe',
        use: 'official'
      }
    ],
    gender: 'male',
    birthDate: '1980-01-15',
    telecom: [
      {
        system: 'phone',
        value: '555-123-4567',
        use: 'home'
      },
      {
        system: 'email',
        value: 'john.doe@example.com',
        use: 'home'
      }
    ],
    address: [
      {
        line: ['123 Main St'],
        city: 'Anytown',
        state: 'CA',
        postalCode: '12345',
        country: 'US',
        use: 'home'
      }
    ],
    active: true
  }),

  // Create demo vital signs
  createDemoVitalSigns: (patientId: string): Observation[] => [
    {
      resourceType: 'Observation',
      id: `demo-vitals-${Date.now()}-1`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          }
        ]
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      effectiveDateTime: new Date().toISOString(),
      valueQuantity: {
        value: 72,
        unit: 'beats/min',
        system: 'http://unitsofmeasure.org',
        code: '/min'
      }
    }
  ]
};

export default medplumClient;