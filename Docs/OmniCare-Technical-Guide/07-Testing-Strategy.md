# OmniCare EMR - Testing Strategy

## Overview

OmniCare EMR employs a comprehensive testing strategy that ensures reliability, security, and performance while maintaining code quality and regulatory compliance. Our testing approach follows the testing pyramid pattern with emphasis on automated testing at all levels.

## Testing Pyramid

```
                    ┌─────────────────┐
                   │   E2E Tests      │  (Few but Critical)
                  │   Integration     │
                 │   Performance      │
                └─────────────────────┘
              ┌───────────────────────────┐
             │    Integration Tests       │  (More Comprehensive)
            │   API Testing               │
           │   Database Testing           │
          │   Service Integration         │
         └─────────────────────────────────┘
       ┌─────────────────────────────────────┐
      │          Unit Tests                   │  (Fast and Numerous)
     │      Component Testing                 │
    │      Service Logic Testing              │
   │      Utility Function Testing            │
  └─────────────────────────────────────────────┘
```

## Unit Testing

### Backend Unit Testing

#### 1. Jest Configuration
```typescript
// backend/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testTimeout: 10000
};
```

#### 2. Service Testing Example
```typescript
// backend/src/services/__tests__/patient.service.test.ts
import { PatientService } from '../patient.service';
import { MockMedplumClient } from '@medplum/mock';
import { Patient } from '@medplum/fhirtypes';

describe('PatientService', () => {
  let service: PatientService;
  let mockMedplum: MockMedplumClient;

  beforeEach(() => {
    mockMedplum = new MockMedplumClient();
    service = new PatientService(mockMedplum);
  });

  describe('searchPatients', () => {
    it('should return patients matching search criteria', async () => {
      // Arrange
      const mockPatients: Patient[] = [
        {
          resourceType: 'Patient',
          id: '123',
          name: [{ given: ['John'], family: 'Smith' }]
        }
      ];
      
      jest.spyOn(mockMedplum, 'searchResources').mockResolvedValue(mockPatients);

      // Act
      const result = await service.searchPatients({ name: 'Smith' });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name[0].family).toBe('Smith');
      expect(mockMedplum.searchResources).toHaveBeenCalledWith('Patient', {
        name: 'Smith'
      });
    });

    it('should handle search errors gracefully', async () => {
      // Arrange
      jest.spyOn(mockMedplum, 'searchResources').mockRejectedValue(
        new Error('Search failed')
      );

      // Act & Assert
      await expect(service.searchPatients({ name: 'Smith' }))
        .rejects.toThrow('Search failed');
    });
  });

  describe('createPatient', () => {
    it('should create patient with required fields', async () => {
      // Arrange
      const patientData = {
        firstName: 'Jane',
        lastName: 'Doe',
        birthDate: '1990-01-01',
        gender: 'female' as const
      };

      const expectedPatient: Patient = {
        resourceType: 'Patient',
        id: '456',
        name: [{ given: ['Jane'], family: 'Doe' }],
        birthDate: '1990-01-01',
        gender: 'female'
      };

      jest.spyOn(mockMedplum, 'createResource').mockResolvedValue(expectedPatient);

      // Act
      const result = await service.createPatient(patientData);

      // Assert
      expect(result).toEqual(expectedPatient);
      expect(mockMedplum.createResource).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'Patient',
          name: [{ given: ['Jane'], family: 'Doe' }]
        })
      );
    });
  });
});
```

#### 3. Repository Testing with Database
```typescript
// backend/src/repositories/__tests__/patient.repository.test.ts
import { PatientRepository } from '../patient.repository';
import { DatabaseService } from '../../services/database.service';
import { createTestDatabase, cleanupTestDatabase } from '../../test-utils/database';

describe('PatientRepository', () => {
  let repository: PatientRepository;
  let db: DatabaseService;

  beforeAll(async () => {
    db = await createTestDatabase();
    repository = new PatientRepository(db);
  });

  afterAll(async () => {
    await cleanupTestDatabase(db);
  });

  beforeEach(async () => {
    await db.query('BEGIN');
  });

  afterEach(async () => {
    await db.query('ROLLBACK');
  });

  describe('findByMRN', () => {
    it('should find patient by medical record number', async () => {
      // Arrange
      const mrn = 'MRN123456';
      await db.query(
        `INSERT INTO patient_search_index (patient_id, mrn, name_lower) 
         VALUES ($1, $2, $3)`,
        ['patient-123', mrn, 'john smith']
      );

      // Act
      const result = await repository.findByMRN(mrn);

      // Assert
      expect(result).toBeDefined();
      expect(result.patientId).toBe('patient-123');
      expect(result.mrn).toBe(mrn);
    });

    it('should return null for non-existent MRN', async () => {
      // Act
      const result = await repository.findByMRN('NONEXISTENT');

      // Assert
      expect(result).toBeNull();
    });
  });
});
```

### Frontend Unit Testing

#### 1. React Testing Library Setup
```typescript
// frontend/src/test-utils/test-providers.tsx
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { MockMedplumClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/react';

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  const mockMedplum = new MockMedplumClient();

  return (
    <QueryClientProvider client={queryClient}>
      <MedplumProvider medplum={mockMedplum}>
        <MantineProvider>
          {children}
        </MantineProvider>
      </MedplumProvider>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
```

#### 2. Component Testing Example
```typescript
// frontend/src/components/patient/__tests__/PatientCard.test.tsx
import { render, screen } from '@/test-utils/test-providers';
import { PatientCard } from '../PatientCard';
import { Patient } from '@medplum/fhirtypes';

describe('PatientCard', () => {
  const mockPatient: Patient = {
    resourceType: 'Patient',
    id: '123',
    name: [{ given: ['John'], family: 'Smith' }],
    birthDate: '1980-05-15',
    gender: 'male',
    identifier: [
      { system: 'http://omnicare.health/mrn', value: 'MRN123456' }
    ]
  };

  it('should render patient information correctly', () => {
    // Act
    render(<PatientCard patient={mockPatient} />);

    // Assert
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('MRN123456')).toBeInTheDocument();
    expect(screen.getByText('Male')).toBeInTheDocument();
    expect(screen.getByText('1980-05-15')).toBeInTheDocument();
  });

  it('should handle missing patient data gracefully', () => {
    // Arrange
    const incompletePatient: Patient = {
      resourceType: 'Patient',
      id: '456'
    };

    // Act
    render(<PatientCard patient={incompletePatient} />);

    // Assert
    expect(screen.getByText('Unknown Patient')).toBeInTheDocument();
  });

  it('should call onClick when card is clicked', () => {
    // Arrange
    const mockOnClick = jest.fn();
    render(<PatientCard patient={mockPatient} onClick={mockOnClick} />);

    // Act
    const card = screen.getByRole('button');
    card.click();

    // Assert
    expect(mockOnClick).toHaveBeenCalledWith(mockPatient);
  });
});
```

#### 3. Hook Testing
```typescript
// frontend/src/hooks/__tests__/usePatientData.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePatientData } from '../usePatientData';
import { MockMedplumClient } from '@medplum/mock';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('usePatientData', () => {
  it('should fetch patient data successfully', async () => {
    // Arrange
    const patientId = '123';
    const mockPatient = {
      resourceType: 'Patient',
      id: patientId,
      name: [{ given: ['John'], family: 'Smith' }]
    };

    // Mock the Medplum client
    jest.mocked(useMedplum).mockReturnValue({
      readResource: jest.fn().mockResolvedValue(mockPatient)
    } as any);

    // Act
    const { result } = renderHook(
      () => usePatientData(patientId),
      { wrapper: createWrapper() }
    );

    // Assert
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockPatient);
  });
});
```

## Integration Testing

### API Integration Tests

#### 1. Test Setup
```typescript
// backend/tests/integration/setup.ts
import { Application } from 'express';
import { createApp } from '../../src/app';
import { DatabaseService } from '../../src/services/database.service';
import { testConfig } from '../config/test.config';

export class TestServer {
  public app: Application;
  public db: DatabaseService;

  async start() {
    this.db = new DatabaseService(testConfig.database);
    await this.db.connect();
    
    this.app = createApp({ db: this.db });
    
    // Run migrations
    await this.db.migrate();
  }

  async stop() {
    await this.db.disconnect();
  }

  async reset() {
    await this.db.query('TRUNCATE TABLE audit_log CASCADE');
    await this.db.query('TRUNCATE TABLE patient_search_index CASCADE');
    // Reset other tables as needed
  }
}

export const testServer = new TestServer();
```

#### 2. Authentication Testing
```typescript
// backend/tests/integration/auth.test.ts
import request from 'supertest';
import { testServer } from './setup';
import { generateTestToken } from '../utils/auth-helpers';

describe('Authentication', () => {
  beforeAll(async () => {
    await testServer.start();
  });

  afterAll(async () => {
    await testServer.stop();
  });

  beforeEach(async () => {
    await testServer.reset();
  });

  describe('OAuth Flow', () => {
    it('should authenticate valid user', async () => {
      // Arrange
      const validToken = await generateTestToken({
        userId: 'test-user',
        role: 'physician'
      });

      // Act
      const response = await request(testServer.app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${validToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });

    it('should reject invalid token', async () => {
      // Act
      const response = await request(testServer.app)
        .get('/api/patients')
        .set('Authorization', 'Bearer invalid-token');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    it('should reject expired token', async () => {
      // Arrange
      const expiredToken = await generateTestToken(
        { userId: 'test-user' },
        { expiresIn: '-1h' }
      );

      // Act
      const response = await request(testServer.app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${expiredToken}`);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token expired');
    });
  });
});
```

#### 3. FHIR API Testing
```typescript
// backend/tests/integration/fhir.test.ts
import request from 'supertest';
import { testServer } from './setup';
import { createTestPatient, createAuthToken } from '../utils/test-helpers';

describe('FHIR API', () => {
  let authToken: string;

  beforeAll(async () => {
    await testServer.start();
    authToken = await createAuthToken({ role: 'physician' });
  });

  afterAll(async () => {
    await testServer.stop();
  });

  describe('Patient Resource', () => {
    it('should create patient with valid data', async () => {
      // Arrange
      const patientData = {
        resourceType: 'Patient',
        name: [{ given: ['John'], family: 'Doe' }],
        birthDate: '1980-01-01',
        gender: 'male'
      };

      // Act
      const response = await request(testServer.app)
        .post('/fhir/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/fhir+json')
        .send(patientData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.resourceType).toBe('Patient');
      expect(response.body.id).toBeDefined();
      expect(response.body.name[0].family).toBe('Doe');
    });

    it('should validate required fields', async () => {
      // Arrange
      const invalidPatient = {
        resourceType: 'Patient'
        // Missing required fields
      };

      // Act
      const response = await request(testServer.app)
        .post('/fhir/Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/fhir+json')
        .send(invalidPatient);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('validation');
    });
  });
});
```

### Database Integration Tests

```typescript
// backend/tests/integration/database.test.ts
import { DatabaseService } from '../../src/services/database.service';
import { Patient } from '@medplum/fhirtypes';

describe('Database Integration', () => {
  let db: DatabaseService;

  beforeAll(async () => {
    db = new DatabaseService(testConfig.database);
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe('Patient Search Index', () => {
    it('should update search index when patient is created', async () => {
      // Arrange
      const patient: Patient = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['Jane'], family: 'Smith' }],
        identifier: [{ value: 'MRN789' }]
      };

      // Act
      await db.query(
        'INSERT INTO "Patient" (id, resource) VALUES ($1, $2)',
        [patient.id, JSON.stringify(patient)]
      );

      // Trigger index update (would normally be done by trigger)
      await db.query(
        `INSERT INTO patient_search_index 
         (patient_id, mrn, name_lower) 
         VALUES ($1, $2, $3)`,
        [patient.id, 'MRN789', 'jane smith']
      );

      // Assert
      const result = await db.query(
        'SELECT * FROM patient_search_index WHERE patient_id = $1',
        [patient.id]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name_lower).toBe('jane smith');
    });
  });
});
```

## End-to-End Testing

### Playwright E2E Tests

#### 1. Test Configuration
```typescript
// frontend/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI
  }
});
```

#### 2. Patient Workflow Test
```typescript
// frontend/tests/e2e/patient-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Patient Management Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="username"]', 'test.physician@omnicare.health');
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    // Wait for dashboard
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should create new patient', async ({ page }) => {
    // Navigate to patient registration
    await page.click('[data-testid="patients-menu"]');
    await page.click('[data-testid="new-patient-button"]');

    // Fill patient form
    await page.fill('[data-testid="first-name"]', 'John');
    await page.fill('[data-testid="last-name"]', 'Doe');
    await page.fill('[data-testid="birth-date"]', '1980-01-01');
    await page.selectOption('[data-testid="gender"]', 'male');
    await page.fill('[data-testid="phone"]', '555-123-4567');

    // Submit form
    await page.click('[data-testid="save-patient"]');

    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="patient-name"]')).toContainText('John Doe');
  });

  test('should search for existing patient', async ({ page }) => {
    // Navigate to patient search
    await page.click('[data-testid="patients-menu"]');
    
    // Search for patient
    await page.fill('[data-testid="patient-search"]', 'Smith');
    await page.waitForTimeout(500); // Wait for debounced search

    // Verify results
    await expect(page.locator('[data-testid="patient-result"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="patient-result"]').first()).toContainText('Smith');
  });

  test('should create encounter and add vitals', async ({ page }) => {
    // Find and select patient
    await page.click('[data-testid="patients-menu"]');
    await page.fill('[data-testid="patient-search"]', 'John Doe');
    await page.click('[data-testid="patient-result"]');

    // Create new encounter
    await page.click('[data-testid="new-encounter"]');
    await page.selectOption('[data-testid="encounter-type"]', 'routine');
    await page.click('[data-testid="start-encounter"]');

    // Add vital signs
    await page.click('[data-testid="vitals-tab"]');
    await page.fill('[data-testid="systolic-bp"]', '120');
    await page.fill('[data-testid="diastolic-bp"]', '80');
    await page.fill('[data-testid="heart-rate"]', '72');
    await page.fill('[data-testid="temperature"]', '98.6');
    await page.click('[data-testid="save-vitals"]');

    // Verify vitals saved
    await expect(page.locator('[data-testid="vitals-summary"]')).toContainText('120/80');
    await expect(page.locator('[data-testid="vitals-summary"]')).toContainText('72');
  });
});
```

#### 3. Clinical Documentation Test
```typescript
// frontend/tests/e2e/clinical-documentation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Clinical Documentation', () => {
  test('should create and save clinical note', async ({ page }) => {
    // Setup - login and navigate to patient
    await page.goto('/login');
    await page.fill('[data-testid="username"]', 'test.physician@omnicare.health');
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');

    // Find patient and create encounter
    await page.click('[data-testid="patients-menu"]');
    await page.fill('[data-testid="patient-search"]', 'Test Patient');
    await page.click('[data-testid="patient-result"]');
    await page.click('[data-testid="new-encounter"]');

    // Create clinical note
    await page.click('[data-testid="documentation-tab"]');
    await page.click('[data-testid="new-note"]');

    // Fill note content
    const noteContent = 'Patient presents with routine follow-up. No acute concerns.';
    await page.fill('[data-testid="note-editor"]', noteContent);

    // Save note
    await page.click('[data-testid="save-note"]');

    // Verify note saved
    await expect(page.locator('[data-testid="note-list"]')).toContainText(noteContent);
    await expect(page.locator('[data-testid="note-status"]')).toContainText('Saved');
  });
});
```

## Performance Testing

### Load Testing with Artillery

#### 1. Artillery Configuration
```yaml
# backend/tests/performance/load-test.yml
config:
  target: 'https://api.omnicare.health'
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 300
      arrivalRate: 10
      name: "Sustained load"
    - duration: 60
      arrivalRate: 20
      name: "Peak load"
  variables:
    authToken: "{{ $processEnvironment.AUTH_TOKEN }}"

scenarios:
  - name: "Patient search workflow"
    weight: 60
    flow:
      - get:
          url: "/fhir/Patient"
          qs:
            name: "Smith"
            _count: 20
          headers:
            Authorization: "Bearer {{ authToken }}"
          expect:
            - statusCode: 200
            - hasProperty: "entry"

  - name: "Create observation"
    weight: 30
    flow:
      - post:
          url: "/fhir/Observation"
          headers:
            Authorization: "Bearer {{ authToken }}"
            Content-Type: "application/fhir+json"
          json:
            resourceType: "Observation"
            status: "final"
            code:
              coding:
                - system: "http://loinc.org"
                  code: "8867-4"
                  display: "Heart rate"
            valueQuantity:
              value: "{{ $randomInt(60, 100) }}"
              unit: "beats/minute"
            subject:
              reference: "Patient/test-patient"
          expect:
            - statusCode: 201

  - name: "Patient summary"
    weight: 10
    flow:
      - get:
          url: "/api/clinical/patients/test-patient/summary"
          headers:
            Authorization: "Bearer {{ authToken }}"
          expect:
            - statusCode: 200
            - hasProperty: "patient"
```

### Custom Performance Tests

#### 1. Database Performance
```typescript
// backend/tests/performance/database-performance.test.ts
import { DatabaseService } from '../../src/services/database.service';
import { performance } from 'perf_hooks';

describe('Database Performance', () => {
  let db: DatabaseService;

  beforeAll(async () => {
    db = new DatabaseService(testConfig.database);
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  test('patient search should complete within performance threshold', async () => {
    // Arrange
    const patientCount = 1000;
    await seedTestPatients(db, patientCount);

    // Act
    const startTime = performance.now();
    const results = await db.query(
      `SELECT * FROM patient_search_index 
       WHERE name_lower ILIKE $1 
       LIMIT 20`,
      ['%smith%']
    );
    const endTime = performance.now();

    // Assert
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(50); // 50ms threshold
    expect(results.rows.length).toBeGreaterThan(0);
  });

  test('bulk observation insertion should meet throughput requirements', async () => {
    // Arrange
    const observationCount = 1000;
    const observations = generateTestObservations(observationCount);

    // Act
    const startTime = performance.now();
    await db.transaction(async (client) => {
      for (const obs of observations) {
        await client.query(
          'INSERT INTO "Observation" (id, resource) VALUES ($1, $2)',
          [obs.id, JSON.stringify(obs)]
        );
      }
    });
    const endTime = performance.now();

    // Assert
    const duration = endTime - startTime;
    const throughput = observationCount / (duration / 1000); // per second
    expect(throughput).toBeGreaterThan(100); // 100 observations/second
  });
});
```

## Security Testing

### Authentication Security Tests

```typescript
// backend/tests/security/auth-security.test.ts
import request from 'supertest';
import { testServer } from '../integration/setup';

describe('Authentication Security', () => {
  beforeAll(async () => {
    await testServer.start();
  });

  afterAll(async () => {
    await testServer.stop();
  });

  test('should prevent SQL injection in login', async () => {
    // Arrange
    const maliciousInput = "'; DROP TABLE users; --";

    // Act
    const response = await request(testServer.app)
      .post('/auth/login')
      .send({
        username: maliciousInput,
        password: 'password'
      });

    // Assert
    expect(response.status).toBe(401);
    // Verify tables still exist
    const result = await testServer.db.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'users'"
    );
    expect(result.rows).toHaveLength(1);
  });

  test('should enforce rate limiting', async () => {
    // Act - Make multiple rapid requests
    const requests = Array(11).fill(null).map(() => 
      request(testServer.app)
        .post('/auth/login')
        .send({ username: 'test', password: 'wrong' })
    );

    const responses = await Promise.all(requests);

    // Assert
    const rateLimitedResponses = responses.filter(r => r.status === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });

  test('should sanitize user input', async () => {
    // Arrange
    const xssPayload = '<script>alert("xss")</script>';

    // Act
    const response = await request(testServer.app)
      .post('/fhir/Patient')
      .set('Authorization', 'Bearer valid-token')
      .send({
        resourceType: 'Patient',
        name: [{ given: [xssPayload], family: 'Test' }]
      });

    // Assert
    expect(response.body.name[0].given[0]).not.toContain('<script>');
  });
});
```

## Test Data Management

### Test Data Factory

```typescript
// tests/utils/test-data-factory.ts
import { faker } from '@faker-js/faker';
import { Patient, Observation, Encounter } from '@medplum/fhirtypes';

export class TestDataFactory {
  static createPatient(overrides?: Partial<Patient>): Patient {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    return {
      resourceType: 'Patient',
      id: faker.string.uuid(),
      identifier: [
        {
          system: 'http://omnicare.health/mrn',
          value: `MRN${faker.number.int({ min: 100000, max: 999999 })}`
        }
      ],
      name: [
        {
          use: 'official',
          given: [firstName],
          family: lastName
        }
      ],
      birthDate: faker.date.birthdate().toISOString().split('T')[0],
      gender: faker.person.sex() as Patient['gender'],
      telecom: [
        {
          system: 'phone',
          value: faker.phone.number(),
          use: 'mobile'
        },
        {
          system: 'email',
          value: faker.internet.email({ firstName, lastName })
        }
      ],
      ...overrides
    };
  }

  static createObservation(
    patientId: string,
    overrides?: Partial<Observation>
  ): Observation {
    return {
      resourceType: 'Observation',
      id: faker.string.uuid(),
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs'
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
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: faker.date.recent().toISOString(),
      valueQuantity: {
        value: faker.number.int({ min: 60, max: 100 }),
        unit: 'beats/minute'
      },
      ...overrides
    };
  }
}
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run backend unit tests
      run: cd backend && npm test
      env:
        DATABASE_URL: postgres://postgres:postgres@localhost:5432/test
    
    - name: Run frontend unit tests
      run: cd frontend && npm test
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Start services
      run: docker-compose -f docker-compose.test.yml up -d
    
    - name: Wait for services
      run: sleep 30
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Stop services
      run: docker-compose -f docker-compose.test.yml down

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Install Playwright
      run: npx playwright install
    
    - name: Start application
      run: npm run dev &
    
    - name: Wait for application
      run: npx wait-on http://localhost:3000
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
```

---

*For clinical workflows, see the [Clinical Workflows](./08-Clinical-Workflows.md)*

*Document Version: 1.0.0*  
*Last Updated: ${new Date().toISOString().split('T')[0]}*  
*© 2025 OmniCare EMR - Proprietary and Confidential*