# OmniCare EMR FHIR Backend Integration

A comprehensive FHIR R4 compliant backend server for the OmniCare Electronic Medical Records system, featuring Medplum integration, SMART on FHIR support, Clinical Decision Support Hooks, and real-time subscriptions.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   FHIR Backend   │    │   Medplum       │
│   Applications  │◄──►│   (OmniCare)     │◄──►│   FHIR Server   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   PostgreSQL     │    │   External EHRs │
                       │   Database       │    │   (Epic/Cerner) │
                       └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Redis Cache    │
                       └──────────────────┘
```

## 🚀 Key Features

### FHIR R4 Compliance
- **Complete FHIR R4 API**: Full CRUD operations for all major clinical resources
- **Medplum Integration**: Both SaaS and self-hosted Medplum server support
- **Resource Validation**: Comprehensive FHIR resource validation with custom extensions
- **Bundle Processing**: Transaction and batch bundle support
- **GraphQL Support**: FHIR GraphQL queries for efficient data retrieval

### SMART on FHIR Integration
- **EHR Launch**: Support for EHR-launched applications
- **Standalone Launch**: Standalone application launch capabilities
- **OAuth2 Flows**: Authorization code, client credentials, and refresh token flows
- **Multi-EHR Support**: Epic, Cerner, and Allscripts integration
- **Scope Management**: Granular permissions with patient, user, and system scopes

### Clinical Decision Support
- **CDS Hooks**: Patient-view, medication-prescribe, and order-review hooks
- **Risk Assessment**: Automated patient risk scoring and alerts
- **Drug Safety**: Medication interaction and allergy checking
- **Order Appropriateness**: Evidence-based clinical decision support

### Real-time Capabilities
- **FHIR Subscriptions**: WebSocket and REST-hook subscriptions
- **Live Updates**: Real-time notifications for resource changes
- **Connection Management**: Robust WebSocket connection handling
- **Scalable Architecture**: Support for thousands of concurrent connections

### Security & Compliance
- **Multi-layer Authentication**: SMART OAuth2 + Internal JWT
- **Authorization Controls**: Scope-based access with patient-level security
- **Audit Logging**: Comprehensive audit trail for compliance
- **Data Protection**: Input sanitization and validation
- **Rate Limiting**: Configurable rate limits per user/client

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration management
│   ├── controllers/      # API endpoint controllers
│   ├── middleware/       # Authentication, authorization, logging
│   ├── services/         # Business logic and integrations
│   ├── types/           # TypeScript type definitions
│   ├── routes/          # API route definitions
│   └── utils/           # Utility functions and helpers
├── docker/              # Docker configuration
├── tests/               # Test suites
└── docs/                # API documentation
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ 
- PostgreSQL 12+
- Redis 6+
- Docker & Docker Compose (optional)

### Local Development

1. **Clone and Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   # Create database
   createdb omnicare_fhir
   
   # Run initialization script
   psql -d omnicare_fhir -f docker/init-db.sql
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

### Docker Deployment

1. **Basic Deployment**
   ```bash
   docker-compose up -d
   ```

2. **With Self-hosted Medplum**
   ```bash
   docker-compose --profile self-hosted-medplum up -d
   ```

3. **With Nginx Proxy**
   ```bash
   docker-compose --profile with-proxy up -d
   ```

## 🔧 Configuration

### Environment Variables

#### Required Configuration
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/omnicare_fhir

# Security
JWT_SECRET=your_super_secure_jwt_secret

# Medplum Configuration (choose one)
# Option 1: SaaS
MEDPLUM_CLIENT_ID=your_medplum_client_id
MEDPLUM_CLIENT_SECRET=your_medplum_client_secret
MEDPLUM_PROJECT_ID=your_medplum_project_id

# Option 2: Self-hosted
MEDPLUM_SELF_HOSTED=true
MEDPLUM_SELF_HOSTED_URL=http://localhost:8103
```

#### Optional Configuration
```env
# Redis
REDIS_URL=redis://localhost:6379

# Server
PORT=8080
HOST=localhost
NODE_ENV=development

# Logging
LOG_LEVEL=info
LOG_FILE=logs/omnicare.log

# Performance
RATE_LIMIT_MAX_REQUESTS=100
CACHE_TTL=3600
MAX_REQUEST_SIZE=10mb

# WebSocket
WEBSOCKET_PORT=8081
SUBSCRIPTION_MAX_CONNECTIONS=1000
```

## 📚 API Documentation

### Core FHIR Endpoints

#### Metadata
```http
GET /fhir/R4/metadata
```
Returns the FHIR Capability Statement.

#### Resource Operations
```http
# Create
POST /fhir/R4/{resourceType}
Content-Type: application/fhir+json

# Read
GET /fhir/R4/{resourceType}/{id}

# Update
PUT /fhir/R4/{resourceType}/{id}
Content-Type: application/fhir+json

# Delete
DELETE /fhir/R4/{resourceType}/{id}

# Search
GET /fhir/R4/{resourceType}?{searchParams}
```

#### Bundle Operations
```http
POST /fhir/R4
Content-Type: application/fhir+json

{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [...]
}
```

### Authentication Endpoints

#### SMART on FHIR
```http
# Authorization
GET /auth/authorize?response_type=code&client_id={id}&redirect_uri={uri}&scope={scope}

# Token Exchange
POST /auth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code={code}&redirect_uri={uri}&client_id={id}
```

#### Internal API
```http
# Login
POST /auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password",
  "clientId": "omnicare-app"
}
```

### CDS Hooks

#### Discovery
```http
GET /cds-services
```

#### Hook Execution
```http
POST /cds-services/{service-id}
Content-Type: application/json

{
  "hookInstance": "unique-id",
  "fhirServer": "https://fhir.example.com",
  "hook": "patient-view",
  "context": {
    "patientId": "patient-123"
  }
}
```

### Specialized APIs

#### Vital Signs
```http
POST /api/vitals/{patientId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "encounterId": "encounter-123",
  "vitals": {
    "temperature": 98.6,
    "bloodPressureSystolic": 120,
    "bloodPressureDiastolic": 80,
    "heartRate": 72
  }
}
```

## 🔐 Security Implementation

### Authentication Methods

1. **SMART on FHIR OAuth2**
   - EHR Launch with `launch` parameter
   - Standalone Launch with PKCE
   - Client Credentials for system access

2. **Internal JWT**
   - Username/password authentication
   - Role-based access control
   - Refresh token support

### Authorization Scopes

| Scope Pattern | Description |
|---------------|-------------|
| `patient/*.read` | Read patient-specific resources |
| `patient/*.write` | Write patient-specific resources |
| `user/*.read` | Read resources in user context |
| `user/*.write` | Write resources in user context |
| `system/*.read` | System-level read access |
| `system/*.write` | System-level write access |
| `admin` | Administrative functions |

### Security Features

- **Rate Limiting**: 100 requests per 15 minutes per user
- **Input Validation**: Comprehensive input sanitization
- **Audit Logging**: All API access logged with user context
- **CORS Protection**: Configurable CORS policy
- **Helmet.js**: Security headers and protections

## 📊 Monitoring & Observability

### Health Checks
```http
GET /health
```

Returns comprehensive system health:
```json
{
  "status": "UP",
  "timestamp": "2025-06-20T00:00:00Z",
  "components": {
    "medplum": { "status": "UP", "responseTime": "45ms" },
    "cdsHooks": { "status": "UP" },
    "subscriptions": { "status": "UP", "connections": 15 }
  }
}
```

### Logging Strategy

- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: debug, info, warn, error
- **Contexts**: FHIR, security, performance, audit, integration
- **Output**: Console (development), files (production)

### Performance Metrics

- API response times and error rates
- Database connection pool usage
- Memory and CPU utilization
- WebSocket connection counts
- Cache hit/miss ratios

## 🧪 Testing

### Running Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Test Categories

1. **Unit Tests**: Service layer and utility functions
2. **Integration Tests**: API endpoints and database operations
3. **Security Tests**: Authentication and authorization flows
4. **Performance Tests**: Load testing and benchmarks

## 🚢 Deployment

### Production Checklist

- [ ] Environment variables configured
- [ ] Database initialized and migrated
- [ ] SSL certificates installed
- [ ] Logging configured
- [ ] Monitoring setup
- [ ] Backup strategy implemented
- [ ] Security review completed

### Docker Production Deployment

1. **Build Production Image**
   ```bash
   docker build -f docker/Dockerfile -t omnicare-backend:latest .
   ```

2. **Run with Production Config**
   ```bash
   docker run -d \
     --name omnicare-backend \
     -p 8080:8080 \
     -e NODE_ENV=production \
     -e DATABASE_URL=postgresql://... \
     -e JWT_SECRET=... \
     omnicare-backend:latest
   ```

### Kubernetes Deployment

Helm charts and Kubernetes manifests available in `k8s/` directory.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Write comprehensive tests
- Document all public APIs
- Use conventional commit messages
- Update documentation for breaking changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [API Documentation](docs/api.md)
- **Issues**: [GitHub Issues](https://github.com/omnicare/backend/issues)
- **Discussions**: [GitHub Discussions](https://github.com/omnicare/backend/discussions)

## 🙏 Acknowledgments

- [Medplum](https://www.medplum.com/) - FHIR server platform
- [HL7 FHIR](https://hl7.org/fhir/) - Healthcare interoperability standard
- [SMART on FHIR](https://smarthealthit.org/) - Healthcare application authorization
- [CDS Hooks](https://cds-hooks.org/) - Clinical decision support framework