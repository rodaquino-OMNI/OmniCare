# OmniCare EMR - Implementation Guide

## Development Environment Setup

### Prerequisites

#### Required Software
- **Node.js**: v18.0.0 or higher (LTS recommended)
- **PostgreSQL**: v15.0 or higher
- **Redis**: v7.0 or higher (optional for caching)
- **Docker**: v20.10 or higher
- **Git**: v2.30 or higher

#### Recommended Development Tools
- **VS Code** with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
  - Tailwind CSS IntelliSense
  - Prisma (for database management)
- **Postman** or **Insomnia** for API testing
- **pgAdmin** or **DBeaver** for database management
- **Redis Commander** for Redis management

### Initial Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/omnicare/omnicare-emr.git
cd omnicare-emr
```

#### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

#### 3. Environment Configuration

Create `.env` files in both backend and frontend directories:

**Backend `.env`**:
```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/omnicare_dev
DATABASE_POOL_MAX=10
DATABASE_POOL_MIN=2

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=omnicare:

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
SESSION_SECRET=your-session-secret-change-in-production

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key

# Medplum Configuration
MEDPLUM_BASE_URL=http://localhost:8103
MEDPLUM_CLIENT_ID=your-medplum-client-id
MEDPLUM_CLIENT_SECRET=your-medplum-client-secret

# External Services
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Feature Flags
ENABLE_OFFLINE_MODE=true
ENABLE_VOICE_RECOGNITION=false
ENABLE_AI_ASSISTANCE=false
```

**Frontend `.env.local`**:
```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_MEDPLUM_URL=http://localhost:8103
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3000

# Feature Flags
NEXT_PUBLIC_ENABLE_OFFLINE=true
NEXT_PUBLIC_ENABLE_PWA=true
NEXT_PUBLIC_ENABLE_ANALYTICS=false

# External Services
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_GA_TRACKING_ID=your-ga-id
```

#### 4. Database Setup

```bash
# Create database
createdb omnicare_dev

# Run migrations (from backend directory)
cd backend
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

#### 5. Start Development Servers

```bash
# From root directory
npm run dev

# Or start services individually:
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Core Module Implementation

### Patient Management Module

#### 1. Patient Search Implementation
```typescript
// frontend/src/components/patient/PatientSearch.tsx
import { useState, useCallback } from 'react';
import { TextInput, Button, Table } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useResourceSearch } from '@/hooks/useMedplumResource';
import { Patient } from '@medplum/fhirtypes';

export function PatientSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchTerm, 300);
  
  const { data: patients, isLoading } = useResourceSearch<Patient>(
    'Patient',
    {
      name: debouncedSearch,
      _count: 20,
      _sort: '-_lastUpdated'
    },
    {
      enabled: debouncedSearch.length > 2
    }
  );

  return (
    <div>
      <TextInput
        placeholder="Search patients by name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        mb="md"
      />
      
      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>MRN</th>
            <th>DOB</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {patients?.map((patient) => (
            <PatientRow key={patient.id} patient={patient} />
          ))}
        </tbody>
      </Table>
    </div>
  );
}
```

#### 2. Patient Demographics Form
```typescript
// frontend/src/components/patient/PatientDemographicsForm.tsx
import { useForm } from '@mantine/form';
import { TextInput, Select, DatePicker } from '@mantine/core';
import { Patient } from '@medplum/fhirtypes';
import { useMedplumClient } from '@/hooks/useMedplumClient';

interface PatientFormProps {
  patient?: Patient;
  onSave: (patient: Patient) => void;
}

export function PatientDemographicsForm({ patient, onSave }: PatientFormProps) {
  const medplum = useMedplumClient();
  
  const form = useForm({
    initialValues: {
      firstName: patient?.name?.[0]?.given?.[0] || '',
      lastName: patient?.name?.[0]?.family || '',
      birthDate: patient?.birthDate ? new Date(patient.birthDate) : null,
      gender: patient?.gender || '',
      phone: patient?.telecom?.find(t => t.system === 'phone')?.value || '',
      email: patient?.telecom?.find(t => t.system === 'email')?.value || ''
    }
  });

  const handleSubmit = async (values: typeof form.values) => {
    const patientResource: Patient = {
      resourceType: 'Patient',
      ...(patient?.id && { id: patient.id }),
      name: [{
        given: [values.firstName],
        family: values.lastName
      }],
      birthDate: values.birthDate?.toISOString().split('T')[0],
      gender: values.gender as Patient['gender'],
      telecom: [
        { system: 'phone', value: values.phone },
        { system: 'email', value: values.email }
      ]
    };

    const saved = patient?.id
      ? await medplum.updateResource(patientResource)
      : await medplum.createResource(patientResource);
      
    onSave(saved);
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <TextInput
        label="First Name"
        {...form.getInputProps('firstName')}
        required
      />
      <TextInput
        label="Last Name"
        {...form.getInputProps('lastName')}
        required
      />
      <DatePicker
        label="Date of Birth"
        {...form.getInputProps('birthDate')}
        required
      />
      <Select
        label="Gender"
        data={[
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
          { value: 'other', label: 'Other' }
        ]}
        {...form.getInputProps('gender')}
        required
      />
      <TextInput
        label="Phone"
        {...form.getInputProps('phone')}
      />
      <TextInput
        label="Email"
        type="email"
        {...form.getInputProps('email')}
      />
      <Button type="submit" mt="md">
        Save Patient
      </Button>
    </form>
  );
}
```

### Clinical Documentation Module

#### 1. Clinical Note Editor
```typescript
// frontend/src/components/clinical/ClinicalNoteEditor.tsx
import { useState } from 'react';
import { RichTextEditor } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { DocumentReference, Encounter } from '@medplum/fhirtypes';
import { useMedplumClient } from '@/hooks/useMedplumClient';

interface ClinicalNoteProps {
  encounter: Encounter;
  onSave: (note: DocumentReference) => void;
}

export function ClinicalNoteEditor({ encounter, onSave }: ClinicalNoteProps) {
  const medplum = useMedplumClient();
  const [saving, setSaving] = useState(false);
  
  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
  });

  const handleSave = async () => {
    if (!editor) return;
    
    setSaving(true);
    try {
      // Create the note content
      const noteContent = editor.getHTML();
      const noteBlob = new Blob([noteContent], { type: 'text/html' });
      
      // Upload the note content
      const binary = await medplum.createBinary(noteBlob, 'note.html', 'text/html');
      
      // Create DocumentReference
      const documentRef: DocumentReference = {
        resourceType: 'DocumentReference',
        status: 'current',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: '34133-9',
            display: 'Summary of encounter note'
          }]
        },
        subject: encounter.subject,
        context: {
          encounter: [{ reference: `Encounter/${encounter.id}` }]
        },
        date: new Date().toISOString(),
        content: [{
          attachment: {
            contentType: 'text/html',
            url: binary.url
          }
        }]
      };
      
      const saved = await medplum.createResource(documentRef);
      onSave(saved);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <RichTextEditor editor={editor}>
        <RichTextEditor.Toolbar>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Underline />
          </RichTextEditor.ControlsGroup>
          
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.H1 />
            <RichTextEditor.H2 />
            <RichTextEditor.H3 />
          </RichTextEditor.ControlsGroup>
          
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>
        
        <RichTextEditor.Content />
      </RichTextEditor>
      
      <Button onClick={handleSave} loading={saving} mt="md">
        Save Note
      </Button>
    </div>
  );
}
```

#### 2. Clinical Templates
```typescript
// backend/src/services/clinical-templates.service.ts
import { Questionnaire, QuestionnaireResponse } from '@medplum/fhirtypes';

export class ClinicalTemplateService {
  private templates: Map<string, Questionnaire> = new Map();

  constructor() {
    this.loadBuiltInTemplates();
  }

  private loadBuiltInTemplates() {
    // SOAP Note Template
    this.templates.set('soap-note', {
      resourceType: 'Questionnaire',
      id: 'soap-note',
      title: 'SOAP Note',
      status: 'active',
      item: [
        {
          linkId: 'subjective',
          text: 'Subjective',
          type: 'text'
        },
        {
          linkId: 'objective',
          text: 'Objective',
          type: 'text'
        },
        {
          linkId: 'assessment',
          text: 'Assessment',
          type: 'text'
        },
        {
          linkId: 'plan',
          text: 'Plan',
          type: 'text'
        }
      ]
    });

    // Review of Systems Template
    this.templates.set('review-of-systems', {
      resourceType: 'Questionnaire',
      id: 'review-of-systems',
      title: 'Review of Systems',
      status: 'active',
      item: [
        {
          linkId: 'constitutional',
          text: 'Constitutional Symptoms',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'negative', display: 'Negative' }},
            { valueCoding: { code: 'positive', display: 'Positive' }}
          ]
        },
        {
          linkId: 'cardiovascular',
          text: 'Cardiovascular',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'negative', display: 'Negative' }},
            { valueCoding: { code: 'positive', display: 'Positive' }}
          ]
        }
        // Add more systems...
      ]
    });
  }

  getTemplate(templateId: string): Questionnaire | undefined {
    return this.templates.get(templateId);
  }

  getAllTemplates(): Questionnaire[] {
    return Array.from(this.templates.values());
  }
}
```

### Order Management Module

#### 1. Laboratory Order Form
```typescript
// frontend/src/components/orders/LabOrderForm.tsx
import { useState } from 'react';
import { Select, MultiSelect, Button, Textarea } from '@mantine/core';
import { ServiceRequest, Patient } from '@medplum/fhirtypes';
import { useMedplumClient } from '@/hooks/useMedplumClient';

interface LabOrderFormProps {
  patient: Patient;
  onOrderCreated: (order: ServiceRequest) => void;
}

const LAB_TESTS = [
  { value: 'cbc', label: 'Complete Blood Count (CBC)' },
  { value: 'bmp', label: 'Basic Metabolic Panel (BMP)' },
  { value: 'lipid', label: 'Lipid Panel' },
  { value: 'tsh', label: 'Thyroid Stimulating Hormone (TSH)' },
  { value: 'hba1c', label: 'Hemoglobin A1c' }
];

export function LabOrderForm({ patient, onOrderCreated }: LabOrderFormProps) {
  const medplum = useMedplumClient();
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [priority, setPriority] = useState<string>('routine');
  const [clinicalInfo, setClinicalInfo] = useState('');
  const [ordering, setOrdering] = useState(false);

  const handleSubmit = async () => {
    setOrdering(true);
    try {
      const orders = await Promise.all(
        selectedTests.map(async (testCode) => {
          const test = LAB_TESTS.find(t => t.value === testCode);
          
          const order: ServiceRequest = {
            resourceType: 'ServiceRequest',
            status: 'active',
            intent: 'order',
            priority: priority as ServiceRequest['priority'],
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: testCode,
                display: test?.label
              }]
            },
            subject: { reference: `Patient/${patient.id}` },
            authoredOn: new Date().toISOString(),
            reasonCode: clinicalInfo ? [{
              text: clinicalInfo
            }] : undefined
          };
          
          return await medplum.createResource(order);
        })
      );
      
      onOrderCreated(orders[0]); // Return first order
    } finally {
      setOrdering(false);
    }
  };

  return (
    <div>
      <MultiSelect
        label="Select Lab Tests"
        data={LAB_TESTS}
        value={selectedTests}
        onChange={setSelectedTests}
        required
      />
      
      <Select
        label="Priority"
        value={priority}
        onChange={setPriority}
        data={[
          { value: 'routine', label: 'Routine' },
          { value: 'urgent', label: 'Urgent' },
          { value: 'asap', label: 'ASAP' },
          { value: 'stat', label: 'STAT' }
        ]}
        mt="md"
      />
      
      <Textarea
        label="Clinical Information"
        value={clinicalInfo}
        onChange={(e) => setClinicalInfo(e.target.value)}
        mt="md"
        rows={3}
      />
      
      <Button
        onClick={handleSubmit}
        loading={ordering}
        disabled={selectedTests.length === 0}
        mt="md"
      >
        Place Order
      </Button>
    </div>
  );
}
```

### Backend Service Implementation

#### 1. Clinical Service
```typescript
// backend/src/services/clinical.service.ts
import { MedplumClient } from '@medplum/core';
import { 
  Patient, 
  Encounter, 
  Condition, 
  Observation 
} from '@medplum/fhirtypes';

export class ClinicalService {
  constructor(private medplum: MedplumClient) {}

  async getPatientSummary(patientId: string) {
    const [patient, conditions, medications, allergies] = await Promise.all([
      this.medplum.readResource('Patient', patientId),
      this.medplum.search('Condition', {
        patient: patientId,
        'clinical-status': 'active',
        _count: 100
      }),
      this.medplum.search('MedicationRequest', {
        patient: patientId,
        status: 'active',
        _count: 100
      }),
      this.medplum.search('AllergyIntolerance', {
        patient: patientId,
        _count: 100
      })
    ]);

    return {
      patient,
      activeProblems: conditions.entry?.map(e => e.resource) || [],
      activeMedications: medications.entry?.map(e => e.resource) || [],
      allergies: allergies.entry?.map(e => e.resource) || []
    };
  }

  async recordVitalSigns(
    patientId: string,
    encounterId: string,
    vitals: {
      bloodPressure?: { systolic: number; diastolic: number };
      heartRate?: number;
      temperature?: number;
      respiratoryRate?: number;
      oxygenSaturation?: number;
    }
  ) {
    const observations: Observation[] = [];
    const timestamp = new Date().toISOString();

    if (vitals.bloodPressure) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '85354-9',
            display: 'Blood pressure panel'
          }]
        },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: timestamp,
        component: [
          {
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '8480-6',
                display: 'Systolic blood pressure'
              }]
            },
            valueQuantity: {
              value: vitals.bloodPressure.systolic,
              unit: 'mmHg'
            }
          },
          {
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '8462-4',
                display: 'Diastolic blood pressure'
              }]
            },
            valueQuantity: {
              value: vitals.bloodPressure.diastolic,
              unit: 'mmHg'
            }
          }
        ]
      });
    }

    // Add other vital signs...

    const results = await Promise.all(
      observations.map(obs => this.medplum.createResource(obs))
    );

    return results;
  }
}
```

#### 2. Order Service
```typescript
// backend/src/services/order.service.ts
import { MedplumClient } from '@medplum/core';
import { ServiceRequest, Task, Reference } from '@medplum/fhirtypes';
import { EventEmitter } from 'events';

export class OrderService extends EventEmitter {
  constructor(private medplum: MedplumClient) {
    super();
  }

  async createOrder(
    orderData: Partial<ServiceRequest>,
    practitionerId: string
  ): Promise<ServiceRequest> {
    const order: ServiceRequest = {
      resourceType: 'ServiceRequest',
      status: 'active',
      intent: 'order',
      ...orderData,
      requester: { reference: `Practitioner/${practitionerId}` },
      authoredOn: new Date().toISOString()
    };

    const created = await this.medplum.createResource(order);
    
    // Create associated task for tracking
    await this.createOrderTask(created);
    
    // Emit order created event
    this.emit('orderCreated', created);
    
    return created;
  }

  private async createOrderTask(order: ServiceRequest): Promise<Task> {
    const task: Task = {
      resourceType: 'Task',
      status: 'requested',
      intent: 'order',
      priority: order.priority || 'routine',
      for: order.subject,
      focus: { reference: `ServiceRequest/${order.id}` },
      authoredOn: new Date().toISOString(),
      description: `Process order: ${order.code?.text || 'Lab Order'}`
    };

    return await this.medplum.createResource(task);
  }

  async getOrderStatus(orderId: string) {
    const [order, tasks, results] = await Promise.all([
      this.medplum.readResource('ServiceRequest', orderId),
      this.medplum.search('Task', {
        focus: `ServiceRequest/${orderId}`
      }),
      this.medplum.search('DiagnosticReport', {
        'based-on': `ServiceRequest/${orderId}`
      })
    ]);

    return {
      order,
      tasks: tasks.entry?.map(e => e.resource) || [],
      results: results.entry?.map(e => e.resource) || []
    };
  }
}
```

### Database Optimization

#### 1. Custom Indexes
```sql
-- Patient search optimization
CREATE INDEX idx_patient_name_trgm 
ON "Patient" USING gin (
  (resource->>'name') gin_trgm_ops
);

-- Encounter performance
CREATE INDEX idx_encounter_patient_date 
ON "Encounter" (
  (resource->>'subject'),
  (resource->>'period')
);

-- Observation queries
CREATE INDEX idx_observation_patient_code_date 
ON "Observation" (
  (resource->>'subject'),
  (resource->'code'->>'coding'),
  (resource->>'effectiveDateTime') DESC
);

-- Service request tracking
CREATE INDEX idx_service_request_status_patient 
ON "ServiceRequest" (
  (resource->>'status'),
  (resource->>'subject'),
  (resource->>'authoredOn') DESC
);
```

#### 2. Query Optimization
```typescript
// backend/src/repositories/patient.repository.ts
export class PatientRepository {
  async searchPatients(criteria: {
    name?: string;
    birthdate?: string;
    identifier?: string;
  }) {
    const query = `
      SELECT resource
      FROM "Patient"
      WHERE 1=1
      ${criteria.name ? `
        AND (
          resource->>'name' ILIKE $1
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(resource->'name') n
            WHERE n->>'family' ILIKE $1
            OR EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(n->'given') g
              WHERE g ILIKE $1
            )
          )
        )
      ` : ''}
      ${criteria.birthdate ? `
        AND resource->>'birthDate' = $2
      ` : ''}
      ORDER BY resource->>'_lastUpdated' DESC
      LIMIT 100
    `;

    const params = [];
    if (criteria.name) params.push(`%${criteria.name}%`);
    if (criteria.birthdate) params.push(criteria.birthdate);

    return await this.db.query(query, params);
  }
}
```

## Testing Implementation

### Unit Testing
```typescript
// backend/src/services/__tests__/clinical.service.test.ts
import { ClinicalService } from '../clinical.service';
import { MockMedplumClient } from '@medplum/mock';

describe('ClinicalService', () => {
  let service: ClinicalService;
  let mockMedplum: MockMedplumClient;

  beforeEach(() => {
    mockMedplum = new MockMedplumClient();
    service = new ClinicalService(mockMedplum);
  });

  describe('getPatientSummary', () => {
    it('should return patient summary with all data', async () => {
      const patientId = 'test-patient-id';
      
      // Setup mock data
      const mockPatient = {
        resourceType: 'Patient',
        id: patientId,
        name: [{ given: ['John'], family: 'Doe' }]
      };
      
      mockMedplum.setResource(mockPatient);
      
      const summary = await service.getPatientSummary(patientId);
      
      expect(summary.patient).toEqual(mockPatient);
      expect(summary.activeProblems).toBeInstanceOf(Array);
      expect(summary.activeMedications).toBeInstanceOf(Array);
      expect(summary.allergies).toBeInstanceOf(Array);
    });
  });
});
```

### Integration Testing
```typescript
// backend/src/controllers/__tests__/patient.controller.integration.test.ts
import request from 'supertest';
import { app } from '../../app';
import { generateAuthToken } from '../../utils/auth';

describe('Patient Controller Integration', () => {
  let authToken: string;

  beforeAll(async () => {
    authToken = await generateAuthToken({
      id: 'test-user',
      role: 'physician'
    });
  });

  describe('GET /api/patients', () => {
    it('should return patients with valid auth', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should reject without auth', async () => {
      await request(app)
        .get('/api/patients')
        .expect(401);
    });
  });
});
```

## Deployment Preparation

### Build Process
```bash
# Backend build
cd backend
npm run build

# Frontend build
cd ../frontend
npm run build

# Docker build
docker build -t omnicare/backend:latest ./backend
docker build -t omnicare/frontend:latest ./frontend
```

### Health Checks
```typescript
// backend/src/controllers/health.controller.ts
export class HealthController {
  async check(req: Request, res: Response) {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMedplum()
    ]);

    const status = checks.every(c => c.status === 'fulfilled') 
      ? 'healthy' 
      : 'unhealthy';

    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database: checks[0].status === 'fulfilled' ? 'up' : 'down',
        redis: checks[1].status === 'fulfilled' ? 'up' : 'down',
        medplum: checks[2].status === 'fulfilled' ? 'up' : 'down'
      }
    });
  }
}
```

---

*For security guidelines, see the [Security Guidelines](./04-Security-Guidelines.md)*

*Document Version: 1.0.0*  
*Last Updated: ${new Date().toISOString().split('T')[0]}*  
*© 2025 OmniCare EMR - Proprietary and Confidential*