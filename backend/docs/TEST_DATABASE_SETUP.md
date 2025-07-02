# Test Database Setup Guide

This guide explains how to set up and configure the test database for OmniCare backend testing with proper isolation and utilities.

## Overview

The OmniCare backend provides a comprehensive test database environment with:

1. **Unit Tests** - Use mocked database connections (default) for fast, isolated testing
2. **Integration Tests** - Use real PostgreSQL and Redis connections with transaction-based isolation
3. **Test Utilities** - Transaction management, data factories, and cleanup utilities
4. **Docker-based Setup** - Consistent test environment using Docker Compose

## Unit Tests (Default)

Unit tests run with mocked database connections by default. No database setup is required.

```bash
# Run all unit tests
npm test

# Run specific unit tests
npm run test:unit
```

## Integration Tests

Integration tests require real database connections. Use Docker Compose to set up the test environment.

### Prerequisites

- Docker and Docker Compose installed
- Port 5433 available for PostgreSQL
- Port 6380 available for Redis

### Setup Steps

1. **Start Test Database Services**

   ```bash
   # Navigate to backend directory
   cd backend

   # Start test services using the setup script
   ./scripts/setup-test-db.sh start
   ```

   This will:
   - Start PostgreSQL on port 5433
   - Start Redis on port 6380
   - Create the `omnicare_test` database
   - Set up required schemas and extensions

2. **Run Integration Tests**

   ```bash
   # Run all integration tests
   npm run test:integration

   # Run specific integration test
   npm test -- --testPathPattern="integration/auth"
   ```

3. **Stop Test Services**

   ```bash
   ./scripts/setup-test-db.sh stop
   ```

### Manual Docker Compose Setup

If you prefer to manage Docker Compose manually:

```bash
# Navigate to test docker compose directory
cd devops/docker

# Start services
docker-compose -f docker-compose.test.yml up -d

# View logs
docker-compose -f docker-compose.test.yml logs -f

# Stop services
docker-compose -f docker-compose.test.yml down
```

## Configuration

### Test Environment Variables

The `.env.test` file contains test-specific configuration:

```bash
# Database Configuration
DATABASE_URL=postgresql://omnicare:omnicare123@localhost:5433/omnicare_test
DB_HOST=localhost
DB_PORT=5433
DB_NAME=omnicare_test
DB_USER=omnicare
DB_PASSWORD=omnicare123

# Enable mocking for unit tests
MOCK_DATABASE=true
MOCK_EXTERNAL_SERVICES=true
```

### Database Credentials

- **Database**: omnicare_test
- **User**: omnicare
- **Password**: omnicare123
- **Port**: 5433 (PostgreSQL)
- **Redis Port**: 6380

## Troubleshooting

### Tests Failing with Database Connection Errors

1. **For Unit Tests**: Ensure `MOCK_DATABASE=true` is set in `.env.test`
2. **For Integration Tests**: 
   - Ensure Docker services are running
   - Check ports 5433 and 6380 are not in use
   - Verify database credentials match `.env.test`

### Check Service Status

```bash
./scripts/setup-test-db.sh status
```

### View Service Logs

```bash
./scripts/setup-test-db.sh logs
```

### Reset Test Database

```bash
./scripts/setup-test-db.sh restart
```

## Test Categories

Tests are organized into categories:

- `unit/` - Unit tests with mocked dependencies
- `integration/` - Integration tests with real database
- `e2e/` - End-to-end tests
- `performance/` - Performance benchmarks

## Test Isolation Features

### Transaction-Based Isolation

Each test runs in its own transaction that is automatically rolled back:

```typescript
import { withTestTransaction } from '../utils/test-transaction.utils';

const transactionalTest = withTestTransaction(it);

transactionalTest('should isolate database changes', async () => {
  // All database changes in this test will be rolled back
  const user = await createTestData('users', userFactory.build());
  // User exists only within this test
});
```

### Test Data Factories

Generate realistic test data with factories:

```typescript
import { userFactory, sessionFactory, DatabaseSeeder } from '../factories/database.factory';

// Create specific user types
const admin = userFactory.buildAdmin();
const physician = userFactory.buildPhysician();
const nurse = userFactory.buildNurse();

// Seed entire database
const seedData = await DatabaseSeeder.seedAll(client);
```

### Cleanup Utilities

Automatic cleanup after tests:

```typescript
import { withCleanup } from '../utils/test-database.utils';

await withCleanup(
  async () => {
    // Test code
  },
  async () => {
    // Cleanup code runs automatically
  }
);
```

## NPM Scripts Reference

```bash
# Database management
npm run db:test:setup      # Start test database services
npm run db:test:stop       # Stop test database services  
npm run db:test:restart    # Restart test database
npm run db:test:status     # Check service status
npm run db:test:logs       # View service logs
npm run db:test:verify     # Verify database setup

# Running tests
npm test                   # Unit tests with mocked DB
npm run test:integration   # Integration tests with real DB
npm run test:db           # Force real database for tests
```

## CI/CD Configuration

For CI/CD pipelines, ensure:

1. Docker services are available
2. Set `TEST_CATEGORY=integration` for integration tests
3. Use appropriate timeouts for database initialization

Example GitHub Actions setup:

```yaml
- name: Start Test Database
  run: |
    cd devops/docker
    docker-compose -f docker-compose.test.yml up -d
    npm run db:test:verify  # Verify setup

- name: Run Tests
  run: |
    npm test                              # Unit tests
    MOCK_DATABASE=false npm run test:integration  # Integration tests
```

## Best Practices

1. **Use Transactions for Isolation** - Wrap integration tests in transactions
2. **Leverage Factories** - Use data factories for consistent test data
3. **Clean Up After Tests** - Use cleanup utilities to prevent data leaks
4. **Parallel Testing** - Tests are isolated and can run in parallel
5. **Mock for Unit Tests** - Keep unit tests fast by using mocked database

## Notes

- Unit tests use mocked database to ensure fast, isolated testing
- Integration tests verify actual database interactions with full rollback
- The test database uses tmpfs for performance (ephemeral storage)
- All test data is isolated from production and development databases
- Connection pooling is optimized for test performance (5 connections max)