# OmniCare EMR - API Documentation

## Overview

The OmniCare EMR API provides a comprehensive set of RESTful endpoints for healthcare data management. All endpoints follow FHIR R4 specifications and support standard HTTP methods.

## Base URLs

- **Production**: `https://api.omnicare.health`
- **Staging**: `https://api-staging.omnicare.health`
- **Development**: `http://localhost:3000`

## Authentication

### OAuth 2.0 Flow

OmniCare uses OAuth 2.0 with SMART on FHIR extensions for authentication.

#### Authorization Endpoint
```
GET /oauth/authorize
```

**Parameters:**
- `response_type`: `code` (required)
- `client_id`: Your application's client ID (required)
- `redirect_uri`: Your application's redirect URI (required)
- `scope`: Space-delimited list of scopes (required)
  - Example: `patient/*.read user/*.* launch/patient offline_access`
- `state`: Opaque value for CSRF protection (required)
- `aud`: FHIR server base URL (required)

**Example Request:**
```
https://api.omnicare.health/oauth/authorize?
  response_type=code&
  client_id=my-app-id&
  redirect_uri=https://myapp.com/callback&
  scope=patient/*.read user/*.*&
  state=abc123&
  aud=https://api.omnicare.health/fhir
```

#### Token Endpoint
```
POST /oauth/token
```

**Headers:**
```
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(client_id:client_secret)}
```

**Body Parameters:**
- `grant_type`: `authorization_code` or `refresh_token`
- `code`: Authorization code (for authorization_code grant)
- `refresh_token`: Refresh token (for refresh_token grant)
- `redirect_uri`: Must match the authorization request

**Example Request:**
```bash
curl -X POST https://api.omnicare.health/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic bXktYXBwLWlkOm15LXNlY3JldA==" \
  -d "grant_type=authorization_code&code=abc123&redirect_uri=https://myapp.com/callback"
```

**Example Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "scope": "patient/*.read user/*.*",
  "patient": "123"
}
```

### API Key Authentication

For server-to-server integrations, API key authentication is available.

**Headers:**
```
X-API-Key: your-api-key
```

## FHIR Resources

### Patient Resource

#### Search Patients
```
GET /fhir/Patient
```

**Parameters:**
- `name`: Search by patient name
- `given`: Search by given name
- `family`: Search by family name
- `identifier`: Search by identifier (MRN, SSN, etc.)
- `birthdate`: Search by birth date (YYYY-MM-DD)
- `gender`: Search by gender (male, female, other)
- `_count`: Number of results per page (default: 20, max: 100)
- `_offset`: Pagination offset

**Example Request:**
```bash
curl -X GET "https://api.omnicare.health/fhir/Patient?name=Smith&_count=10" \
  -H "Authorization: Bearer {access_token}"
```

**Example Response:**
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 23,
  "entry": [
    {
      "fullUrl": "https://api.omnicare.health/fhir/Patient/123",
      "resource": {
        "resourceType": "Patient",
        "id": "123",
        "meta": {
          "versionId": "1",
          "lastUpdated": "2025-01-15T10:30:00Z"
        },
        "identifier": [
          {
            "system": "http://omnicare.health/mrn",
            "value": "MRN123456"
          }
        ],
        "name": [
          {
            "use": "official",
            "family": "Smith",
            "given": ["John", "Michael"]
          }
        ],
        "birthDate": "1980-05-15",
        "gender": "male"
      }
    }
  ]
}
```

#### Create Patient
```
POST /fhir/Patient
```

**Headers:**
```
Content-Type: application/fhir+json
Authorization: Bearer {access_token}
```

**Example Request Body:**
```json
{
  "resourceType": "Patient",
  "identifier": [
    {
      "system": "http://omnicare.health/mrn",
      "value": "MRN789012"
    }
  ],
  "name": [
    {
      "use": "official",
      "family": "Johnson",
      "given": ["Sarah", "Elizabeth"]
    }
  ],
  "telecom": [
    {
      "system": "phone",
      "value": "(555) 123-4567",
      "use": "mobile"
    },
    {
      "system": "email",
      "value": "sarah.johnson@email.com"
    }
  ],
  "birthDate": "1985-03-20",
  "gender": "female",
  "address": [
    {
      "use": "home",
      "line": ["123 Main Street"],
      "city": "Boston",
      "state": "MA",
      "postalCode": "02101"
    }
  ]
}
```

#### Update Patient
```
PUT /fhir/Patient/{id}
```

**Headers:**
```
Content-Type: application/fhir+json
Authorization: Bearer {access_token}
```

#### Delete Patient
```
DELETE /fhir/Patient/{id}
```

### Encounter Resource

#### Create Encounter
```
POST /fhir/Encounter
```

**Example Request Body:**
```json
{
  "resourceType": "Encounter",
  "status": "in-progress",
  "class": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    "code": "AMB",
    "display": "ambulatory"
  },
  "type": [
    {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "308335008",
          "display": "Patient encounter procedure"
        }
      ]
    }
  ],
  "subject": {
    "reference": "Patient/123"
  },
  "participant": [
    {
      "type": [
        {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
              "code": "PPRF",
              "display": "primary performer"
            }
          ]
        }
      ],
      "individual": {
        "reference": "Practitioner/456"
      }
    }
  ],
  "period": {
    "start": "2025-01-15T09:00:00Z"
  }
}
```

### Observation Resource

#### Create Vital Signs
```
POST /fhir/Observation
```

**Example Request Body:**
```json
{
  "resourceType": "Observation",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "vital-signs",
          "display": "Vital Signs"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "85354-9",
        "display": "Blood pressure panel"
      }
    ]
  },
  "subject": {
    "reference": "Patient/123"
  },
  "encounter": {
    "reference": "Encounter/789"
  },
  "effectiveDateTime": "2025-01-15T10:30:00Z",
  "component": [
    {
      "code": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": "8480-6",
            "display": "Systolic blood pressure"
          }
        ]
      },
      "valueQuantity": {
        "value": 120,
        "unit": "mmHg",
        "system": "http://unitsofmeasure.org",
        "code": "mm[Hg]"
      }
    },
    {
      "code": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": "8462-4",
            "display": "Diastolic blood pressure"
          }
        ]
      },
      "valueQuantity": {
        "value": 80,
        "unit": "mmHg",
        "system": "http://unitsofmeasure.org",
        "code": "mm[Hg]"
      }
    }
  ]
}
```

### ServiceRequest Resource

#### Create Laboratory Order
```
POST /fhir/ServiceRequest
```

**Example Request Body:**
```json
{
  "resourceType": "ServiceRequest",
  "status": "active",
  "intent": "order",
  "priority": "routine",
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "2093-3",
        "display": "Cholesterol [Mass/volume] in Serum or Plasma"
      }
    ]
  },
  "subject": {
    "reference": "Patient/123"
  },
  "encounter": {
    "reference": "Encounter/789"
  },
  "requester": {
    "reference": "Practitioner/456"
  },
  "reasonCode": [
    {
      "text": "Annual physical exam"
    }
  ],
  "authoredOn": "2025-01-15T11:00:00Z"
}
```

## Custom Endpoints

### Clinical Summary

#### Get Patient Summary
```
GET /api/clinical/patients/{patientId}/summary
```

**Response:**
```json
{
  "patient": {
    "id": "123",
    "name": "John Smith",
    "birthDate": "1980-05-15",
    "age": 44,
    "gender": "male"
  },
  "vitalSigns": {
    "latest": {
      "bloodPressure": "120/80",
      "heartRate": 72,
      "temperature": 98.6,
      "timestamp": "2025-01-15T10:30:00Z"
    }
  },
  "activeMedications": [
    {
      "name": "Lisinopril",
      "dosage": "10mg",
      "frequency": "Once daily",
      "startDate": "2024-06-01"
    }
  ],
  "activeProblems": [
    {
      "code": "I10",
      "display": "Essential hypertension",
      "onsetDate": "2024-05-15"
    }
  ],
  "allergies": [
    {
      "substance": "Penicillin",
      "reaction": "Hives",
      "severity": "moderate"
    }
  ],
  "recentEncounters": [
    {
      "id": "789",
      "type": "Office Visit",
      "date": "2025-01-15",
      "provider": "Dr. Jane Doe"
    }
  ]
}
```

### Order Management

#### Get Order Status
```
GET /api/orders/{orderId}/status
```

**Response:**
```json
{
  "orderId": "ORD-12345",
  "status": "in-progress",
  "orderDate": "2025-01-15T11:00:00Z",
  "lastUpdated": "2025-01-15T14:30:00Z",
  "timeline": [
    {
      "timestamp": "2025-01-15T11:00:00Z",
      "status": "ordered",
      "user": "Dr. Jane Doe"
    },
    {
      "timestamp": "2025-01-15T11:30:00Z",
      "status": "specimen-collected",
      "user": "Nurse Smith"
    },
    {
      "timestamp": "2025-01-15T14:30:00Z",
      "status": "in-progress",
      "user": "Lab System"
    }
  ],
  "estimatedCompletionTime": "2025-01-15T16:00:00Z"
}
```

### Analytics

#### Get Practice Analytics
```
GET /api/analytics/practice
```

**Parameters:**
- `startDate`: Start date for analysis (YYYY-MM-DD)
- `endDate`: End date for analysis (YYYY-MM-DD)
- `metrics`: Comma-separated list of metrics

**Response:**
```json
{
  "period": {
    "start": "2025-01-01",
    "end": "2025-01-15"
  },
  "metrics": {
    "totalPatients": 1543,
    "newPatients": 87,
    "totalEncounters": 3421,
    "averageEncountersPerDay": 228,
    "topDiagnoses": [
      {
        "code": "I10",
        "display": "Essential hypertension",
        "count": 234
      },
      {
        "code": "E11.9",
        "display": "Type 2 diabetes mellitus",
        "count": 189
      }
    ],
    "providerProductivity": [
      {
        "providerId": "456",
        "name": "Dr. Jane Doe",
        "encounterCount": 234,
        "averageEncounterDuration": 18.5
      }
    ]
  }
}
```

## WebSocket API

### Real-time Updates

Connect to WebSocket endpoint for real-time updates:

```javascript
const ws = new WebSocket('wss://api.omnicare.health/ws');

ws.on('open', () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-access-token'
  }));
  
  // Subscribe to patient updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    resource: 'Patient',
    id: '123'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  switch(message.type) {
    case 'update':
      console.log('Resource updated:', message.resource);
      break;
    case 'error':
      console.error('Error:', message.error);
      break;
  }
});
```

### Supported Events

- `resource.created`: New resource created
- `resource.updated`: Resource updated
- `resource.deleted`: Resource deleted
- `order.status_changed`: Order status changed
- `result.available`: Lab result available
- `alert.critical`: Critical alert triggered

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "birthDate",
        "message": "Invalid date format"
      }
    ],
    "timestamp": "2025-01-15T10:30:00Z",
    "requestId": "req-123456"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |

## Rate Limiting

API requests are rate-limited to ensure fair usage:

- **Authenticated requests**: 1000 requests per hour
- **Unauthenticated requests**: 100 requests per hour
- **Burst limit**: 100 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642252800
```

## Pagination

List endpoints support pagination using the `_count` and `_offset` parameters:

```
GET /fhir/Patient?_count=20&_offset=40
```

Response includes pagination links:
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 150,
  "link": [
    {
      "relation": "self",
      "url": "https://api.omnicare.health/fhir/Patient?_count=20&_offset=40"
    },
    {
      "relation": "first",
      "url": "https://api.omnicare.health/fhir/Patient?_count=20&_offset=0"
    },
    {
      "relation": "previous",
      "url": "https://api.omnicare.health/fhir/Patient?_count=20&_offset=20"
    },
    {
      "relation": "next",
      "url": "https://api.omnicare.health/fhir/Patient?_count=20&_offset=60"
    },
    {
      "relation": "last",
      "url": "https://api.omnicare.health/fhir/Patient?_count=20&_offset=140"
    }
  ]
}
```

## API Versioning

The API uses URL versioning for major versions. The current version is v1.

Future versions will be available at:
- `https://api.omnicare.health/v2/fhir/Patient`

The `X-API-Version` header can be used to specify minor versions:
```
X-API-Version: 1.2
```

## SDK Examples

### JavaScript/TypeScript
```typescript
import { MedplumClient } from '@medplum/core';

const medplum = new MedplumClient({
  baseUrl: 'https://api.omnicare.health',
  clientId: 'your-client-id'
});

// Authenticate
await medplum.startLogin();

// Search patients
const patients = await medplum.searchResources('Patient', {
  name: 'Smith'
});

// Create observation
const observation = await medplum.createResource({
  resourceType: 'Observation',
  status: 'final',
  code: {
    coding: [{
      system: 'http://loinc.org',
      code: '8867-4',
      display: 'Heart rate'
    }]
  },
  valueQuantity: {
    value: 72,
    unit: 'beats/minute'
  },
  subject: { reference: 'Patient/123' }
});
```

### Python
```python
from fhirclient import client

settings = {
    'app_id': 'your-app-id',
    'api_base': 'https://api.omnicare.health/fhir'
}

smart = client.FHIRClient(settings=settings)

# Search patients
from fhirclient.models.patient import Patient
search = Patient.where({'name': 'Smith'})
patients = search.perform_resources(smart.server)

# Create observation
from fhirclient.models.observation import Observation
from fhirclient.models.quantity import Quantity

obs = Observation()
obs.status = 'final'
obs.code = {
    'coding': [{
        'system': 'http://loinc.org',
        'code': '8867-4',
        'display': 'Heart rate'
    }]
}
obs.valueQuantity = Quantity({
    'value': 72,
    'unit': 'beats/minute'
})
obs.subject = {'reference': 'Patient/123'}
obs.create(smart.server)
```

---

*For testing strategies, see the [Testing Strategy](./07-Testing-Strategy.md)*

*Document Version: 1.0.0*  
*Last Updated: ${new Date().toISOString().split('T')[0]}*  
*© 2025 OmniCare EMR - Proprietary and Confidential*