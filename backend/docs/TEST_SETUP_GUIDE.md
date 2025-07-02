# Backend Test Setup Guide

This guide explains how to set up and run tests for the OmniCare backend.

## Overview

The backend test suite includes:
- **Unit Tests**: Fast, isolated tests that don't require external dependencies
- **Integration Tests**: Tests that verify component interactions (can run with or without Docker)
- **E2E Tests**: End-to-end tests that verify complete workflows

## Environment Setup

### 1. Environment Variables

The test environment is configured through `.env.test` files:
- `/backend/.env.test` - Backend-specific test configuration
- `/.env.test` - Root-level test configuration (inherited by backend)

Key environment variables:
- `MOCK_DATABASE`: Set to `true` for unit tests, `false` for integration tests with real DB
- `DOCKER_AVAILABLE`: Automatically detected by test scripts
- `SKIP_DOCKER_TESTS`: Set to `true` to run integration tests with mocks

### 2. Docker Setup (Optional for Unit Tests)

Integration tests can use real PostgreSQL and Redis instances via Docker:

```bash
# Check Docker availability
npm run check:docker

# Start test containers
npm run docker:test:up

# Check container status
npm run docker:test:ps

# View container logs
npm run docker:test:logs

# Stop containers
npm run docker:test:down
```

## Running Tests

### Quick Start (Automatic Docker Detection)

```bash
# Run all tests (automatically detects Docker)
npm test

# Run only unit tests (no Docker required)
npm run test:unit

# Run integration tests (uses Docker if available, mocks otherwise)
npm run test:integration

# Run E2E tests
npm run test:e2e
```

### Direct Test Commands (Skip Docker Checks)

```bash
# Run unit tests directly
npm run test:unit:direct

# Run integration tests directly
npm run test:integration:direct

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Test Categories

The test runner automatically determines the test category based on the file path:
- `**/*.unit.test.ts` - Unit tests
- `**/*.integration.test.ts` - Integration tests
- `**/*.e2e.test.ts` - E2E tests

## Docker-less Testing

If Docker is not available:
1. Unit tests will always run successfully with mocked dependencies
2. Integration tests will automatically use mocked services
3. You'll see a warning message, but tests will still run

To force integration tests to use mocks even when Docker is available:
```bash
SKIP_DOCKER_TESTS=true npm run test:integration
```

## CI/CD Testing

For CI/CD environments:
```bash
# Full test suite with linting and type checking
npm run test:ci
```

This command:
1. Runs ESLint
2. Runs TypeScript type checking
3. Runs all tests with coverage

## Troubleshooting

### Port Conflicts

If you see port conflict errors:
1. Check if test containers are already running: `npm run docker:test:ps`
2. Check for other services on ports 5433 (PostgreSQL) or 6380 (Redis)
3. Stop conflicting services or change test ports in `.env.test`

### Docker Not Found

If Docker is not installed:
1. Unit tests will still run normally
2. Integration tests will use mocked services
3. To get full integration testing, install Docker Desktop

### Test Database Issues

If database tests fail:
1. Check Docker containers: `npm run docker:test:ps`
2. View logs: `npm run docker:test:logs`
3. Restart containers: `npm run docker:test:down && npm run docker:test:up`
4. Verify connection: `npm run db:test:verify`

## Test Configuration

### Jest Configuration

Tests are configured in `jest.config.js`:
- Test environment: Node
- Module path aliases configured
- Coverage thresholds set
- Different configurations for unit vs integration tests

### Global Setup

The `tests/global-setup.ts` file:
- Loads environment variables
- Checks Docker availability
- Configures mocking based on test type
- Sets up test databases (or mocks)

### Environment Setup

The `tests/env.setup.ts` file:
- Loads `.env.test` files
- Sets test-specific environment variables
- Configures mocking based on test category
- Ensures consistent test environment

## Best Practices

1. **Unit Tests**: Should never require Docker or external services
2. **Integration Tests**: Can run with or without Docker, but prefer real services when available
3. **Mocking**: Use `MOCK_DATABASE=true` for unit tests, `false` for integration tests with Docker
4. **Parallel Execution**: Unit tests run in parallel, integration tests run sequentially
5. **Test Isolation**: Each test should clean up after itself

## Examples

### Running Specific Test Files

```bash
# Run a specific test file
npm test -- src/services/auth.service.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should authenticate user"

# Run tests in a specific directory
npm test -- src/controllers/
```

### Debugging Tests

```bash
# Run tests with Node debugger
npm run test:debug

# Run specific test with debugger
node --inspect-brk ./node_modules/.bin/jest --runInBand src/services/auth.service.test.ts
```

## Summary

The test setup is designed to be flexible:
- **With Docker**: Get full integration testing with real services
- **Without Docker**: Tests still run with mocked services
- **Automatic Detection**: Scripts automatically detect and adapt to your environment
- **Clear Feedback**: You'll always know whether you're using real or mocked services