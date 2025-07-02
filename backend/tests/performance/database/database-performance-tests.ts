/**
 * Database Performance Tests
 * Tests for database query optimization and performance validation
 */

import { performance } from 'perf_hooks';

import { Pool, PoolClient } from 'pg';

import { PerformanceTestBase, TestConfiguration } from '../framework/performance-test-base';

export interface QueryPerformanceResult {
  query: string;
  executionTime: number;
  rowCount: number;
  planningTime?: number;
  executionTimeDetail?: number;
  bufferHits?: number;
  bufferMisses?: number;
}

export class DatabasePerformanceTests extends PerformanceTestBase {
  private pool: Pool;
  private testTablePrefix = 'perf_test_';

  constructor(config: TestConfiguration, databaseUrl: string) {
    super(config);
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  /**
   * Setup test database schema and data
   */
  async setup(): Promise<void> {
    console.log('Setting up database performance test environment...');
    
    await this.createTestTables();
    await this.populateTestData();
    await this.createIndexes();
    
    console.log('Database performance test setup completed');
  }

  /**
   * Create test tables mimicking FHIR resource structure
   */
  private async createTestTables(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Patients table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.testTablePrefix}patients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          resource_type VARCHAR(50) NOT NULL DEFAULT 'Patient',
          identifier JSONB,
          name JSONB,
          gender VARCHAR(20),
          birth_date DATE,
          address JSONB,
          telecom JSONB,
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          version_id INTEGER DEFAULT 1,
          meta JSONB
        )
      `);

      // Observations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.testTablePrefix}observations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          resource_type VARCHAR(50) NOT NULL DEFAULT 'Observation',
          status VARCHAR(20) NOT NULL,
          category JSONB,
          code JSONB NOT NULL,
          subject_id UUID REFERENCES ${this.testTablePrefix}patients(id),
          encounter_id UUID,
          effective_datetime TIMESTAMP,
          issued TIMESTAMP,
          performer JSONB,
          value_quantity JSONB,
          value_codeable_concept JSONB,
          value_string TEXT,
          value_boolean BOOLEAN,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          version_id INTEGER DEFAULT 1,
          meta JSONB
        )
      `);

      // Encounters table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.testTablePrefix}encounters (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          resource_type VARCHAR(50) NOT NULL DEFAULT 'Encounter',
          status VARCHAR(20) NOT NULL,
          class JSONB,
          type JSONB,
          subject_id UUID REFERENCES ${this.testTablePrefix}patients(id),
          participant JSONB,
          period_start TIMESTAMP,
          period_end TIMESTAMP,
          reason_code JSONB,
          service_provider JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          version_id INTEGER DEFAULT 1,
          meta JSONB
        )
      `);

      // Medication Requests table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.testTablePrefix}medication_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          resource_type VARCHAR(50) NOT NULL DEFAULT 'MedicationRequest',
          status VARCHAR(20) NOT NULL,
          intent VARCHAR(20) NOT NULL,
          category JSONB,
          priority VARCHAR(20),
          medication_codeable_concept JSONB,
          subject_id UUID REFERENCES ${this.testTablePrefix}patients(id),
          encounter_id UUID,
          authored_on TIMESTAMP,
          requester JSONB,
          reason_code JSONB,
          dosage_instruction JSONB,
          dispense_request JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          version_id INTEGER DEFAULT 1,
          meta JSONB
        )
      `);
    } finally {
      client.release();
    }
  }

  /**
   * Create performance-optimized indexes
   */
  private async createIndexes(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const indexes = [
        // Patient indexes
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}patients_name_gin ON ${this.testTablePrefix}patients USING GIN (name)`,
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}patients_identifier_gin ON ${this.testTablePrefix}patients USING GIN (identifier)`,
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}patients_gender ON ${this.testTablePrefix}patients (gender)`,
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}patients_birth_date ON ${this.testTablePrefix}patients (birth_date)`,
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}patients_active ON ${this.testTablePrefix}patients (active)`,
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}patients_created_at ON ${this.testTablePrefix}patients (created_at)`,
        
        // Observation indexes
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}observations_subject_id ON ${this.testTablePrefix}observations (subject_id)`,
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}observations_status ON ${this.testTablePrefix}observations (status)`,
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}observations_category_gin ON ${this.testTablePrefix}observations USING GIN (category)`,
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}observations_code_gin ON ${this.testTablePrefix}observations USING GIN (code)`,
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}observations_effective_datetime ON ${this.testTablePrefix}observations (effective_datetime)`,
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}observations_subject_effective ON ${this.testTablePrefix}observations (subject_id, effective_datetime)`,
        
        // Encounter indexes
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}encounters_subject_id ON ${this.testTablePrefix}encounters (subject_id)`,
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}encounters_status ON ${this.testTablePrefix}encounters (status)`,
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}encounters_period_start ON ${this.testTablePrefix}encounters (period_start)`,
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}encounters_period_end ON ${this.testTablePrefix}encounters (period_end)`,
        
        // Medication Request indexes
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}medication_requests_subject_id ON ${this.testTablePrefix}medication_requests (subject_id)`,
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}medication_requests_status ON ${this.testTablePrefix}medication_requests (status)`,
        `CREATE INDEX IF NOT EXISTS idx_${this.testTablePrefix}medication_requests_authored_on ON ${this.testTablePrefix}medication_requests (authored_on)`
      ];

      for (const indexQuery of indexes) {
        await client.query(indexQuery);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Populate test data for performance testing
   */
  private async populateTestData(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      console.log('Populating test data...');
      
      // Insert patients
      for (let i = 0; i < 10000; i++) {
        await client.query(`
          INSERT INTO ${this.testTablePrefix}patients 
          (identifier, name, gender, birth_date, active)
          VALUES 
          ($1, $2, $3, $4, $5)
        `, [
          JSON.stringify([{system: 'http://omnicare.com/patient-id', value: `PERF-${i}`}]),
          JSON.stringify([{given: [`Patient${i}`], family: 'Test'}]),
          i % 2 === 0 ? 'male' : 'female',
          new Date(1970 + Math.floor(Math.random() * 50), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          true
        ]);

        if (i % 1000 === 0) {
          console.log(`Inserted ${i} patients...`);
        }
      }

      // Get patient IDs for foreign key references
      const patientIds = await client.query(`SELECT id FROM ${this.testTablePrefix}patients LIMIT 1000`);
      const patientIdArray = patientIds.rows.map(row => row.id);

      // Insert observations (vital signs)
      for (let i = 0; i < 50000; i++) {
        const patientId = patientIdArray[Math.floor(Math.random() * patientIdArray.length)];
        await client.query(`
          INSERT INTO ${this.testTablePrefix}observations 
          (status, category, code, subject_id, effective_datetime, value_quantity)
          VALUES 
          ($1, $2, $3, $4, $5, $6)
        `, [
          'final',
          JSON.stringify([{coding: [{system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs'}]}]),
          JSON.stringify({coding: [{system: 'http://loinc.org', code: '8310-5', display: 'Body temperature'}]}),
          patientId,
          new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          JSON.stringify({value: 98.6 + (Math.random() * 4 - 2), unit: '°F'})
        ]);

        if (i % 5000 === 0) {
          console.log(`Inserted ${i} observations...`);
        }
      }

      // Insert encounters
      for (let i = 0; i < 20000; i++) {
        const patientId = patientIdArray[Math.floor(Math.random() * patientIdArray.length)];
        const startDate = new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
        const endDate = new Date(startDate.getTime() + Math.random() * 3600000); // Up to 1 hour later

        await client.query(`
          INSERT INTO ${this.testTablePrefix}encounters 
          (status, class, subject_id, period_start, period_end)
          VALUES 
          ($1, $2, $3, $4, $5)
        `, [
          'finished',
          JSON.stringify({system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB'}),
          patientId,
          startDate,
          endDate
        ]);

        if (i % 2000 === 0) {
          console.log(`Inserted ${i} encounters...`);
        }
      }

      console.log('Test data population completed');
    } finally {
      client.release();
    }
  }

  /**
   * Test patient search query performance
   */
  async testPatientSearchPerformance(): Promise<QueryPerformanceResult[]> {
    console.log('Testing patient search query performance...');
    
    const queries = [
      {
        name: 'Simple name search',
        query: `SELECT * FROM ${this.testTablePrefix}patients WHERE name @> '[{"given": ["Patient1"]}]'`,
      },
      {
        name: 'Gender filter',
        query: `SELECT * FROM ${this.testTablePrefix}patients WHERE gender = 'male' LIMIT 100`,
      },
      {
        name: 'Birth date range',
        query: `SELECT * FROM ${this.testTablePrefix}patients WHERE birth_date BETWEEN '1990-01-01' AND '2000-01-01' LIMIT 100`,
      },
      {
        name: 'Complex search with multiple filters',
        query: `
          SELECT * FROM ${this.testTablePrefix}patients 
          WHERE gender = 'female' 
          AND birth_date > '1980-01-01' 
          AND active = true 
          ORDER BY created_at DESC 
          LIMIT 50
        `,
      },
      {
        name: 'JSONB identifier search',
        query: `
          SELECT * FROM ${this.testTablePrefix}patients 
          WHERE identifier @> '[{"system": "http://omnicare.com/patient-id"}]'
          LIMIT 100
        `,
      }
    ];

    const results: QueryPerformanceResult[] = [];

    for (const testQuery of queries) {
      const result = await this.executeQueryPerformanceTest(testQuery.query, testQuery.name);
      results.push(result);
    }

    return results;
  }

  /**
   * Test observation query performance
   */
  async testObservationQueryPerformance(): Promise<QueryPerformanceResult[]> {
    console.log('Testing observation query performance...');
    
    const queries = [
      {
        name: 'Observations by patient',
        query: `
          SELECT o.* FROM ${this.testTablePrefix}observations o
          WHERE o.subject_id = (SELECT id FROM ${this.testTablePrefix}patients LIMIT 1)
          ORDER BY o.effective_datetime DESC
        `,
      },
      {
        name: 'Vital signs in date range',
        query: `
          SELECT * FROM ${this.testTablePrefix}observations 
          WHERE category @> '[{"coding": [{"code": "vital-signs"}]}]'
          AND effective_datetime BETWEEN '2023-01-01' AND '2023-12-31'
          LIMIT 1000
        `,
      },
      {
        name: 'Patient observations join',
        query: `
          SELECT p.name, o.code, o.value_quantity, o.effective_datetime
          FROM ${this.testTablePrefix}patients p
          JOIN ${this.testTablePrefix}observations o ON p.id = o.subject_id
          WHERE p.gender = 'male'
          AND o.effective_datetime > '2023-06-01'
          ORDER BY o.effective_datetime DESC
          LIMIT 500
        `,
      },
      {
        name: 'Aggregated vital signs by patient',
        query: `
          SELECT 
            subject_id,
            COUNT(*) as observation_count,
            MIN(effective_datetime) as first_observation,
            MAX(effective_datetime) as last_observation
          FROM ${this.testTablePrefix}observations
          WHERE category @> '[{"coding": [{"code": "vital-signs"}]}]'
          GROUP BY subject_id
          HAVING COUNT(*) > 10
          ORDER BY observation_count DESC
          LIMIT 100
        `,
      }
    ];

    const results: QueryPerformanceResult[] = [];

    for (const testQuery of queries) {
      const result = await this.executeQueryPerformanceTest(testQuery.query, testQuery.name);
      results.push(result);
    }

    return results;
  }

  /**
   * Test complex join queries
   */
  async testComplexJoinPerformance(): Promise<QueryPerformanceResult[]> {
    console.log('Testing complex join query performance...');
    
    const queries = [
      {
        name: 'Patient with latest observation',
        query: `
          SELECT DISTINCT ON (p.id) 
            p.id, p.name, o.effective_datetime, o.value_quantity
          FROM ${this.testTablePrefix}patients p
          LEFT JOIN ${this.testTablePrefix}observations o ON p.id = o.subject_id
          WHERE p.active = true
          ORDER BY p.id, o.effective_datetime DESC
          LIMIT 1000
        `,
      },
      {
        name: 'Patient encounter summary',
        query: `
          SELECT 
            p.id,
            p.name,
            COUNT(DISTINCT e.id) as encounter_count,
            COUNT(DISTINCT o.id) as observation_count,
            MAX(e.period_start) as last_encounter
          FROM ${this.testTablePrefix}patients p
          LEFT JOIN ${this.testTablePrefix}encounters e ON p.id = e.subject_id
          LEFT JOIN ${this.testTablePrefix}observations o ON p.id = o.subject_id
          WHERE p.active = true
          GROUP BY p.id, p.name
          HAVING COUNT(DISTINCT e.id) > 0
          ORDER BY encounter_count DESC
          LIMIT 100
        `,
      },
      {
        name: 'Patient care timeline',
        query: `
          SELECT 
            p.name,
            'encounter' as event_type,
            e.period_start as event_date,
            e.status as event_status
          FROM ${this.testTablePrefix}patients p
          JOIN ${this.testTablePrefix}encounters e ON p.id = e.subject_id
          WHERE p.gender = 'female'
          
          UNION ALL
          
          SELECT 
            p.name,
            'observation' as event_type,
            o.effective_datetime as event_date,
            o.status as event_status
          FROM ${this.testTablePrefix}patients p
          JOIN ${this.testTablePrefix}observations o ON p.id = o.subject_id
          WHERE p.gender = 'female'
          
          ORDER BY event_date DESC
          LIMIT 500
        `,
      }
    ];

    const results: QueryPerformanceResult[] = [];

    for (const testQuery of queries) {
      const result = await this.executeQueryPerformanceTest(testQuery.query, testQuery.name);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute a single query performance test
   */
  private async executeQueryPerformanceTest(query: string, name: string): Promise<QueryPerformanceResult> {
    const client = await this.pool.connect();
    
    try {
      // Enable query timing
      await client.query('SET track_io_timing = on');
      
      const startTime = performance.now();
      const result = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      const planData = result.rows[0]['QUERY PLAN'][0];
      
      return {
        query: name,
        executionTime,
        rowCount: planData['Plan']['Actual Rows'] || 0,
        planningTime: planData['Planning Time'],
        executionTimeDetail: planData['Execution Time'],
        bufferHits: this.extractBufferStats(planData, 'Shared Hit Blocks'),
        bufferMisses: this.extractBufferStats(planData, 'Shared Read Blocks')
      };
    } finally {
      client.release();
    }
  }

  /**
   * Extract buffer statistics from query plan
   */
  private extractBufferStats(planData: any, statName: string): number {
    try {
      return planData['Plan'][statName] || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Test concurrent database connections
   */
  async testConnectionPoolPerformance(): Promise<void> {
    console.log('Testing database connection pool performance...');
    this.startMonitoring();

    const promises: Promise<void>[] = [];
    const requestsPerWorker = Math.ceil((this.config.maxRequests || 1000) / this.config.concurrency);

    for (let worker = 0; worker < this.config.concurrency; worker++) {
      promises.push(this.connectionPoolWorker(requestsPerWorker));
    }

    await Promise.all(promises);
    await this.calculateMetrics();
  }

  private async connectionPoolWorker(requestCount: number): Promise<void> {
    for (let i = 0; i < requestCount; i++) {
      const startTime = performance.now();
      let isError = false;

      try {
        const client = await this.pool.connect();
        try {
          await client.query(`SELECT COUNT(*) FROM ${this.testTablePrefix}patients WHERE active = true`);
        } finally {
          client.release();
        }
      } catch (error) {
        isError = true;
      }

      const responseTime = performance.now() - startTime;
      this.recordResponseTime(responseTime, isError);
    }
  }

  /**
   * Generate database performance report
   */
  generateDatabaseReport(
    patientResults: QueryPerformanceResult[],
    observationResults: QueryPerformanceResult[],
    joinResults: QueryPerformanceResult[]
  ): string {
    const report = `
Database Performance Test Report
===============================

Patient Query Performance:
${this.formatQueryResults(patientResults)}

Observation Query Performance:
${this.formatQueryResults(observationResults)}

Complex Join Query Performance:
${this.formatQueryResults(joinResults)}

Connection Pool Performance:
${this.generateReport()}

Recommendations:
${this.generateOptimizationRecommendations(patientResults, observationResults, joinResults)}
    `.trim();

    return report;
  }

  private formatQueryResults(results: QueryPerformanceResult[]): string {
    return results.map(result => `
- ${result.query}:
  * Execution Time: ${result.executionTime.toFixed(2)}ms
  * Rows Returned: ${result.rowCount}
  * Planning Time: ${result.planningTime?.toFixed(2) || 'N/A'}ms
  * Buffer Hits: ${result.bufferHits || 'N/A'}
  * Buffer Misses: ${result.bufferMisses || 'N/A'}
    `).join('\n');
  }

  private generateOptimizationRecommendations(
    patientResults: QueryPerformanceResult[],
    observationResults: QueryPerformanceResult[],
    joinResults: QueryPerformanceResult[]
  ): string {
    const recommendations: string[] = [];
    
    const allResults = [...patientResults, ...observationResults, ...joinResults];
    const slowQueries = allResults.filter(r => r.executionTime > 1000); // > 1 second
    
    if (slowQueries.length > 0) {
      recommendations.push('- Consider optimizing slow queries (>1s execution time)');
      recommendations.push('- Review and add missing indexes for frequently accessed columns');
    }
    
    const highBufferMisses = allResults.filter(r => (r.bufferMisses || 0) > 1000);
    if (highBufferMisses.length > 0) {
      recommendations.push('- High buffer misses detected - consider increasing shared_buffers');
    }
    
    if (this.metrics.memoryUsage.heapUsed > 500) {
      recommendations.push('- High memory usage - monitor connection pool size and query complexity');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('- Database performance appears optimal');
    }
    
    return recommendations.join('\n');
  }

  /**
   * Cleanup test tables and data
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up database performance test data...');
    
    const client = await this.pool.connect();
    
    try {
      await client.query(`DROP TABLE IF EXISTS ${this.testTablePrefix}medication_requests CASCADE`);
      await client.query(`DROP TABLE IF EXISTS ${this.testTablePrefix}observations CASCADE`);
      await client.query(`DROP TABLE IF EXISTS ${this.testTablePrefix}encounters CASCADE`);
      await client.query(`DROP TABLE IF EXISTS ${this.testTablePrefix}patients CASCADE`);
    } finally {
      client.release();
    }
    
    await this.pool.end();
    console.log('Database performance test cleanup completed');
  }
}