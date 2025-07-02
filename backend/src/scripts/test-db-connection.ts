#!/usr/bin/env node

/**
 * Test script to verify database connection
 */

import path from 'path';

import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { auditRepository } from '../repositories/audit.repository';
import { databaseService } from '../services/database.service';

import { execSync } from 'child_process';

// Colors for output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const NC = '\x1b[0m'; // No Color

function formatError(error: any): string {
  if (error.code === 'ECONNREFUSED') {
    return `${RED}Connection refused. The database server is not running or not accessible.${NC}
    
    Common causes:
    1. PostgreSQL is not running
    2. Wrong connection port (expected: ${process.env.DB_PORT || 5432})
    3. Wrong hostname (expected: ${process.env.DB_HOST || 'localhost'})
    
    To fix:
    - Run: ${BLUE}npm run db:test:start${NC} to start the test database
    - Or: ${BLUE}./backend/scripts/setup-test-db.sh start${NC}`;
  }
  
  if (error.code === 'ENOTFOUND') {
    return `${RED}Database host not found: ${process.env.DB_HOST || 'localhost'}${NC}
    
    Please check your environment variables:
    - DB_HOST: ${process.env.DB_HOST || 'not set (defaulting to localhost)'}
    - DB_PORT: ${process.env.DB_PORT || 'not set (defaulting to 5432)'}`;
  }
  
  if (error.message?.includes('password authentication failed')) {
    return `${RED}Authentication failed for user '${process.env.DB_USER || 'omnicare'}'${NC}
    
    Please check your database credentials:
    - DB_USER: ${process.env.DB_USER || 'not set (defaulting to omnicare)'}
    - DB_PASSWORD: ${process.env.DB_PASSWORD ? '***' : 'not set'}
    - DB_NAME: ${process.env.DB_NAME || 'not set (defaulting to omnicare_test)'}`;
  }
  
  if (error.message?.includes('database') && error.message?.includes('does not exist')) {
    const dbName = process.env.DB_NAME || 'omnicare_test';
    return `${RED}Database '${dbName}' does not exist${NC}
    
    To create the database:
    1. Run: ${BLUE}npm run db:test:start${NC}
    2. Or manually create it: ${BLUE}createdb ${dbName}${NC}`;
  }
  
  return `${RED}${error.message || error}${NC}`;
}

function checkEnvironment() {
  console.log(`${BLUE}🔍 Checking environment...${NC}\n`);
  
  // Check if we're in test environment
  if (process.env.NODE_ENV !== 'test') {
    console.log(`${YELLOW}⚠️  NODE_ENV is '${process.env.NODE_ENV || 'not set'}', expected 'test'${NC}`);
    console.log(`   This script is designed for the test environment.\n`);
  }
  
  // Display current configuration
  console.log(`${BLUE}📋 Database Configuration:${NC}`);
  console.log(`   Host: ${process.env.DB_HOST || 'localhost (default)'}`);
  console.log(`   Port: ${process.env.DB_PORT || '5432 (default)'}`);
  console.log(`   Database: ${process.env.DB_NAME || 'omnicare_test (default)'}`);
  console.log(`   User: ${process.env.DB_USER || 'omnicare (default)'}`);
  console.log(`   Password: ${process.env.DB_PASSWORD ? '***' : 'not set'}\n`);
}

async function testDatabaseConnection() {
  console.log(`${BLUE}🏥 OmniCare Database Connection Test${NC}`);
  console.log('=====================================\n');
  
  checkEnvironment();
  
  console.log(`${YELLOW}Testing database connection...${NC}\n`);

  try {
    // 1. Initialize database connection
    console.log('1. Initializing database connection...');
    try {
      await databaseService.initialize();
      console.log(`${GREEN}✓ Database connection established${NC}`);
    } catch (error) {
      throw new Error(`Failed to connect to database\n${formatError(error)}`);
    }

    // 2. Ensure schemas exist
    console.log('\n2. Ensuring database schemas...');
    try {
      await databaseService.ensureAuditSchema();
      console.log(`${GREEN}✓ Database schemas verified${NC}`);
    } catch (error) {
      throw new Error(`Failed to create/verify schemas\n${formatError(error)}`);
    }

    // 3. Check database health
    console.log('\n3. Checking database health...');
    const health = await databaseService.checkHealth();
    console.log(`${GREEN}✓ Database health:${NC}`, JSON.stringify(health, null, 2));

    // 4. Test audit logging
    console.log('\n4. Testing audit logging...');
    const testEntry = {
      id: `test_${Date.now()}`,
      userId: 'test-user',
      action: 'TEST_CONNECTION',
      resource: 'system',
      ipAddress: '127.0.0.1',
      userAgent: 'test-script',
      timestamp: new Date(),
      success: true
    };

    const logId = await auditRepository.logActivity(testEntry, 'test-session');
    console.log(`${GREEN}✓ Test audit entry created with ID: ${logId}${NC}`);

    // 5. Query the audit log
    console.log('\n5. Querying audit logs...');
    const logs = await auditRepository.searchLogs(
      { userId: 'test-user', action: 'TEST_CONNECTION' },
      10
    );
    console.log(`${GREEN}✓ Found ${logs.length} audit log entries${NC}`);

    // 6. Get statistics
    console.log('\n6. Getting audit statistics...');
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const endDate = new Date();
    const stats = await auditRepository.getStatistics(startDate, endDate);
    console.log(`${GREEN}✓ Audit statistics:${NC}`, JSON.stringify(stats, null, 2));

    // 7. Get pool statistics
    console.log('\n7. Getting connection pool statistics...');
    const poolStats = databaseService.getPoolStats();
    console.log(`${GREEN}✓ Pool statistics:${NC}`, JSON.stringify(poolStats, null, 2));

    console.log(`\n${GREEN}✅ All database tests passed successfully!${NC}`);
    console.log(`\n${BLUE}You can now run your tests with confidence.${NC}`);

  } catch (error: any) {
    console.error(`\n${RED}❌ Database test failed:${NC}`);
    console.error(error.message || formatError(error));
    
    // Provide helpful next steps
    console.log(`\n${YELLOW}💡 Troubleshooting Tips:${NC}`);
    console.log('1. Check if Docker is running:');
    console.log(`   ${BLUE}docker ps${NC}`);
    console.log('2. Check test database status:');
    console.log(`   ${BLUE}./backend/scripts/setup-test-db.sh status${NC}`);
    console.log('3. View database logs:');
    console.log(`   ${BLUE}./backend/scripts/setup-test-db.sh logs${NC}`);
    console.log('4. Restart test database:');
    console.log(`   ${BLUE}./backend/scripts/setup-test-db.sh restart${NC}`);
    
    process.exit(1);
  } finally {
    // Cleanup
    console.log(`\n${YELLOW}Shutting down database connection...${NC}`);
    await databaseService.shutdown();
    console.log(`${GREEN}✓ Database connection closed${NC}`);
    process.exit(0);
  }
}

// Run the test
testDatabaseConnection().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});