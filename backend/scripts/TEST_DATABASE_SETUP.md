# OmniCare Test Database Setup Guide

This guide provides comprehensive instructions for setting up and managing the test database environment for OmniCare.

## 🚀 Quick Start

```bash
# 1. Check if your environment is ready
npm run check:env

# 2. Start the test database
npm run db:test:setup

# 3. Verify database connection
npm run db:test

# 4. Run tests
npm test
```

## 📋 Prerequisites

Before running tests, ensure you have:

1. **Node.js** (v16 or higher)
2. **Docker** installed and running
3. **npm dependencies** installed (`npm install`)

## 🛠️ Available Scripts

### Environment Checking Scripts

#### `npm run check:docker`
Checks if Docker is installed and running properly.

```bash
npm run check:docker
```

This script will:
- Verify Docker installation
- Check if Docker daemon is running
- Display Docker version information
- Check user permissions
- Show available Docker resources

#### `npm run check:env`
Performs a comprehensive pre-test environment check.

```bash
npm run check:env
```

This script validates:
- Node.js version
- npm dependencies installation
- Docker availability
- Test database status
- Environment configuration files
- TypeScript build status

### Database Management Scripts

#### `npm run db:test:setup`
Starts the test database environment.

```bash
npm run db:test:setup
```

This will:
- Start PostgreSQL on port 5433
- Start Redis on port 6380
- Create the test database
- Run initial schema setup

#### `npm run db:test:stop`
Stops all test database services.

```bash
npm run db:test:stop
```

#### `npm run db:test:restart`
Restarts the test database environment.

```bash
npm run db:test:restart
```

#### `npm run db:test:status`
Shows the status of test database services.

```bash
npm run db:test:status
```

#### `npm run db:test:logs`
Displays logs from test database services.

```bash
npm run db:test:logs
```

### Database Testing Scripts

#### `npm run db:test`
Tests the database connection and performs health checks.

```bash
npm run db:test
```

This comprehensive test will:
- Verify database connectivity
- Check schema creation
- Test audit logging functionality
- Display connection pool statistics
- Provide detailed error messages if issues occur

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. Docker Not Running

**Error:** "Docker daemon is not running"

**Solution:**
```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker

# Windows
# Start Docker Desktop from Start Menu
```

#### 2. Connection Refused

**Error:** "ECONNREFUSED" when connecting to database

**Solution:**
```bash
# Check if test database is running
npm run db:test:status

# Start the test database
npm run db:test:setup
```

#### 3. Authentication Failed

**Error:** "password authentication failed"

**Solution:**
1. Check your `.env` file configuration
2. Ensure DB_USER and DB_PASSWORD match the test database setup
3. Default test credentials:
   - User: `omnicare`
   - Password: `omnicare`
   - Database: `omnicare_test`

#### 4. Database Does Not Exist

**Error:** "database 'omnicare_test' does not exist"

**Solution:**
```bash
# Recreate the test database
npm run db:test:restart
```

#### 5. Port Already in Use

**Error:** "bind: address already in use"

**Solution:**
```bash
# Find process using the port
lsof -i :5433  # For PostgreSQL
lsof -i :6380  # For Redis

# Stop conflicting service or use different ports
```

## 🔍 Manual Database Operations

### Connect to Test Database

```bash
# Using psql
psql -h localhost -p 5433 -U omnicare -d omnicare_test

# Using Docker
docker exec -it omnicare-test-postgres psql -U omnicare -d omnicare_test
```

### View Database Logs

```bash
# PostgreSQL logs
docker logs omnicare-test-postgres

# Redis logs
docker logs omnicare-test-redis
```

### Reset Test Database

```bash
# Complete reset
npm run db:test:stop
docker volume rm omnicare_test_postgres_data
npm run db:test:setup
```

## 🧪 Running Tests

### Unit Tests (No Database Required)

```bash
npm run test:unit
```

### Integration Tests (Database Required)

```bash
# Ensure database is running first
npm run db:test:setup

# Run integration tests
npm run test:integration
```

### All Tests with Environment Check

```bash
# This will run pre-test checks automatically
npm test
```

### Watch Mode for Development

```bash
npm run test:watch
```

## 📝 Environment Configuration

### Test Environment Variables

Create a `.env.test` file in the backend directory:

```env
NODE_ENV=test
DB_HOST=localhost
DB_PORT=5433
DB_NAME=omnicare_test
DB_USER=omnicare
DB_PASSWORD=omnicare
REDIS_HOST=localhost
REDIS_PORT=6380
```

### Using Different Database Configurations

```bash
# Use custom database
DB_HOST=custom-host DB_PORT=5432 npm run db:test

# Use production-like settings
NODE_ENV=production npm run db:test
```

## 🚨 CI/CD Integration

For continuous integration environments:

```bash
# Install dependencies
npm ci

# Start test services
npm run db:test:setup

# Run all checks and tests
npm run test:ci

# Cleanup
npm run db:test:stop
```

### GitHub Actions Example

```yaml
- name: Check environment
  run: npm run check:env

- name: Start test database
  run: npm run db:test:setup

- name: Run tests
  run: npm test

- name: Stop test database
  if: always()
  run: npm run db:test:stop
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Jest Testing Documentation](https://jestjs.io/docs/getting-started)
- [OmniCare Testing Guidelines](../docs/TESTING.md)

## 🤝 Contributing

When adding new database-related functionality:

1. Update the test database schema if needed
2. Add corresponding tests
3. Update this documentation
4. Ensure all checks pass: `npm run check:env`

---

For more help, run any script with `--help` or check the script source in the `scripts/` directory.