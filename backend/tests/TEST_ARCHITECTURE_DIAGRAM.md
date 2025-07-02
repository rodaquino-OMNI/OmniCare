# OmniCare Backend Test Architecture

## Test Execution Flow

```mermaid
graph TD
    A[npm test] --> B{Test Type?}
    
    B -->|Unit Tests| C[Jest Global Setup]
    C --> D[Load .env.test]
    D --> E[Mock Database Services]
    E --> F[Run Unit Tests]
    F --> G[Tests use Mocked DB]
    
    B -->|Integration Tests| H[Jest Global Setup]
    H --> I[Load .env.test]
    I --> J{Docker Running?}
    J -->|No| K[Error: Start Docker First]
    J -->|Yes| L[Connect to Test DB]
    L --> M[Run Integration Tests]
    M --> N[Tests use Real DB]
    
    style G fill:#90EE90
    style N fill:#87CEEB
    style K fill:#FFB6C1
```

## Database Architecture

```mermaid
graph LR
    subgraph "Development Environment"
        A1[App Dev] --> B1[PostgreSQL :5432]
        A1 --> C1[Redis :6379]
    end
    
    subgraph "Test Environment"
        A2[Unit Tests] --> B2[Mocked DB]
        A3[Integration Tests] --> B3[PostgreSQL :5433]
        A3 --> C3[Redis :6380]
    end
    
    subgraph "Production Environment"
        A4[App Prod] --> B4[PostgreSQL RDS]
        A4 --> C4[Redis ElastiCache]
    end
    
    style B2 fill:#FFE4B5
    style B3 fill:#87CEEB
```

## Test File Organization

```
backend/
├── src/                    # Application code
│   ├── controllers/
│   ├── services/
│   └── models/
│
├── tests/                  # Test code
│   ├── unit/              # Fast, mocked tests
│   │   ├── controllers/
│   │   ├── services/
│   │   └── models/
│   │
│   ├── integration/       # Real database tests
│   │   ├── api/          # API endpoint tests
│   │   ├── database/     # Direct DB tests
│   │   └── workflows/    # End-to-end flows
│   │
│   ├── setup.ts          # Test environment setup
│   ├── global-setup.ts   # Jest pre-test setup
│   └── global-teardown.ts # Jest post-test cleanup
│
├── scripts/
│   ├── setup-test-db.sh  # Database management
│   └── verify-test-db.ts # Connection verification
│
└── devops/
    └── docker/
        └── docker-compose.test.yml
```

## Mock vs Real Database Decision

```mermaid
graph TD
    A[Test Starts] --> B{Check Test Path}
    B -->|Contains 'unit'| C[Use Mocked DB]
    B -->|Contains 'integration'| D{MOCK_DATABASE env?}
    D -->|true| C
    D -->|false| E[Use Real DB]
    D -->|not set| E
    
    C --> F[Fast Execution]
    E --> G[Realistic Testing]
    
    style C fill:#90EE90
    style E fill:#87CEEB
```

## Port Allocation Strategy

| Service | Development | Test | Production |
|---------|-------------|------|------------|
| PostgreSQL | 5432 | 5433 | RDS Managed |
| Redis | 6379 | 6380 | ElastiCache |
| API Server | 3000 | 8080 | 443 |

## Test Lifecycle

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Script as setup-test-db.sh
    participant Docker as Docker Compose
    participant DB as PostgreSQL
    participant Test as Jest
    
    Dev->>Script: ./setup-test-db.sh start
    Script->>Docker: docker-compose up
    Docker->>DB: Create containers
    DB-->>Script: Ready
    Script-->>Dev: Environment ready
    
    Dev->>Test: npm run test:integration
    Test->>DB: Connect to :5433
    Test->>Test: Run test suite
    Test-->>Dev: Results
    
    Dev->>Script: ./setup-test-db.sh stop
    Script->>Docker: docker-compose down
    Docker->>DB: Stop containers
```

## Best Practices Visualization

```mermaid
mindmap
  root((Testing Best Practices))
    Unit Tests
      Fast execution
      No external deps
      Mock everything
      Test logic only
    Integration Tests
      Real database
      Test queries
      API endpoints
      Transactions
    Performance
      Isolated env
      Consistent data
      Measure metrics
      Load testing
    Security
      Test auth flows
      Validate permissions
      Check encryption
      Audit trails
```

## Common Workflows

### 1. TDD Development Flow
```bash
# Write failing test → Make it pass → Refactor
npm run test:watch -- path/to/new-feature.test.ts
```

### 2. Pre-Commit Flow
```bash
npm run test:unit        # Fast check
npm run test:integration # Thorough check
npm run test:coverage    # Ensure coverage
```

### 3. CI/CD Pipeline Flow
```
1. Checkout code
2. Install dependencies
3. Start test database (Docker)
4. Run all test suites
5. Generate coverage report
6. Stop test database
7. Deploy if passing
```

## Debugging Test Issues

```mermaid
graph TD
    A[Test Fails] --> B{What type of failure?}
    B -->|Connection Error| C[Check Docker Status]
    B -->|Assertion Error| D[Check Test Logic]
    B -->|Timeout| E[Increase Timeout]
    B -->|Mock Error| F[Check Mock Setup]
    
    C --> G[docker ps]
    C --> H[Check ports 5433/6380]
    D --> I[Debug with console.log]
    E --> J[jest.setTimeout]
    F --> K[Review setup.ts]
```