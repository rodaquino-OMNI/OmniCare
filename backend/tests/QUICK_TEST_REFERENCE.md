# OmniCare Backend Test Quick Reference

## 🚀 Quick Commands

### Just Want to Run Tests?
```bash
npm test                    # Run all unit tests (no DB needed)
npm run test:unit          # Same as above
npm run test:watch         # Watch mode for development
```

### Need Real Database Tests?
```bash
# 1. Start database (one time)
./scripts/setup-test-db.sh start

# 2. Run integration tests
npm run test:integration

# 3. Stop when done
./scripts/setup-test-db.sh stop
```

## 🔍 Test Types at a Glance

| Test Type | Database | Speed | Use When |
|-----------|----------|-------|----------|
| Unit | Mocked | ⚡ Fast | Testing logic |
| Integration | Real | 🐢 Slower | Testing DB/API |
| E2E | Real | 🐌 Slowest | Full workflows |

## 🛠️ Database Commands

```bash
# Database lifecycle
db:test:setup     # Start test DB
db:test:stop      # Stop test DB
db:test:restart   # Restart test DB
db:test:status    # Check if running
db:test:verify    # Verify connection
```

## 📁 Test Locations

```
tests/
├── unit/          # npm run test:unit
├── integration/   # npm run test:integration
├── performance/   # npm run test:performance
└── security/      # npm run test:security
```

## 🔧 Environment Variables

Create `.env.test`:
```env
DATABASE_URL=postgresql://omnicare:password@localhost:5433/omnicare_test
REDIS_URL=redis://localhost:6380/1
MOCK_DATABASE=false  # Only for integration tests
```

## ⚠️ Common Fixes

**"Cannot connect to database"**
```bash
./scripts/setup-test-db.sh status  # Check if running
./scripts/setup-test-db.sh start   # Start if needed
```

**"Port already in use"**
- PostgreSQL uses port `5433` (not 5432)
- Redis uses port `6380` (not 6379)

**"Tests using mocked DB when I want real DB"**
```bash
MOCK_DATABASE=false npm run test:integration
```

## 📝 Writing Tests

### Unit Test (Mocked DB)
```typescript
// Automatically uses mocked database
describe('UserService', () => {
  it('should create user', async () => {
    const user = await userService.create(userData);
    expect(user).toBeDefined();
  });
});
```

### Integration Test (Real DB)
```typescript
// Uses real database when run with test:integration
describe('User API Integration', () => {
  it('should create user in database', async () => {
    const response = await request(app)
      .post('/api/users')
      .send(userData);
    
    expect(response.status).toBe(201);
    // Verify in actual database
    const dbUser = await db.query('SELECT * FROM users WHERE id = $1', [response.body.id]);
    expect(dbUser.rows[0]).toBeDefined();
  });
});
```

## 🎯 Decision Tree

```
Need to test business logic only?
  → npm test (mocked, fast)

Need to test database queries?
  → ./scripts/setup-test-db.sh start
  → npm run test:integration

Need to debug a specific test?
  → npm test -- --runInBand path/to/test.ts

Need to see why a test fails?
  → npm run test:debug
```

## 💡 Pro Tips

1. **Keep unit tests fast**: Always use mocked DB
2. **Run integration tests before PR**: Catches DB issues
3. **Use watch mode**: `npm run test:watch` during development
4. **Clean state**: Each test should be independent
5. **Check coverage**: `npm run test:coverage`

## 🚨 Emergency Commands

```bash
# Something's wrong? Try these:
./scripts/setup-test-db.sh restart     # Restart everything
docker ps                               # Check what's running
docker-compose -f devops/docker/docker-compose.test.yml down  # Force stop
npm run db:test:verify                  # Diagnose connection
```

---
📚 Full guide: [TEST_DATABASE_SETUP.md](./TEST_DATABASE_SETUP.md)