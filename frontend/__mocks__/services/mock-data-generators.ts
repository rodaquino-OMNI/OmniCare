import { 
  Patient, 
  AllergyIntolerance, 
  Condition, 
  MedicationRequest, 
  Encounter, 
  Observation,
  HumanName,
  ContactPoint,
  Address,
  CodeableConcept,
  Reference,
  Identifier
} from '@medplum/fhirtypes';

// Common code systems
const LOINC_SYSTEM = 'http://loinc.org';
const SNOMED_SYSTEM = 'http://snomed.info/sct';
const RXNORM_SYSTEM = 'http://www.nlm.nih.gov/research/umls/rxnorm';
const ICD10_SYSTEM = 'http://hl7.org/fhir/sid/icd-10';

// Mock data pools
const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'Robert', 'Lisa', 'William', 'Mary'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
const streets = ['Main St', 'Oak Ave', 'Elm St', 'Park Rd', 'Maple Dr', 'Cedar Ln', 'Pine St', 'Washington Ave', 'First St', 'Second Ave'];
const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'CA'];

// Helper function to generate random date
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper function to generate random number in range
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to pick random item from array
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Generate mock patient
export function createMockPatient(patientId: string): Patient {
  const firstName = randomChoice(firstNames);
  const lastName = randomChoice(lastNames);
  const birthDate = randomDate(new Date(1940, 0, 1), new Date(2010, 0, 1));
  
  const patient: Patient = {
    resourceType: 'Patient',
    id: patientId,
    meta: {
      lastUpdated: new Date().toISOString(),
      versionId: '1'
    },
    identifier: [{
      system: 'http://hospital.org/patient-id',
      value: `MRN-${patientId}`
    }],
    active: true,
    name: [{
      use: 'official' as const,
      family: lastName,
      given: [firstName],
      text: `${firstName} ${lastName}`
    }] as HumanName[],
    gender: randomChoice(['male', 'female', 'other']) as 'male' | 'female' | 'other' | 'unknown',
    birthDate: birthDate.toISOString().split('T')[0],
    telecom: [
      {
        system: 'phone',
        value: `+1${randomInt(200, 999)}${randomInt(200, 999)}${randomInt(1000, 9999)}`,
        use: 'home' as const
      },
      {
        system: 'email',
        value: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        use: 'home' as const
      }
    ] as ContactPoint[],
    address: [{
      use: 'home' as const,
      type: 'physical',
      line: [`${randomInt(100, 9999)} ${randomChoice(streets)}`],
      city: randomChoice(cities),
      state: states[cities.indexOf(randomChoice(cities))],
      postalCode: `${randomInt(10000, 99999)}`,
      country: 'USA'
    }] as Address[]
  };

  return patient;
}

// Generate mock allergies
export function createMockAllergies(patientId: string): AllergyIntolerance[] {
  const allergySubstances = [
    { code: '387406002', display: 'Sulfonamide' },
    { code: '7980', display: 'Penicillin' },
    { code: '227493005', display: 'Cashew nuts' },
    { code: '762952008', display: 'Peanut' },
    { code: '102263004', display: 'Eggs' },
    { code: '735029006', display: 'Shellfish' },
    { code: '256277009', display: 'Grass pollen' },
    { code: '409137002', display: 'Dust mite' }
  ];

  const count = randomInt(0, 3);
  const allergies: AllergyIntolerance[] = [];

  for (let i = 0; i < count; i++) {
    const substance = randomChoice(allergySubstances);
    
    allergies.push({
      resourceType: 'AllergyIntolerance',
      id: `allergy-${patientId}-${i}`,
      meta: {
        lastUpdated: new Date().toISOString(),
        versionId: '1'
      },
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
          code: 'active',
          display: 'Active'
        }]
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
          code: 'confirmed',
          display: 'Confirmed'
        }]
      },
      type: randomChoice(['allergy', 'intolerance']) as 'allergy' | 'intolerance',
      category: [randomChoice(['food', 'medication', 'environment']) as 'food' | 'medication' | 'environment' | 'biologic'],
      criticality: randomChoice(['low', 'high', 'unable-to-assess']) as 'low' | 'high' | 'unable-to-assess',
      code: {
        coding: [{
          system: SNOMED_SYSTEM,
          code: substance.code,
          display: substance.display
        }],
        text: substance.display
      },
      patient: {
        reference: `Patient/${patientId}`,
        display: 'Patient'
      },
      recordedDate: randomDate(new Date(2020, 0, 1), new Date()).toISOString()
    });
  }

  return allergies;
}

// Generate mock conditions
export function createMockConditions(patientId: string): Condition[] {
  const conditionCodes = [
    { code: 'E11.9', display: 'Type 2 diabetes mellitus without complications' },
    { code: 'I10', display: 'Essential (primary) hypertension' },
    { code: 'J45.909', display: 'Unspecified asthma, uncomplicated' },
    { code: 'K21.9', display: 'Gastro-esophageal reflux disease without esophagitis' },
    { code: 'M79.3', display: 'Myalgia' },
    { code: 'F32.9', display: 'Major depressive disorder, single episode, unspecified' }
  ];

  const count = randomInt(1, 4);
  const conditions: Condition[] = [];

  for (let i = 0; i < count; i++) {
    const condition = randomChoice(conditionCodes);
    
    conditions.push({
      resourceType: 'Condition',
      id: `condition-${patientId}-${i}`,
      meta: {
        lastUpdated: new Date().toISOString(),
        versionId: '1'
      },
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: randomChoice(['active', 'resolved', 'inactive']),
          display: 'Active'
        }]
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
          display: 'Confirmed'
        }]
      },
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-category',
          code: 'problem-list-item',
          display: 'Problem List Item'
        }]
      }],
      severity: {
        coding: [{
          system: SNOMED_SYSTEM,
          code: randomChoice(['255604002', '6736007', '24484000']),
          display: randomChoice(['Mild', 'Moderate', 'Severe'])
        }]
      },
      code: {
        coding: [{
          system: ICD10_SYSTEM,
          code: condition.code,
          display: condition.display
        }],
        text: condition.display
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: 'Patient'
      },
      recordedDate: randomDate(new Date(2019, 0, 1), new Date()).toISOString()
    });
  }

  return conditions;
}

// Generate mock medications
export function createMockMedications(patientId: string): MedicationRequest[] {
  const medicationCodes = [
    { code: '314076', display: 'lisinopril 10 MG Oral Tablet' },
    { code: '860975', display: 'metformin hydrochloride 500 MG Oral Tablet' },
    { code: '197361', display: 'atorvastatin 20 MG Oral Tablet' },
    { code: '314077', display: 'amlodipine 5 MG Oral Tablet' },
    { code: '849574', display: 'omeprazole 20 MG Delayed Release Oral Capsule' },
    { code: '1049221', display: 'acetaminophen 325 MG Oral Tablet' }
  ];

  const count = randomInt(1, 4);
  const medications: MedicationRequest[] = [];

  for (let i = 0; i < count; i++) {
    const medication = randomChoice(medicationCodes);
    
    medications.push({
      resourceType: 'MedicationRequest',
      id: `med-${patientId}-${i}`,
      meta: {
        lastUpdated: new Date().toISOString(),
        versionId: '1'
      },
      status: randomChoice(['active', 'completed', 'stopped']) as 'active' | 'on-hold' | 'stopped' | 'completed' | 'cancelled' | 'entered-in-error' | 'draft' | 'unknown',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [{
          system: RXNORM_SYSTEM,
          code: medication.code,
          display: medication.display
        }],
        text: medication.display
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: 'Patient'
      },
      authoredOn: randomDate(new Date(2023, 0, 1), new Date()).toISOString(),
      dosageInstruction: [{
        text: 'Take 1 tablet by mouth daily',
        timing: {
          repeat: {
            frequency: 1,
            period: 1,
            periodUnit: 'd'
          }
        },
        route: {
          coding: [{
            system: SNOMED_SYSTEM,
            code: '26643006',
            display: 'Oral route'
          }]
        }
      }]
    });
  }

  return medications;
}

// Generate mock encounters
export function createMockEncounters(patientId: string): Encounter[] {
  const encounterTypes = [
    { code: '308335008', display: 'Patient encounter procedure' },
    { code: '185345009', display: 'Encounter for symptom' },
    { code: '185349003', display: 'Encounter for check up' },
    { code: '439740005', display: 'Postoperative follow-up visit' }
  ];

  const count = randomInt(2, 5);
  const encounters: Encounter[] = [];

  for (let i = 0; i < count; i++) {
    const type = randomChoice(encounterTypes);
    const startDate = randomDate(new Date(2023, 0, 1), new Date());
    const endDate = new Date(startDate.getTime() + randomInt(30, 120) * 60000); // 30-120 minutes later
    
    encounters.push({
      resourceType: 'Encounter',
      id: `encounter-${patientId}-${i}`,
      meta: {
        lastUpdated: new Date().toISOString(),
        versionId: '1'
      },
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: randomChoice(['AMB', 'IMP', 'EMER']),
        display: randomChoice(['ambulatory', 'inpatient encounter', 'emergency'])
      },
      type: [{
        coding: [{
          system: SNOMED_SYSTEM,
          code: type.code,
          display: type.display
        }],
        text: type.display
      }],
      subject: {
        reference: `Patient/${patientId}`,
        display: 'Patient'
      },
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      reasonCode: [{
        coding: [{
          system: SNOMED_SYSTEM,
          code: '36971009',
          display: 'Routine health maintenance'
        }]
      }]
    });
  }

  return encounters;
}

// Generate mock vital signs
export function createMockVitalSigns(patientId: string): Observation[] {
  const vitals: Observation[] = [];
  const dates = Array.from({ length: 3 }, () => randomDate(new Date(2023, 6, 1), new Date()));

  dates.forEach((date, index) => {
    // Blood Pressure
    vitals.push({
      resourceType: 'Observation',
      id: `bp-${patientId}-${index}`,
      meta: {
        lastUpdated: new Date().toISOString(),
        versionId: '1'
      },
      status: 'final',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }]
      }],
      code: {
        coding: [{
          system: LOINC_SYSTEM,
          code: '85354-9',
          display: 'Blood pressure panel with all children optional'
        }],
        text: 'Blood pressure'
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: 'Patient'
      },
      effectiveDateTime: date.toISOString(),
      component: [
        {
          code: {
            coding: [{
              system: LOINC_SYSTEM,
              code: '8480-6',
              display: 'Systolic blood pressure'
            }]
          },
          valueQuantity: {
            value: randomInt(110, 140),
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]'
          }
        },
        {
          code: {
            coding: [{
              system: LOINC_SYSTEM,
              code: '8462-4',
              display: 'Diastolic blood pressure'
            }]
          },
          valueQuantity: {
            value: randomInt(60, 90),
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]'
          }
        }
      ]
    });

    // Heart Rate
    vitals.push({
      resourceType: 'Observation',
      id: `hr-${patientId}-${index}`,
      meta: {
        lastUpdated: new Date().toISOString(),
        versionId: '1'
      },
      status: 'final',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }]
      }],
      code: {
        coding: [{
          system: LOINC_SYSTEM,
          code: '8867-4',
          display: 'Heart rate'
        }],
        text: 'Heart rate'
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: 'Patient'
      },
      effectiveDateTime: date.toISOString(),
      valueQuantity: {
        value: randomInt(60, 100),
        unit: 'beats/minute',
        system: 'http://unitsofmeasure.org',
        code: '/min'
      }
    });

    // Temperature
    vitals.push({
      resourceType: 'Observation',
      id: `temp-${patientId}-${index}`,
      meta: {
        lastUpdated: new Date().toISOString(),
        versionId: '1'
      },
      status: 'final',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }]
      }],
      code: {
        coding: [{
          system: LOINC_SYSTEM,
          code: '8310-5',
          display: 'Body temperature'
        }],
        text: 'Body temperature'
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: 'Patient'
      },
      effectiveDateTime: date.toISOString(),
      valueQuantity: {
        value: randomInt(97, 99) + Math.random(),
        unit: '°F',
        system: 'http://unitsofmeasure.org',
        code: '[degF]'
      }
    });
  });

  return vitals;
}

// Generate mock lab results
export function createMockLabResults(patientId: string): Observation[] {
  const labs: Observation[] = [];
  const date = randomDate(new Date(2023, 9, 1), new Date());

  // Glucose
  labs.push({
    resourceType: 'Observation',
    id: `glucose-${patientId}`,
    meta: {
      lastUpdated: new Date().toISOString(),
      versionId: '1'
    },
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'laboratory',
        display: 'Laboratory'
      }]
    }],
    code: {
      coding: [{
        system: LOINC_SYSTEM,
        code: '2345-7',
        display: 'Glucose [Mass/volume] in Serum or Plasma'
      }],
      text: 'Glucose'
    },
    subject: {
      reference: `Patient/${patientId}`,
      display: 'Patient'
    },
    effectiveDateTime: date.toISOString(),
    valueQuantity: {
      value: randomInt(70, 140),
      unit: 'mg/dL',
      system: 'http://unitsofmeasure.org',
      code: 'mg/dL'
    },
    referenceRange: [{
      low: { value: 70, unit: 'mg/dL' },
      high: { value: 100, unit: 'mg/dL' },
      text: '70-100 mg/dL'
    }]
  });

  // Hemoglobin A1c
  labs.push({
    resourceType: 'Observation',
    id: `hba1c-${patientId}`,
    meta: {
      lastUpdated: new Date().toISOString(),
      versionId: '1'
    },
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'laboratory',
        display: 'Laboratory'
      }]
    }],
    code: {
      coding: [{
        system: LOINC_SYSTEM,
        code: '4548-4',
        display: 'Hemoglobin A1c/Hemoglobin.total in Blood'
      }],
      text: 'HbA1c'
    },
    subject: {
      reference: `Patient/${patientId}`,
      display: 'Patient'
    },
    effectiveDateTime: date.toISOString(),
    valueQuantity: {
      value: randomInt(5, 9) + Math.random(),
      unit: '%',
      system: 'http://unitsofmeasure.org',
      code: '%'
    },
    referenceRange: [{
      high: { value: 5.7, unit: '%' },
      text: '<5.7%'
    }]
  });

  // Cholesterol
  labs.push({
    resourceType: 'Observation',
    id: `cholesterol-${patientId}`,
    meta: {
      lastUpdated: new Date().toISOString(),
      versionId: '1'
    },
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'laboratory',
        display: 'Laboratory'
      }]
    }],
    code: {
      coding: [{
        system: LOINC_SYSTEM,
        code: '2093-3',
        display: 'Cholesterol [Mass/volume] in Serum or Plasma'
      }],
      text: 'Total Cholesterol'
    },
    subject: {
      reference: `Patient/${patientId}`,
      display: 'Patient'
    },
    effectiveDateTime: date.toISOString(),
    valueQuantity: {
      value: randomInt(150, 250),
      unit: 'mg/dL',
      system: 'http://unitsofmeasure.org',
      code: 'mg/dL'
    },
    referenceRange: [{
      high: { value: 200, unit: 'mg/dL' },
      text: '<200 mg/dL'
    }]
  });

  return labs;
}

// Create complete mock patient data
export function createMockPatientData(patientId: string) {
  return {
    patient: createMockPatient(patientId),
    allergies: createMockAllergies(patientId),
    conditions: createMockConditions(patientId),
    medications: createMockMedications(patientId),
    encounters: createMockEncounters(patientId),
    vitals: createMockVitalSigns(patientId),
    labs: createMockLabResults(patientId)
  };
}