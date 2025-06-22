/**
 * Test Patient Fixtures
 * Pre-defined test data for consistent E2E testing
 */

export const TEST_PATIENTS = {
  // Healthy adult patient for routine testing
  healthy_adult: {
    id: 'test-patient-001',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1980-05-15',
    gender: 'male',
    ssn: '123-45-6789',
    email: 'john.doe@email.com',
    phone: '555-0123',
    address: {
      line1: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701'
    },
    mrn: 'MRN001234',
    status: 'active'
  },

  // Patient with multiple conditions
  complex_patient: {
    id: 'test-patient-002',
    firstName: 'Jane',
    lastName: 'Smith',
    dateOfBirth: '1965-12-03',
    gender: 'female',
    ssn: '987-65-4321',
    email: 'jane.smith@email.com',
    phone: '555-0456',
    address: {
      line1: '456 Oak Ave',
      line2: 'Apt 2B',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62702'
    },
    mrn: 'MRN005678',
    status: 'active',
    conditions: [
      { code: 'I10', description: 'Essential hypertension' },
      { code: 'E11.9', description: 'Type 2 diabetes mellitus' }
    ],
    allergies: [
      { allergen: 'Penicillin', severity: 'severe', reaction: 'Anaphylaxis' }
    ],
    medications: [
      { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily' },
      { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily' }
    ]
  },

  // Pediatric patient
  pediatric_patient: {
    id: 'test-patient-003',
    firstName: 'Emily',
    lastName: 'Johnson',
    dateOfBirth: '2015-08-22',
    gender: 'female',
    ssn: '555-44-3333',
    email: 'parent@email.com',
    phone: '555-0789',
    address: {
      line1: '789 Pine St',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62703'
    },
    mrn: 'MRN009876',
    status: 'active',
    guardian: {
      name: 'Sarah Johnson',
      relationship: 'mother',
      phone: '555-0789'
    }
  },

  // Elderly patient
  elderly_patient: {
    id: 'test-patient-004',
    firstName: 'Robert',
    lastName: 'Wilson',
    dateOfBirth: '1940-03-10',
    gender: 'male',
    ssn: '111-22-3333',
    email: 'robert.wilson@email.com',
    phone: '555-0321',
    address: {
      line1: '321 Elm Dr',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62704'
    },
    mrn: 'MRN011223',
    status: 'active',
    emergencyContact: {
      name: 'Mary Wilson',
      relationship: 'spouse',
      phone: '555-0322'
    },
    conditions: [
      { code: 'M79.3', description: 'Arthritis' },
      { code: 'I25.9', description: 'Chronic ischemic heart disease' }
    ]
  },

  // Inactive patient for testing archived records
  inactive_patient: {
    id: 'test-patient-005',
    firstName: 'Michael',
    lastName: 'Brown',
    dateOfBirth: '1975-11-30',
    gender: 'male',
    ssn: '777-88-9999',
    email: 'michael.brown@email.com',
    phone: '555-0654',
    address: {
      line1: '654 Cedar Ln',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62705'
    },
    mrn: 'MRN077889',
    status: 'inactive'
  }
};

export const TEST_ENCOUNTERS = {
  routine_checkup: {
    id: 'encounter-001',
    patientId: 'test-patient-001',
    type: 'routine',
    status: 'finished',
    class: 'ambulatory',
    date: '2024-01-15',
    time: '10:00',
    practitioner: 'Dr. Sarah Johnson',
    chiefComplaint: 'Annual physical examination',
    vitals: {
      temperature: 98.6,
      systolic: 120,
      diastolic: 80,
      heartRate: 72,
      respiratoryRate: 16,
      oxygenSaturation: 98,
      weight: 180,
      height: 70
    },
    assessment: 'Patient in good health, no acute concerns',
    plan: 'Continue routine preventive care, follow up in 1 year'
  },

  urgent_visit: {
    id: 'encounter-002',
    patientId: 'test-patient-002',
    type: 'urgent',
    status: 'in-progress',
    class: 'ambulatory',
    date: '2024-01-20',
    time: '14:30',
    practitioner: 'Dr. Sarah Johnson',
    chiefComplaint: 'Chest pain and shortness of breath',
    vitals: {
      temperature: 99.2,
      systolic: 145,
      diastolic: 95,
      heartRate: 88,
      respiratoryRate: 20,
      oxygenSaturation: 96
    }
  },

  emergency_visit: {
    id: 'encounter-003',
    patientId: 'test-patient-004',
    type: 'emergency',
    status: 'arrived',
    class: 'emergency',
    date: '2024-01-22',
    time: '08:15',
    practitioner: 'Dr. Emergency Physician',
    chiefComplaint: 'Fall with hip pain',
    priority: 'urgent'
  }
};

export const TEST_LAB_RESULTS = {
  normal_cbc: {
    id: 'lab-001',
    patientId: 'test-patient-001',
    encounterId: 'encounter-001',
    testName: 'Complete Blood Count',
    orderDate: '2024-01-15',
    collectionDate: '2024-01-15',
    resultDate: '2024-01-16',
    status: 'final',
    results: [
      { name: 'White Blood Cells', value: '7.2', unit: 'K/uL', range: '4.5-11.0', status: 'normal' },
      { name: 'Red Blood Cells', value: '4.8', unit: 'M/uL', range: '4.2-5.4', status: 'normal' },
      { name: 'Hemoglobin', value: '14.5', unit: 'g/dL', range: '12.0-16.0', status: 'normal' },
      { name: 'Hematocrit', value: '42.1', unit: '%', range: '36.0-46.0', status: 'normal' },
      { name: 'Platelets', value: '285', unit: 'K/uL', range: '150-450', status: 'normal' }
    ]
  },

  abnormal_glucose: {
    id: 'lab-002',
    patientId: 'test-patient-002',
    encounterId: 'encounter-002',
    testName: 'Basic Metabolic Panel',
    orderDate: '2024-01-20',
    collectionDate: '2024-01-20',
    resultDate: '2024-01-20',
    status: 'final',
    results: [
      { name: 'Glucose', value: '185', unit: 'mg/dL', range: '70-100', status: 'high', critical: true },
      { name: 'Sodium', value: '142', unit: 'mEq/L', range: '136-145', status: 'normal' },
      { name: 'Potassium', value: '4.1', unit: 'mEq/L', range: '3.5-5.1', status: 'normal' },
      { name: 'Chloride', value: '101', unit: 'mEq/L', range: '98-107', status: 'normal' }
    ]
  }
};

export const TEST_MEDICATIONS = {
  hypertension_med: {
    id: 'med-001',
    patientId: 'test-patient-002',
    medication: 'Lisinopril 10mg',
    dosage: '10mg',
    frequency: 'Once daily',
    route: 'Oral',
    prescribedDate: '2024-01-15',
    prescriber: 'Dr. Sarah Johnson',
    status: 'active',
    quantity: 30,
    refills: 5,
    instructions: 'Take with or without food'
  },

  diabetes_med: {
    id: 'med-002',
    patientId: 'test-patient-002',
    medication: 'Metformin 500mg',
    dosage: '500mg',
    frequency: 'Twice daily',
    route: 'Oral',
    prescribedDate: '2024-01-15',
    prescriber: 'Dr. Sarah Johnson',
    status: 'active',
    quantity: 60,
    refills: 3,
    instructions: 'Take with meals'
  },

  pain_med: {
    id: 'med-003',
    patientId: 'test-patient-004',
    medication: 'Ibuprofen 400mg',
    dosage: '400mg',
    frequency: 'Every 6 hours as needed',
    route: 'Oral',
    prescribedDate: '2024-01-22',
    prescriber: 'Dr. Emergency Physician',
    status: 'active',
    quantity: 20,
    refills: 0,
    instructions: 'Take with food, do not exceed 1200mg in 24 hours'
  }
};

export const TEST_APPOINTMENTS = {
  upcoming_routine: {
    id: 'appt-001',
    patientId: 'test-patient-001',
    practitioner: 'Dr. Sarah Johnson',
    date: '2024-02-15',
    time: '10:00',
    duration: 30,
    type: 'Follow-up',
    status: 'scheduled',
    reason: 'Routine follow-up'
  },

  urgent_today: {
    id: 'appt-002',
    patientId: 'test-patient-002',
    practitioner: 'Dr. Sarah Johnson',
    date: '2024-01-22',
    time: '14:00',
    duration: 45,
    type: 'Urgent Care',
    status: 'confirmed',
    reason: 'Blood pressure check'
  },

  canceled_appointment: {
    id: 'appt-003',
    patientId: 'test-patient-003',
    practitioner: 'Dr. Pediatrician',
    date: '2024-01-25',
    time: '11:00',
    duration: 20,
    type: 'Well Child',
    status: 'cancelled',
    reason: 'Annual wellness visit'
  }
};

// Helper functions to get test data
export const getTestPatient = (patientType: keyof typeof TEST_PATIENTS) => {
  return TEST_PATIENTS[patientType];
};

export const getTestEncounter = (encounterType: keyof typeof TEST_ENCOUNTERS) => {
  return TEST_ENCOUNTERS[encounterType];
};

export const getTestLabResult = (labType: keyof typeof TEST_LAB_RESULTS) => {
  return TEST_LAB_RESULTS[labType];
};

export const getTestMedication = (medType: keyof typeof TEST_MEDICATIONS) => {
  return TEST_MEDICATIONS[medType];
};

export const getTestAppointment = (apptType: keyof typeof TEST_APPOINTMENTS) => {
  return TEST_APPOINTMENTS[apptType];
};

// Get all test patient IDs for cleanup
export const getAllTestPatientIds = () => {
  return Object.values(TEST_PATIENTS).map(patient => patient.id);
};