#!/usr/bin/env ts-node

/**
 * Verify Test Database Setup
 * This script verifies that the test database is properly configured and accessible
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../.env.test') });

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

async function verifyTestDatabase() {
  console.log(`${colors.blue}🔍 Verifying Test Database Setup${colors.reset}`);
  console.log('================================\n');

  const dbUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
  
  if (!dbUrl) {
    console.error(`${colors.red}❌ DATABASE_URL not found in environment${colors.reset}`);
    process.exit(1);
  }

  console.log(`${colors.yellow}📋 Configuration:${colors.reset}`);
  console.log(`Database URL: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Mock Database: ${process.env.MOCK_DATABASE}`);
  console.log('');

  const pool = new Pool({
    connectionString: dbUrl,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    // Test basic connection
    console.log(`${colors.yellow}🔌 Testing database connection...${colors.reset}`);
    const connectResult = await pool.query('SELECT current_database(), current_user, version()');
    console.log(`${colors.green}✅ Connected successfully${colors.reset}`);
    console.log(`   Database: ${connectResult.rows[0].current_database}`);
    console.log(`   User: ${connectResult.rows[0].current_user}`);
    console.log(`   Version: ${connectResult.rows[0].version.split(',')[0]}`);
    console.log('');

    // Check schemas
    console.log(`${colors.yellow}📁 Checking schemas...${colors.reset}`);
    const schemaResult = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('public', 'audit', 'admin')
      ORDER BY schema_name
    `);
    
    const schemas = schemaResult.rows.map(r => r.schema_name);
    console.log(`${colors.green}✅ Found schemas: ${schemas.join(', ')}${colors.reset}`);
    
    if (!schemas.includes('audit')) {
      console.log(`${colors.yellow}⚠️  Audit schema missing - creating...${colors.reset}`);
      await pool.query('CREATE SCHEMA IF NOT EXISTS audit');
      console.log(`${colors.green}✅ Audit schema created${colors.reset}`);
    }
    console.log('');

    // Check extensions
    console.log(`${colors.yellow}🔧 Checking extensions...${colors.reset}`);
    const extResult = await pool.query(`
      SELECT extname 
      FROM pg_extension 
      WHERE extname IN ('uuid-ossp', 'pgcrypto')
      ORDER BY extname
    `);
    
    const extensions = extResult.rows.map(r => r.extname);
    console.log(`${colors.green}✅ Found extensions: ${extensions.join(', ')}${colors.reset}`);
    
    if (!extensions.includes('uuid-ossp')) {
      console.log(`${colors.yellow}⚠️  UUID extension missing - creating...${colors.reset}`);
      await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      console.log(`${colors.green}✅ UUID extension created${colors.reset}`);
    }
    console.log('');

    // Check tables
    console.log(`${colors.yellow}📊 Checking tables...${colors.reset}`);
    const tableResult = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema IN ('public', 'audit') 
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `);
    
    console.log(`${colors.green}✅ Found ${tableResult.rows.length} tables:${colors.reset}`);
    tableResult.rows.forEach(row => {
      console.log(`   ${row.table_schema}.${row.table_name}`);
    });
    console.log('');

    // Test user table
    console.log(`${colors.yellow}👤 Testing user operations...${colors.reset}`);
    
    // Check if users table exists
    const userTableExists = tableResult.rows.some(r => 
      r.table_schema === 'public' && r.table_name === 'users'
    );
    
    if (userTableExists) {
      // Count existing users
      const userCount = await pool.query('SELECT COUNT(*) FROM users');
      console.log(`${colors.green}✅ Users table exists with ${userCount.rows[0].count} users${colors.reset}`);
      
      // Try to insert a test user
      const testUser = {
        username: `test-verify-${Date.now()}@test.com`,
        email: `test-verify-${Date.now()}@test.com`,
        password_hash: '$2b$10$TestHashedPassword',
        first_name: 'Test',
        last_name: 'Verify',
        role: 'PROVIDER',
      };
      
      const insertResult = await pool.query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        Object.values(testUser)
      );
      
      console.log(`${colors.green}✅ Successfully created test user with ID: ${insertResult.rows[0].id}${colors.reset}`);
      
      // Clean up test user
      await pool.query('DELETE FROM users WHERE id = $1', [insertResult.rows[0].id]);
      console.log(`${colors.green}✅ Cleaned up test user${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️  Users table not found - database may need initialization${colors.reset}`);
    }
    console.log('');

    // Check Redis connection
    console.log(`${colors.yellow}🔴 Checking Redis connection...${colors.reset}`);
    const redisUrl = process.env.REDIS_URL || process.env.TEST_REDIS_URL;
    if (redisUrl) {
      console.log(`Redis URL: ${redisUrl}`);
      // Note: Actual Redis connection test would require redis client
      console.log(`${colors.yellow}ℹ️  Redis connection test requires running Redis server${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️  Redis URL not configured${colors.reset}`);
    }
    console.log('');

    console.log(`${colors.green}✅ Test database verification completed successfully!${colors.reset}`);
    console.log(`${colors.blue}You can now run tests with:${colors.reset}`);
    console.log('  npm test                    # Unit tests with mocked DB');
    console.log('  npm run test:integration    # Integration tests with real DB');

  } catch (error) {
    console.error(`${colors.red}❌ Database verification failed:${colors.reset}`);
    console.error(error);
    
    console.log('\n' + `${colors.yellow}💡 Troubleshooting tips:${colors.reset}`);
    console.log('1. Ensure Docker services are running:');
    console.log('   cd backend && ./scripts/setup-test-db.sh start');
    console.log('2. Check if PostgreSQL is accessible on port 5433');
    console.log('3. Verify credentials in .env.test file');
    console.log('4. Check Docker logs:');
    console.log('   cd devops/docker && docker-compose -f docker-compose.test.yml logs');
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run verification
verifyTestDatabase().catch(console.error);