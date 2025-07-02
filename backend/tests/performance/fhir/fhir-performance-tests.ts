/**
 * FHIR API Performance Tests
 * Comprehensive performance testing for all FHIR endpoints
 */

import { performance } from 'perf_hooks';

import supertest from 'supertest';

import { PerformanceTestBase, TestConfiguration } from '../framework/performance-test-base';

export class FHIRPerformanceTests extends PerformanceTestBase {
  private app: any;
  private authToken: string = '';
  private testPatients: string[] = [];
  private testEncounters: string[] = [];

  constructor(app: any, config: TestConfiguration) {
    super(config);
    this.app = app;
  }

  /**
   * Setup test data and authentication
   */
  async setup(): Promise<void> {
    console.log('Setting up FHIR performance test environment...');
    
    // Authenticate
    await this.authenticate();
    
    // Create test data
    await this.createTestData();
    
    console.log('FHIR performance test setup completed');
  }

  /**
   * Authenticate and get token
   */
  private async authenticate(): Promise<void> {
    const response = await supertest(this.app)
      .post('/auth/login')
      .send({
        username: 'test@omnicare.com',
        password: 'testpassword123'
      });

    if (response.status === 200 && response.body.accessToken) {
      this.authToken = response.body.accessToken;
    } else {
      throw new Error('Failed to authenticate for performance tests');
    }
  }

  /**
   * Create test data for performance testing
   */
  private async createTestData(): Promise<void> {
    // Create test patients
    for (let i = 0; i < 50; i++) {
      const patient = {
        resourceType: 'Patient',
        name: [{
          given: [`TestPatient${i}`],
          family: 'Performance'
        }],
        gender: i % 2 === 0 ? 'male' : 'female',
        birthDate: '1990-01-01',
        identifier: [{
          system: 'http://omnicare.com/patient-id',
          value: `PERF-PAT-${i}`
        }]
      };

      const response = await supertest(this.app)
        .post('/fhir/R4/Patient')
        .set('Authorization', `Bearer ${this.authToken}`)
        .send(patient);

      if (response.status === 201) {
        this.testPatients.push(response.body.id);
      }
    }

    // Create test encounters
    for (let i = 0; i < 100; i++) {
      const patientId = this.testPatients[i % this.testPatients.length];
      const encounter = {
        resourceType: 'Encounter',
        status: 'finished',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'AMB',
          display: 'Ambulatory'
        },
        subject: { reference: `Patient/${patientId}` },
        period: {
          start: '2024-01-01T10:00:00Z',
          end: '2024-01-01T11:00:00Z'
        }
      };

      const response = await supertest(this.app)
        .post('/fhir/R4/Encounter')
        .set('Authorization', `Bearer ${this.authToken}`)
        .send(encounter);

      if (response.status === 201) {
        this.testEncounters.push(response.body.id);
      }
    }
  }

  /**
   * Test FHIR Patient CRUD operations
   */
  async testPatientCRUD(): Promise<void> {
    console.log('Starting Patient CRUD performance test...');
    this.startMonitoring();

    const promises: Promise<void>[] = [];
    const requestsPerWorker = Math.ceil(this.config.maxRequests || 1000 / this.config.concurrency);

    for (let worker = 0; worker < this.config.concurrency; worker++) {
      promises.push(this.patientCRUDWorker(requestsPerWorker));
    }

    await Promise.all(promises);
    await this.calculateMetrics();
  }

  private async patientCRUDWorker(requestCount: number): Promise<void> {
    for (let i = 0; i < requestCount; i++) {
      const operation = Math.floor(Math.random() * 4);
      const startTime = performance.now();
      let isError = false;

      try {
        switch (operation) {
          case 0: // CREATE
            await this.createPatient();
            break;
          case 1: // READ
            await this.readPatient();
            break;
          case 2: // UPDATE
            await this.updatePatient();
            break;
          case 3: // SEARCH
            await this.searchPatients();
            break;
        }
      } catch (error) {
        isError = true;
      }

      const responseTime = performance.now() - startTime;
      this.recordResponseTime(responseTime, isError);
    }
  }

  private async createPatient(): Promise<void> {
    const patient = {
      resourceType: 'Patient',
      name: [{
        given: [`Test${Date.now()}`],
        family: 'Performance'
      }],
      gender: Math.random() > 0.5 ? 'male' : 'female',
      birthDate: '1990-01-01'
    };

    const response = await supertest(this.app)
      .post('/fhir/R4/Patient')
      .set('Authorization', `Bearer ${this.authToken}`)
      .send(patient);

    if (response.status !== 201) {
      throw new Error(`Create patient failed: ${response.status}`);
    }
  }

  private async readPatient(): Promise<void> {
    if (this.testPatients.length === 0) return;
    
    const patientId = this.testPatients[Math.floor(Math.random() * this.testPatients.length)];
    const response = await supertest(this.app)
      .get(`/fhir/R4/Patient/${patientId}`)
      .set('Authorization', `Bearer ${this.authToken}`);

    if (response.status !== 200) {
      throw new Error(`Read patient failed: ${response.status}`);
    }
  }

  private async updatePatient(): Promise<void> {
    if (this.testPatients.length === 0) return;
    
    const patientId = this.testPatients[Math.floor(Math.random() * this.testPatients.length)];
    const updatedPatient = {
      resourceType: 'Patient',
      id: patientId,
      name: [{
        given: [`Updated${Date.now()}`],
        family: 'Performance'
      }],
      gender: 'other',
      birthDate: '1990-01-01'
    };

    const response = await supertest(this.app)
      .put(`/fhir/R4/Patient/${patientId}`)
      .set('Authorization', `Bearer ${this.authToken}`)
      .send(updatedPatient);

    if (response.status !== 200) {
      throw new Error(`Update patient failed: ${response.status}`);
    }
  }

  private async searchPatients(): Promise<void> {
    const searchParams = [
      '?name=Performance',
      '?gender=male',
      '?birthdate=1990-01-01',
      '?_count=20'
    ];
    
    const params = searchParams[Math.floor(Math.random() * searchParams.length)];
    const response = await supertest(this.app)
      .get(`/fhir/R4/Patient${params}`)
      .set('Authorization', `Bearer ${this.authToken}`);

    if (response.status !== 200) {
      throw new Error(`Search patients failed: ${response.status}`);
    }
  }

  /**
   * Test FHIR Observation performance
   */
  async testObservationPerformance(): Promise<void> {
    console.log('Starting Observation performance test...');
    this.startMonitoring();

    const promises: Promise<void>[] = [];
    const requestsPerWorker = Math.ceil(this.config.maxRequests || 1000 / this.config.concurrency);

    for (let worker = 0; worker < this.config.concurrency; worker++) {
      promises.push(this.observationWorker(requestsPerWorker));
    }

    await Promise.all(promises);
    await this.calculateMetrics();
  }

  private async observationWorker(requestCount: number): Promise<void> {
    for (let i = 0; i < requestCount; i++) {
      const startTime = performance.now();
      let isError = false;

      try {
        await this.createVitalSigns();
      } catch (error) {
        isError = true;
      }

      const responseTime = performance.now() - startTime;
      this.recordResponseTime(responseTime, isError);
    }
  }

  private async createVitalSigns(): Promise<void> {
    if (this.testPatients.length === 0 || this.testEncounters.length === 0) return;

    const patientId = this.testPatients[Math.floor(Math.random() * this.testPatients.length)];
    const encounterId = this.testEncounters[Math.floor(Math.random() * this.testEncounters.length)];

    const vitals = {
      temperature: 98.6 + (Math.random() * 4 - 2),
      bloodPressureSystolic: 120 + Math.floor(Math.random() * 40),
      bloodPressureDiastolic: 80 + Math.floor(Math.random() * 20),
      heartRate: 70 + Math.floor(Math.random() * 30),
      respiratoryRate: 16 + Math.floor(Math.random() * 8),
      oxygenSaturation: 95 + Math.floor(Math.random() * 5)
    };

    const response = await supertest(this.app)
      .post(`/api/vitals/${patientId}`)
      .set('Authorization', `Bearer ${this.authToken}`)
      .send({
        encounterId,
        vitals
      });

    if (response.status !== 201) {
      throw new Error(`Create vital signs failed: ${response.status}`);
    }
  }

  /**
   * Test FHIR Batch operations
   */
  async testBatchOperations(): Promise<void> {
    console.log('Starting Batch operations performance test...');
    this.startMonitoring();

    const promises: Promise<void>[] = [];
    const requestsPerWorker = Math.ceil((this.config.maxRequests || 100) / this.config.concurrency);

    for (let worker = 0; worker < this.config.concurrency; worker++) {
      promises.push(this.batchWorker(requestsPerWorker));
    }

    await Promise.all(promises);
    await this.calculateMetrics();
  }

  private async batchWorker(requestCount: number): Promise<void> {
    for (let i = 0; i < requestCount; i++) {
      const startTime = performance.now();
      let isError = false;

      try {
        await this.executeBatchBundle();
      } catch (error) {
        isError = true;
      }

      const responseTime = performance.now() - startTime;
      this.recordResponseTime(responseTime, isError);
    }
  }

  private async executeBatchBundle(): Promise<void> {
    const bundle = {
      resourceType: 'Bundle',
      type: 'batch',
      entry: [
        {
          request: {
            method: 'POST',
            url: 'Patient'
          },
          resource: {
            resourceType: 'Patient',
            name: [{
              given: [`BatchTest${Date.now()}`],
              family: 'Performance'
            }],
            gender: 'unknown',
            birthDate: '1990-01-01'
          }
        },
        {
          request: {
            method: 'POST',
            url: 'Observation'
          },
          resource: {
            resourceType: 'Observation',
            status: 'final',
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '8310-5',
                display: 'Body temperature'
              }]
            },
            subject: { reference: 'Patient/test' },
            valueQuantity: {
              value: 98.6,
              unit: '°F',
              system: 'http://unitsofmeasure.org',
              code: '[degF]'
            }
          }
        }
      ]
    };

    const response = await supertest(this.app)
      .post('/fhir/R4')
      .set('Authorization', `Bearer ${this.authToken}`)
      .send(bundle);

    if (response.status !== 200) {
      throw new Error(`Batch operation failed: ${response.status}`);
    }
  }

  /**
   * Test FHIR Search performance with complex queries
   */
  async testComplexSearch(): Promise<void> {
    console.log('Starting Complex Search performance test...');
    this.startMonitoring();

    const promises: Promise<void>[] = [];
    const requestsPerWorker = Math.ceil((this.config.maxRequests || 500) / this.config.concurrency);

    for (let worker = 0; worker < this.config.concurrency; worker++) {
      promises.push(this.complexSearchWorker(requestsPerWorker));
    }

    await Promise.all(promises);
    await this.calculateMetrics();
  }

  private async complexSearchWorker(requestCount: number): Promise<void> {
    const searchQueries = [
      '/fhir/R4/Patient?name=Performance&gender=male&_count=50',
      '/fhir/R4/Observation?category=vital-signs&date=gt2024-01-01&_count=100',
      '/fhir/R4/Encounter?status=finished&date=2024-01-01&_include=Encounter:patient',
      '/fhir/R4/Patient?_has:Observation:patient:category=vital-signs&_count=25',
      '/fhir/R4/Observation?subject:Patient.gender=male&code=8310-5&_sort=date'
    ];

    for (let i = 0; i < requestCount; i++) {
      const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
      const startTime = performance.now();
      let isError = false;

      try {
        const response = await supertest(this.app)
          .get(query)
          .set('Authorization', `Bearer ${this.authToken}`);

        if (response.status !== 200) {
          throw new Error(`Complex search failed: ${response.status}`);
        }
      } catch (error) {
        isError = true;
      }

      const responseTime = performance.now() - startTime;
      this.recordResponseTime(responseTime, isError);
    }
  }

  /**
   * Test Patient $everything operation
   */
  async testPatientEverything(): Promise<void> {
    console.log('Starting Patient $everything performance test...');
    this.startMonitoring();

    const promises: Promise<void>[] = [];
    const requestsPerWorker = Math.ceil((this.config.maxRequests || 200) / this.config.concurrency);

    for (let worker = 0; worker < this.config.concurrency; worker++) {
      promises.push(this.patientEverythingWorker(requestsPerWorker));
    }

    await Promise.all(promises);
    await this.calculateMetrics();
  }

  private async patientEverythingWorker(requestCount: number): Promise<void> {
    for (let i = 0; i < requestCount; i++) {
      if (this.testPatients.length === 0) continue;

      const patientId = this.testPatients[Math.floor(Math.random() * this.testPatients.length)];
      const startTime = performance.now();
      let isError = false;

      try {
        const response = await supertest(this.app)
          .get(`/fhir/R4/Patient/${patientId}/$everything`)
          .set('Authorization', `Bearer ${this.authToken}`);

        if (response.status !== 200) {
          throw new Error(`Patient $everything failed: ${response.status}`);
        }
      } catch (error) {
        isError = true;
      }

      const responseTime = performance.now() - startTime;
      this.recordResponseTime(responseTime, isError);
    }
  }

  /**
   * Cleanup test data
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up FHIR performance test data...');
    
    // Note: In a real scenario, you might want to keep some test data
    // or use a separate test database that can be easily reset
    
    console.log('FHIR performance test cleanup completed');
  }
}