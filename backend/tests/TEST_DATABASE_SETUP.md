# Test Database Setup Guide for OmniCare Backend

This guide explains how to set up and use the test database for OmniCare backend development.

## Table of Contents
- [Quick Start](#quick-start)
- [Understanding Test Modes](#understanding-test-modes)
- [Database Setup](#database-setup)
- [Common Issues and Solutions](#common-issues-and-solutions)
- [Test Commands Reference](#test-commands-reference)
- [Architecture Overview](#architecture-overview)

## Quick Start

### 1. For Unit Tests (Default - No Database Required)
```bash
# Just run the tests - database is automatically mocked
npm test

# Run specific unit tests
npm run test:unit
```

### 2. For Integration Tests (Real Database Required)
```bash
# Step 1: Start the test database
./scripts/setup-test-db.sh start

# Step 2: Verify the database is ready
npm run db:test:verify

# Step 3: Run integration tests
npm run test:integration

# Step 4: Stop the database when done
./scripts/setup-test-db.sh stop
```

## Understanding Test Modes

### Unit Tests (Default)
- **Database**: Fully mocked - no external dependencies
- **When to use**: Testing business logic, controllers, services in isolation
- **Speed**: Very fast
- **Location**: `tests/unit/**/*.test.ts`
- **Command**: `npm test` or `npm run test:unit`

### Integration Tests
- **Database**: Real PostgreSQL + Redis instances via Docker
- **When to use**: Testing database queries, transactions, API endpoints
- **Speed**: Slower but more realistic
- **Location**: `tests/integration/**/*.test.ts`
- **Command**: `npm run test:integration`

### Performance Tests
- **Database**: Real database recommended
- **When to use**: Load testing, benchmarking
- **Location**: `tests/performance/**/*.test.ts`
- **Command**: `npm run test:performance`

## Database Setup

### Prerequisites
1. **Docker** and **docker-compose** installed
2. **Node.js** 18+ installed
3. **PostgreSQL client tools** (optional, for debugging)

### Step-by-Step Setup

#### 1. Create Test Environment File
```bash
# Copy the example file
cp .env.example .env.test

# Edit .env.test with test-specific values:
DATABASE_URL=postgresql://omnicare:password@localhost:5433/omnicare_test
REDIS_URL=redis://localhost:6380/1
NODE_ENV=test
```

#### 2. Start Test Services
```bash
# Start PostgreSQL (port 5433) and Redis (port 6380)
./scripts/setup-test-db.sh start
```

This command:
- Starts PostgreSQL on port **5433** (not 5432 to avoid conflicts)
- Starts Redis on port **6380** (not 6379 to avoid conflicts)
- Creates the `omnicare_test` database
- Sets up the `audit` schema
- Installs required extensions (uuid-ossp, pgcrypto)

#### 3. Verify Setup
```bash
# Run the verification script
npm run db:test:verify
```

You should see:
```
✅ Connected successfully
✅ Found schemas: audit, public
✅ Found extensions: pgcrypto, uuid-ossp
✅ Test database verification completed successfully!
```

#### 4. Run Database Migrations (if needed)
```bash
# If you have migration files
npm run db:migrate
```

## Common Issues and Solutions

### Issue 1: "Docker is not installed"
**Solution**: Install Docker Desktop from https://www.docker.com/products/docker-desktop

### Issue 2: "docker-compose.test.yml not found"
**Solution**: 
```bash
# Create the Docker compose file for tests
mkdir -p devops/docker
cat > devops/docker/docker-compose.test.yml << 'EOF'
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: omnicare
      POSTGRES_PASSWORD: password
      POSTGRES_DB: omnicare_test
    ports:
      - "5433:5432"
    volumes:
      - test-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U omnicare -d omnicare_test"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  test-postgres-data:
EOF
```

### Issue 3: "PostgreSQL failed to start"
**Solution**:
```bash
# Check if port 5433 is already in use
lsof -i :5433

# Check Docker logs
cd devops/docker && docker-compose -f docker-compose.test.yml logs postgres

# Restart services
./scripts/setup-test-db.sh restart
```

### Issue 4: "Cannot connect to database"
**Solution**:
```bash
# Verify environment variables
cat .env.test | grep DATABASE_URL

# Test direct connection
psql postgresql://omnicare:password@localhost:5433/omnicare_test

# Check service status
./scripts/setup-test-db.sh status
```

### Issue 5: Tests still using mocked database
**Solution**:
```bash
# Force real database for integration tests
MOCK_DATABASE=false npm run test:integration

# Or set in .env.test
echo "MOCK_DATABASE=false" >> .env.test
```

## Test Commands Reference

### Database Management
```bash
# Start test database
npm run db:test:setup      # or ./scripts/setup-test-db.sh start

# Stop test database
npm run db:test:stop       # or ./scripts/setup-test-db.sh stop

# Restart test database
npm run db:test:restart    # or ./scripts/setup-test-db.sh restart

# Check status
npm run db:test:status     # or ./scripts/setup-test-db.sh status

# View logs
npm run db:test:logs       # or ./scripts/setup-test-db.sh logs

# Verify setup
npm run db:test:verify
```

### Running Tests
```bash
# All tests (mocked by default)
npm test

# Unit tests only (always mocked)
npm run test:unit

# Integration tests (real database)
npm run test:integration

# Specific test file
npm test -- path/to/test.spec.ts

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Debug mode
npm run test:debug
```

### Quick Test Script
```bash
# Run all tests quickly with proper setup
npm run test:quick

# Run all test types
npm run test:all
```

## Architecture Overview

### Test Structure
```
backend/tests/
├── unit/                 # Unit tests (mocked DB)
│   ├── controllers/      # Controller tests
│   ├── services/         # Service tests
│   └── middleware/       # Middleware tests
├── integration/          # Integration tests (real DB)
│   ├── api/              # API endpoint tests
│   ├── database/         # Database query tests
│   └── workflows/        # End-to-end workflows
├── performance/          # Performance tests
├── security/             # Security tests
├── fixtures/             # Test data generators
├── mocks/                # Mock implementations
├── setup.ts              # Test environment setup
├── global-setup.ts       # Jest global setup
└── global-teardown.ts    # Jest global teardown
```

### Database Isolation
- Each test category uses different database configurations
- Unit tests: Fully mocked, no external dependencies
- Integration tests: Isolated test database (omnicare_test)
- Performance tests: Can use either mocked or real database

### Mock vs Real Database Decision Flow
```
Is TEST_CATEGORY=integration OR --testPathPattern=integration?
  ├─ YES → Use real database (PostgreSQL on port 5433)
  └─ NO → Is MOCK_DATABASE=false?
      ├─ YES → Use real database
      └─ NO → Use mocked database (default)
```

## Best Practices

1. **Always use mocked database for unit tests** - They should be fast and isolated
2. **Start fresh** - Integration tests should not depend on existing data
3. **Clean up** - Tests should clean up their test data
4. **Use transactions** - Wrap integration tests in transactions when possible
5. **Parallel execution** - Unit tests run in parallel, integration tests run serially

## Troubleshooting Checklist

- [ ] Docker and docker-compose installed?
- [ ] Test database container running? (`docker ps`)
- [ ] Correct ports available? (5433 for PostgreSQL, 6380 for Redis)
- [ ] Environment variables loaded? (`.env.test` exists)
- [ ] Database URL correct in `.env.test`?
- [ ] Running the right test command for your needs?
- [ ] Check Docker logs if services won't start
- [ ] Verify network connectivity to Docker containers

## Need Help?

1. Check service logs: `./scripts/setup-test-db.sh logs`
2. Verify database connection: `npm run db:test:verify`
3. Run with debug logging: `LOG_LEVEL=debug npm test`
4. Check Jest configuration: `backend/jest.config.js`
5. Review test setup files: `tests/setup.ts`, `tests/global-setup.ts`