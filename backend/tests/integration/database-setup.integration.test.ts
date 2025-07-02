/**
 * Database Setup Integration Test
 * Demonstrates and verifies test database utilities
 */

import { userFactory, sessionFactory, DatabaseSeeder } from '../factories/database.factory';
import { testDatabase, withTransaction, withCleanup } from '../utils/test-database.utils';
import { 
  withTestTransaction, 
  testQuery, 
  createTestData,
  verifyTestData 
} from '../utils/test-transaction.utils';

import { databaseService } from '@/services/database.service';

// Use real database for these tests
describe('Database Test Setup Integration', () => {
  beforeAll(async () => {
    // Ensure we're using real database
    process.env.MOCK_DATABASE = 'false';
    
    // Initialize database
    await testDatabase.initialize();
    await databaseService.initialize();
    await databaseService.ensureAuditSchema();
  });

  afterAll(async () => {
    await testDatabase.shutdown();
    await databaseService.shutdown();
  });

  describe('Basic Database Operations', () => {
    it('should connect to test database', async () => {
      const result = await databaseService.query('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    });

    it('should have required schemas', async () => {
      const result = await databaseService.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name IN ('public', 'audit')
      `);
      
      const schemas = result.rows.map(r => r.schema_name);
      expect(schemas).toContain('public');
      expect(schemas).toContain('audit');
    });

    it('should have UUID extension', async () => {
      const result = await databaseService.query(`
        SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp'
      `);
      
      expect(result.rows.length).toBe(1);
    });
  });

  describe('Transaction Isolation', () => {
    const transactionalTest = withTestTransaction(it);

    transactionalTest('should rollback changes after test', async () => {
      // Create test data within transaction
      const user = await createTestData('users', userFactory.build());
      
      // Verify it exists in transaction
      const exists = await verifyTestData('users', { id: user.id });
      expect(exists).toBe(true);
      
      // Data will be rolled back automatically after test
    });

    it('should not see rolled back data', async () => {
      // This runs after the previous test
      // The user created in the transaction should not exist
      const result = await databaseService.query(
        'SELECT COUNT(*) FROM users WHERE email LIKE $1',
        ['%faker%']
      );
      
      expect(parseInt(result.rows[0].count)).toBe(0);
    });
  });

  describe('Test Data Factories', () => {
    it('should create test users with factory', async () => {
      await withTransaction(async (client) => {
        // Create admin user
        const admin = userFactory.buildAdmin();
        
        const result = await client.query(
          `INSERT INTO users (username, email, password_hash, first_name, last_name, role)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [admin.username, admin.email, admin.password_hash, 
           admin.first_name, admin.last_name, admin.role]
        );
        
        expect(result.rows[0].role).toBe('SYSTEM_ADMINISTRATOR');
        expect(result.rows[0].email).toContain('@omnicare.com');
      });
    });

    it('should create test sessions with factory', async () => {
      await withTransaction(async (client) => {
        // First create a user
        const user = await testDatabase.createTestUser();
        
        // Create session for the user
        const session = sessionFactory.build(user.id);
        
        const result = await client.query(
          `INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [session.user_id, session.token_hash, session.expires_at, 
           session.ip_address, session.user_agent]
        );
        
        expect(result.rows[0].user_id).toBe(user.id);
        expect(result.rows[0]).toHaveProperty('id');
      });
    });
  });

  describe('Database Seeder', () => {
    it('should seed multiple users and related data', async () => {
      await withTransaction(async (client) => {
        const seedData = await DatabaseSeeder.seedAll(client);
        
        // Verify seeded data
        expect(seedData.users.length).toBeGreaterThanOrEqual(10);
        expect(seedData.sessions.length).toBeGreaterThan(0);
        expect(seedData.auditLogs.length).toBeGreaterThan(0);
        
        // Verify data in database
        const userCount = await client.query('SELECT COUNT(*) FROM users');
        expect(parseInt(userCount.rows[0].count)).toBeGreaterThanOrEqual(10);
      });
    });
  });

  describe('Cleanup Utilities', () => {
    it('should cleanup test data after test with cleanup handler', async () => {
      let testUserId: string;
      
      await withCleanup(
        async () => {
          // Create test data
          const user = await testDatabase.createTestUser({
            email: 'cleanup-test@test.com'
          });
          testUserId = user.id;
          
          // Verify it exists
          const result = await databaseService.query(
            'SELECT id FROM users WHERE id = $1',
            [testUserId]
          );
          expect(result.rows.length).toBe(1);
        },
        async () => {
          // Cleanup function
          await databaseService.query(
            'DELETE FROM users WHERE id = $1',
            [testUserId]
          );
        }
      );
      
      // Verify cleanup happened
      const result = await databaseService.query(
        'SELECT id FROM users WHERE email = $1',
        ['cleanup-test@test.com']
      );
      expect(result.rows.length).toBe(0);
    });
  });

  describe('Database Health Check', () => {
    it('should report healthy database status', async () => {
      const health = await databaseService.checkHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(health.latency).toBeLessThan(100); // Should be fast for local DB
    });
  });

  describe('Concurrent Test Isolation', () => {
    it('should handle concurrent transactions', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => 
        withTransaction(async (client) => {
          const user = userFactory.build({
            email: `concurrent-${i}@test.com`
          });
          
          await client.query(
            `INSERT INTO users (username, email, password_hash, first_name, last_name, role)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [user.username, user.email, user.password_hash,
             user.first_name, user.last_name, user.role]
          );
          
          // Each transaction should see only its own data
          const result = await client.query(
            'SELECT COUNT(*) FROM users WHERE email LIKE $1',
            ['concurrent-%@test.com']
          );
          
          expect(parseInt(result.rows[0].count)).toBe(1);
        })
      );
      
      await Promise.all(promises);
      
      // After all transactions rollback, no data should remain
      const result = await databaseService.query(
        'SELECT COUNT(*) FROM users WHERE email LIKE $1',
        ['concurrent-%@test.com']
      );
      
      expect(parseInt(result.rows[0].count)).toBe(0);
    });
  });
});