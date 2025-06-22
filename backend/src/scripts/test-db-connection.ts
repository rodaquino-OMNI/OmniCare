#!/usr/bin/env node

/**
 * Test script to verify database connection
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { databaseService } from '../services/database.service';
import { auditRepository } from '../repositories/audit.repository';
import logger from '../utils/logger';

async function testDatabaseConnection() {
  console.log('Testing database connection...\n');

  try {
    // 1. Initialize database connection
    console.log('1. Initializing database connection...');
    await databaseService.initialize();
    console.log('✓ Database connection established');

    // 2. Ensure schemas exist
    console.log('\n2. Ensuring database schemas...');
    await databaseService.ensureAuditSchema();
    console.log('✓ Database schemas verified');

    // 3. Check database health
    console.log('\n3. Checking database health...');
    const health = await databaseService.checkHealth();
    console.log('✓ Database health:', JSON.stringify(health, null, 2));

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
    console.log(`✓ Test audit entry created with ID: ${logId}`);

    // 5. Query the audit log
    console.log('\n5. Querying audit logs...');
    const logs = await auditRepository.searchLogs(
      { userId: 'test-user', action: 'TEST_CONNECTION' },
      10
    );
    console.log(`✓ Found ${logs.length} audit log entries`);

    // 6. Get statistics
    console.log('\n6. Getting audit statistics...');
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const endDate = new Date();
    const stats = await auditRepository.getStatistics(startDate, endDate);
    console.log('✓ Audit statistics:', JSON.stringify(stats, null, 2));

    // 7. Get pool statistics
    console.log('\n7. Getting connection pool statistics...');
    const poolStats = databaseService.getPoolStats();
    console.log('✓ Pool statistics:', JSON.stringify(poolStats, null, 2));

    console.log('\n✅ All database tests passed successfully!');

  } catch (error) {
    console.error('\n❌ Database test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\nShutting down database connection...');
    await databaseService.shutdown();
    console.log('✓ Database connection closed');
    process.exit(0);
  }
}

// Run the test
testDatabaseConnection().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});