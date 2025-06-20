# OmniCare EMR API Documentation

## Overview

The OmniCare EMR API provides comprehensive access to clinical and administrative data through a RESTful, FHIR R4-compliant interface. This documentation covers authentication, resource management, integration patterns, and best practices for developers.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [FHIR Resources](#fhir-resources)
4. [API Endpoints](#api-endpoints)
5. [Integration Patterns](#integration-patterns)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Examples](#examples)

## Getting Started

### Base URL
```
Production: https://api.omnicare.health/fhir/R4
Staging: https://staging-api.omnicare.health/fhir/R4
Development: https://dev-api.omnicare.health/fhir/R4
```

### Prerequisites
- OAuth 2.0 client credentials
- SMART on FHIR application registration
- SSL/TLS certificate for production use
- Understanding of FHIR R4 specification

### Quick Start
```javascript
import { MedplumClient } from '@medplum/core';

const medplum = new MedplumClient({
  baseUrl: 'https://api.omnicare.health/fhir/R4',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret'
});

// Authenticate
await medplum.authenticate();

// Search for patients
const patients = await medplum.search('Patient', {
  name: 'Smith',
  _count: 10
});
```

## Authentication

### SMART on FHIR Flow

OmniCare EMR supports the full SMART on FHIR specification for secure authentication and authorization.

#### 1. Discovery
```http
GET /.well-known/smart_configuration
```

Response:
```json
{
  "issuer": "https://api.omnicare.health",
  "authorization_endpoint": "https://api.omnicare.health/oauth/authorize",
  "token_endpoint": "https://api.omnicare.health/oauth/token",
  "capabilities": [
    "launch-ehr",
    "launch-standalone", 
    "client-public",
    "client-confidential-symmetric",
    "context-ehr-patient",
    "context-ehr-encounter",
    "context-standalone-patient"
  ],
  "scopes_supported": [
    "patient/read",
    "patient/write",
    "user/read",
    "user/write",
    "launch/patient",
    "launch/encounter",
    "offline_access"
  ]
}
```

#### 2. Authorization Request
```http
GET /oauth/authorize?
  response_type=code&
  client_id=your-client-id&
  redirect_uri=https://your-app.com/callback&
  scope=patient/read user/read launch/patient&
  state=random-state-string&
  aud=https://api.omnicare.health/fhir/R4
```

#### 3. Token Exchange
```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=authorization-code&
redirect_uri=https://your-app.com/callback&
client_id=your-client-id&
client_secret=your-client-secret
```

Response:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "scope": "patient/read user/read launch/patient",
  "patient": "Patient/123",
  "user": "Practitioner/456"
}
```

### Client Credentials Flow
For server-to-server authentication:

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&
client_id=your-client-id&
client_secret=your-client-secret&
scope=system/read
```

### JWT Bearer Token
For enhanced security with signed JWTs:

```javascript
const jwt = require('jsonwebtoken');

const assertion = jwt.sign({
  iss: 'your-client-id',
  sub: 'your-client-id',
  aud: 'https://api.omnicare.health/oauth/token',
  exp: Math.floor(Date.now() / 1000) + 300,
  jti: 'unique-jwt-id'
}, privateKey, { algorithm: 'RS256' });

const tokenRequest = {
  grant_type: 'client_credentials',
  client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
  client_assertion: assertion,
  scope: 'system/read'
};
```

## FHIR Resources

### Core Clinical Resources

#### Patient Resource
Represents patient demographics and identifiers.

**Key Fields:**
- `identifier`: Patient identifiers (MRN, SSN, etc.)
- `name`: Patient names with use types
- `telecom`: Contact information
- `gender`: Administrative gender
- `birthDate`: Date of birth
- `address`: Patient addresses
- `contact`: Emergency contacts and relationships

**Example:**
```json
{
  "resourceType": "Patient",
  "id": "patient-123",
  "identifier": [{
    "use": "usual",
    "type": {
      "coding": [{
        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
        "code": "MR",
        "display": "Medical Record Number"
      }]
    },
    "system": "https://omnicare.health/patient-id",
    "value": "MRN12345"
  }],
  "name": [{
    "use": "official",
    "family": "Smith",
    "given": ["John", "David"]
  }],
  "telecom": [{
    "system": "phone",
    "value": "(555) 123-4567",
    "use": "home"
  }],
  "gender": "male",
  "birthDate": "1985-03-15"
}
```

#### Encounter Resource
Represents clinical visits and episodes of care.

**Key Fields:**
- `status`: Current status (planned, in-progress, finished)
- `class`: Type of encounter (inpatient, outpatient, emergency)
- `type`: Specific encounter type
- `subject`: Reference to Patient resource
- `participant`: Healthcare providers involved
- `period`: Start and end times
- `location`: Where the encounter took place

#### Observation Resource
Represents clinical observations including vital signs, lab results, and assessments.

**Key Fields:**
- `status`: Observation status (final, preliminary, amended)
- `category`: Type of observation (vital-signs, laboratory, survey)
- `code`: What was observed (LOINC, SNOMED codes)
- `subject`: Reference to Patient
- `encounter`: Reference to Encounter
- `value[x]`: Observed value (quantity, string, boolean, etc.)
- `interpretation`: Clinical significance

**Vital Signs Example:**
```json
{
  "resourceType": "Observation",
  "id": "vitals-bp-001",
  "status": "final",
  "category": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/observation-category",
      "code": "vital-signs",
      "display": "Vital Signs"
    }]
  }],
  "code": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "85354-9",
      "display": "Blood pressure panel"
    }]
  },
  "subject": {
    "reference": "Patient/patient-123"
  },
  "effectiveDateTime": "2024-01-15T10:30:00Z",
  "component": [{
    "code": {
      "coding": [{
        "system": "http://loinc.org",
        "code": "8480-6",
        "display": "Systolic blood pressure"
      }]
    },
    "valueQuantity": {
      "value": 120,
      "unit": "mmHg",
      "system": "http://unitsofmeasure.org",
      "code": "mm[Hg]"
    }
  }, {
    "code": {
      "coding": [{
        "system": "http://loinc.org",
        "code": "8462-4",
        "display": "Diastolic blood pressure"
      }]
    },
    "valueQuantity": {
      "value": 80,
      "unit": "mmHg",
      "system": "http://unitsofmeasure.org",
      "code": "mm[Hg]"
    }
  }]
}
```

#### Condition Resource
Represents patient problems, diagnoses, and conditions.

**Key Fields:**
- `clinicalStatus`: Active, inactive, resolved
- `verificationStatus`: Confirmed, provisional, differential
- `category`: Problem list item, encounter diagnosis
- `code`: Condition identification (ICD-10, SNOMED)
- `subject`: Reference to Patient
- `encounter`: Reference to Encounter
- `onsetDateTime`: When condition started
- `recordedDate`: When condition was recorded

#### MedicationRequest Resource
Represents prescription orders and medication requests.

**Key Fields:**
- `status`: Active, completed, cancelled
- `intent`: Order, plan, proposal
- `medicationCodeableConcept`: Medication identification
- `subject`: Reference to Patient
- `encounter`: Reference to Encounter
- `requester`: Prescribing provider
- `dosageInstruction`: How to take medication
- `dispenseRequest`: Prescription details

## API Endpoints

### Search Operations

#### Patient Search
```http
GET /Patient?name=Smith&birthdate=1985-03-15
GET /Patient?identifier=MRN12345
GET /Patient?_id=patient-123
```

**Search Parameters:**
- `name`: Patient name (fuzzy matching supported)
- `identifier`: Patient identifiers
- `birthdate`: Date of birth
- `gender`: Administrative gender
- `address`: Address components
- `telecom`: Phone or email

#### Observation Search
```http
GET /Observation?patient=Patient/123&category=vital-signs
GET /Observation?patient=Patient/123&code=http://loinc.org|8480-6
GET /Observation?patient=Patient/123&date=ge2024-01-01
```

**Search Parameters:**
- `patient`: Patient reference
- `category`: Observation category
- `code`: Observation code
- `date`: Observation date (supports ranges)
- `status`: Observation status

#### Encounter Search
```http
GET /Encounter?patient=Patient/123&status=in-progress
GET /Encounter?patient=Patient/123&date=2024-01-15
GET /Encounter?patient=Patient/123&class=inpatient
```

### CRUD Operations

#### Create Resource
```http
POST /Patient
Content-Type: application/fhir+json

{
  "resourceType": "Patient",
  "name": [{
    "use": "official",
    "family": "Doe",
    "given": ["Jane"]
  }],
  "gender": "female",
  "birthDate": "1990-05-20"
}
```

#### Read Resource
```http
GET /Patient/patient-123
```

#### Update Resource
```http
PUT /Patient/patient-123
Content-Type: application/fhir+json

{
  "resourceType": "Patient",
  "id": "patient-123",
  "name": [{
    "use": "official",
    "family": "Doe-Smith",
    "given": ["Jane"]
  }],
  "gender": "female",
  "birthDate": "1990-05-20"
}
```

#### Delete Resource
```http
DELETE /Patient/patient-123
```

### Batch Operations

#### Bundle Processing
```http
POST /
Content-Type: application/fhir+json

{
  "resourceType": "Bundle",
  "type": "batch",
  "entry": [{
    "request": {
      "method": "POST",
      "url": "Patient"
    },
    "resource": {
      "resourceType": "Patient",
      "name": [{"family": "Smith", "given": ["John"]}]
    }
  }, {
    "request": {
      "method": "POST", 
      "url": "Observation"
    },
    "resource": {
      "resourceType": "Observation",
      "status": "final",
      "code": {"text": "Blood pressure"},
      "subject": {"reference": "Patient/{{Patient.id}}"}
    }
  }]
}
```

## Integration Patterns

### EHR Integration

#### SMART Launch
```javascript
// EHR-launched application
const urlParams = new URLSearchParams(window.location.search);
const iss = urlParams.get('iss');
const launch = urlParams.get('launch');

const client = FHIR.oauth2.authorize({
  client_id: 'your-app-id',
  scope: 'patient/read launch/patient',
  iss: iss,
  launch: launch,
  redirect_uri: window.location.origin + '/callback'
});
```

#### Standalone Launch
```javascript
// Standalone application launch
const client = FHIR.oauth2.authorize({
  client_id: 'your-app-id',
  scope: 'patient/read user/read',
  iss: 'https://api.omnicare.health/fhir/R4',
  redirect_uri: window.location.origin + '/callback'
});
```

### Real-time Updates

#### FHIR Subscriptions
```json
{
  "resourceType": "Subscription",
  "status": "active",
  "criteria": "Observation?patient=Patient/123&category=vital-signs",
  "channel": {
    "type": "rest-hook",
    "endpoint": "https://your-app.com/webhook/observations",
    "payload": "application/fhir+json"
  }
}
```

#### WebSocket Connection
```javascript
const ws = new WebSocket('wss://api.omnicare.health/subscriptions');

ws.onmessage = function(event) {
  const notification = JSON.parse(event.data);
  // Handle real-time updates
  console.log('Resource updated:', notification);
};
```

### Bulk Data Export

#### System-level Export
```http
GET /$export?_type=Patient,Observation,Condition
```

#### Patient-level Export
```http
GET /Patient/$export?_type=Observation,Condition&patient=Patient/123
```

## Error Handling

### HTTP Status Codes

- `200 OK`: Successful operation
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request format
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation errors
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### Error Response Format

```json
{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "invalid",
    "details": {
      "text": "Patient identifier is required"
    },
    "location": ["Patient.identifier"]
  }]
}
```

### Common Error Scenarios

#### Authentication Errors
```json
{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "security",
    "details": {
      "text": "Invalid or expired access token"
    }
  }]
}
```

#### Validation Errors
```json
{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "required",
    "details": {
      "text": "Missing required field: Patient.name"
    },
    "location": ["Patient.name"]
  }]
}
```

## Rate Limiting

### Default Limits
- **Standard API calls**: 1000 requests per hour
- **Search operations**: 500 requests per hour
- **Batch operations**: 100 requests per hour
- **Bulk operations**: 10 requests per hour

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1643723400
```

### Handling Rate Limits
```javascript
async function makeRequest(url, options) {
  const response = await fetch(url, options);
  
  if (response.status === 429) {
    const resetTime = response.headers.get('X-RateLimit-Reset');
    const waitTime = (resetTime * 1000) - Date.now();
    
    console.log(`Rate limited. Waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    return makeRequest(url, options); // Retry
  }
  
  return response;
}
```

## Examples

### Complete Patient Workflow

```javascript
// 1. Create a new patient
const newPatient = await medplum.create('Patient', {
  resourceType: 'Patient',
  name: [{
    use: 'official',
    family: 'Johnson',
    given: ['Sarah', 'Marie']
  }],
  gender: 'female',
  birthDate: '1992-08-15',
  telecom: [{
    system: 'phone',
    value: '(555) 987-6543',
    use: 'mobile'
  }]
});

// 2. Create an encounter for the patient
const encounter = await medplum.create('Encounter', {
  resourceType: 'Encounter',
  status: 'in-progress',
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'AMB',
    display: 'ambulatory'
  },
  subject: {
    reference: `Patient/${newPatient.id}`
  },
  period: {
    start: new Date().toISOString()
  }
});

// 3. Record vital signs
const vitals = await medplum.create('Observation', {
  resourceType: 'Observation',
  status: 'final',
  category: [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/observation-category',
      code: 'vital-signs'
    }]
  }],
  code: {
    coding: [{
      system: 'http://loinc.org',
      code: '29463-7',
      display: 'Body weight'
    }]
  },
  subject: {
    reference: `Patient/${newPatient.id}`
  },
  encounter: {
    reference: `Encounter/${encounter.id}`
  },
  valueQuantity: {
    value: 65.5,
    unit: 'kg',
    system: 'http://unitsofmeasure.org',
    code: 'kg'
  }
});

// 4. Add a condition/diagnosis
const condition = await medplum.create('Condition', {
  resourceType: 'Condition',
  clinicalStatus: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
      code: 'active'
    }]
  },
  code: {
    coding: [{
      system: 'http://snomed.info/sct',
      code: '59621000',
      display: 'Essential hypertension'
    }]
  },
  subject: {
    reference: `Patient/${newPatient.id}`
  },
  encounter: {
    reference: `Encounter/${encounter.id}`
  },
  recordedDate: new Date().toISOString()
});

// 5. Prescribe medication
const medication = await medplum.create('MedicationRequest', {
  resourceType: 'MedicationRequest',
  status: 'active',
  intent: 'order',
  medicationCodeableConcept: {
    coding: [{
      system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
      code: '1998',
      display: 'Lisinopril'
    }]
  },
  subject: {
    reference: `Patient/${newPatient.id}`
  },
  encounter: {
    reference: `Encounter/${encounter.id}`
  },
  requester: {
    reference: 'Practitioner/provider-123'
  },
  dosageInstruction: [{
    text: 'Take 10mg by mouth once daily',
    route: {
      coding: [{
        system: 'http://snomed.info/sct',
        code: '26643006',
        display: 'Oral route'
      }]
    },
    doseAndRate: [{
      doseQuantity: {
        value: 10,
        unit: 'mg',
        system: 'http://unitsofmeasure.org',
        code: 'mg'
      }
    }]
  }]
});

console.log('Patient workflow completed:', {
  patient: newPatient.id,
  encounter: encounter.id,
  vitals: vitals.id,
  condition: condition.id,
  medication: medication.id
});
```

This comprehensive API documentation provides developers with everything needed to integrate with the OmniCare EMR system effectively and securely.