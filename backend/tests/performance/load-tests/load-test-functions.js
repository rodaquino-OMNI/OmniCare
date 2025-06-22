/**
 * Artillery Load Test Helper Functions
 * Custom functions for generating realistic test data
 */

const crypto = require('crypto');

module.exports = {
  // Generate random string for unique identifiers
  $randomString: function() {
    return crypto.randomBytes(8).toString('hex');
  },

  // Generate random gender
  $randomGender: function() {
    const genders = ['male', 'female', 'other', 'unknown'];
    return genders[Math.floor(Math.random() * genders.length)];
  },

  // Generate random float between min and max
  $randomFloat: function(min, max) {
    return (Math.random() * (max - min) + min).toFixed(1);
  },

  // Generate random integer between min and max
  $randomInt: function(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // Generate random facility ID
  $randomFacilityId: function() {
    const facilityIds = [
      'facility-001',
      'facility-002', 
      'facility-003',
      'facility-004',
      'facility-005'
    ];
    return facilityIds[Math.floor(Math.random() * facilityIds.length)];
  },

  // Generate random medication
  $randomMedication: function() {
    const medications = [
      {
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code: '213269',
        display: 'Acetaminophen 325 MG Oral Tablet'
      },
      {
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code: '308136',
        display: 'Ibuprofen 200 MG Oral Tablet'
      },
      {
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code: '198440',
        display: 'Aspirin 81 MG Oral Tablet'
      }
    ];
    return medications[Math.floor(Math.random() * medications.length)];
  },

  // Generate random vital sign code
  $randomVitalCode: function() {
    const vitalCodes = [
      { code: '8310-5', display: 'Body temperature' },
      { code: '8480-6', display: 'Systolic blood pressure' },
      { code: '8462-4', display: 'Diastolic blood pressure' },
      { code: '8867-4', display: 'Heart rate' },
      { code: '9279-1', display: 'Respiratory rate' },
      { code: '2708-6', display: 'Oxygen saturation' }
    ];
    return vitalCodes[Math.floor(Math.random() * vitalCodes.length)];
  },

  // Generate random date within last year
  $randomRecentDate: function() {
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const randomTime = oneYearAgo.getTime() + Math.random() * (now.getTime() - oneYearAgo.getTime());
    return new Date(randomTime).toISOString();
  },

  // Generate random birth date (adults)
  $randomBirthDate: function() {
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - Math.floor(Math.random() * 80) - 18; // 18-98 years old
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    return `${birthYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  },

  // Generate random encounter class
  $randomEncounterClass: function() {
    const classes = [
      { code: 'AMB', display: 'Ambulatory' },
      { code: 'EMER', display: 'Emergency' },
      { code: 'IMP', display: 'Inpatient' },
      { code: 'OBSENC', display: 'Observation Encounter' }
    ];
    return classes[Math.floor(Math.random() * classes.length)];
  },

  // Generate random diagnosis code
  $randomDiagnosisCode: function() {
    const diagnoses = [
      { code: 'Z00.00', display: 'Encounter for general adult medical examination without abnormal findings' },
      { code: 'I10', display: 'Essential hypertension' },
      { code: 'E11.9', display: 'Type 2 diabetes mellitus without complications' },
      { code: 'M79.3', display: 'Panniculitis, unspecified' },
      { code: 'J06.9', display: 'Acute upper respiratory infection, unspecified' }
    ];
    return diagnoses[Math.floor(Math.random() * diagnoses.length)];
  },

  // Custom think time based on user behavior patterns
  customThinkTime: function(requestParams, context, ee, next) {
    // Simulate realistic user think time
    const thinkTimes = {
      'search': () => Math.random() * 2000 + 1000,     // 1-3 seconds for search
      'read': () => Math.random() * 5000 + 2000,       // 2-7 seconds reading
      'create': () => Math.random() * 10000 + 5000,    // 5-15 seconds creating
      'update': () => Math.random() * 8000 + 3000      // 3-11 seconds updating
    };

    const operation = requestParams.url.includes('?') ? 'search' : 
                     requestParams.method === 'GET' ? 'read' :
                     requestParams.method === 'POST' ? 'create' : 'update';

    const thinkTime = thinkTimes[operation] ? thinkTimes[operation]() : 2000;
    
    setTimeout(() => {
      return next();
    }, thinkTime);
  },

  // Set dynamic headers based on request type
  setDynamicHeaders: function(requestParams, context, ee, next) {
    // Add request tracing headers
    requestParams.headers = requestParams.headers || {};
    requestParams.headers['X-Request-ID'] = crypto.randomUUID();
    requestParams.headers['X-Session-ID'] = context.vars.sessionId || crypto.randomUUID();
    requestParams.headers['X-Test-Scenario'] = context.scenario || 'unknown';
    
    // Set session ID for tracking
    if (!context.vars.sessionId) {
      context.vars.sessionId = crypto.randomUUID();
    }
    
    return next();
  },

  // Custom metrics collection
  recordCustomMetrics: function(requestParams, response, context, ee, next) {
    // Record custom business metrics
    if (response.statusCode >= 200 && response.statusCode < 300) {
      ee.emit('counter', 'custom.requests.success', 1);
      
      // Track different operation types
      if (requestParams.url.includes('/fhir/R4/Patient')) {
        ee.emit('counter', 'custom.fhir.patient.operations', 1);
      } else if (requestParams.url.includes('/fhir/R4/Observation')) {
        ee.emit('counter', 'custom.fhir.observation.operations', 1);
      } else if (requestParams.url.includes('/analytics/')) {
        ee.emit('counter', 'custom.analytics.requests', 1);
      }
      
      // Track response size
      const responseSize = JSON.stringify(response.body || '').length;
      ee.emit('histogram', 'custom.response.size.bytes', responseSize);
      
    } else {
      ee.emit('counter', 'custom.requests.error', 1);
      ee.emit('counter', `custom.requests.error.${response.statusCode}`, 1);
    }
    
    return next();
  },

  // Validate FHIR response structure
  validateFHIRResponse: function(requestParams, response, context, ee, next) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      try {
        const body = JSON.parse(response.body);
        
        // Validate FHIR resource structure
        if (body.resourceType) {
          ee.emit('counter', `custom.fhir.${body.resourceType.toLowerCase()}.responses`, 1);
          
          // Validate required fields based on resource type
          if (body.resourceType === 'Bundle' && body.entry) {
            ee.emit('histogram', 'custom.fhir.bundle.entry.count', body.entry.length);
          }
          
          if (body.resourceType === 'Patient' && body.id) {
            ee.emit('counter', 'custom.fhir.patient.valid', 1);
          }
          
        } else if (requestParams.url.includes('/fhir/')) {
          // FHIR endpoint but no resourceType - might be an error
          ee.emit('counter', 'custom.fhir.invalid.response', 1);
        }
        
      } catch (parseError) {
        if (requestParams.url.includes('/fhir/')) {
          ee.emit('counter', 'custom.fhir.parse.error', 1);
        }
      }
    }
    
    return next();
  },

  // Generate realistic patient data
  generatePatientData: function(context, events, done) {
    const firstName = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Lisa', 'Robert', 'Emily'];
    const lastName = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
    
    context.vars.patientData = {
      resourceType: 'Patient',
      name: [{
        given: [firstName[Math.floor(Math.random() * firstName.length)]],
        family: lastName[Math.floor(Math.random() * lastName.length)]
      }],
      gender: module.exports.$randomGender(),
      birthDate: module.exports.$randomBirthDate(),
      identifier: [{
        system: 'http://omnicare.com/patient-id',
        value: `LOAD-${module.exports.$randomString()}`
      }],
      telecom: [{
        system: 'phone',
        value: `555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        use: 'home'
      }]
    };
    
    return done();
  }
};