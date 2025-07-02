# OmniCare EMR - Architecture Overview

## System Architecture Principles

OmniCare EMR is built on modern architectural principles that ensure scalability, security, and maintainability while providing exceptional performance and user experience.

### Core Principles

1. **FHIR-Native Design**: All data structures and APIs conform to FHIR R4 specifications
2. **Microservices Architecture**: Loosely coupled services for independent scaling
3. **Event-Driven Communication**: Asynchronous messaging for real-time updates
4. **API-First Development**: All functionality exposed through well-documented APIs
5. **Cloud-Native Deployment**: Containerized services with orchestration
6. **Security by Design**: Zero-trust architecture with defense in depth
7. **Offline-First Capability**: Full functionality without network connectivity
8. **Progressive Enhancement**: Core functionality works everywhere, enhanced features when available

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Client Applications                              │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Web App    │  │ Mobile iOS  │  │Mobile Android│  │Patient Portal│   │
│  │ (Next.js)   │  │(React Native)│ │(React Native)│  │   (PWA)     │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API Gateway Layer                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │Load Balancer │  │ Rate Limiter │  │Authentication│  │ API Router │ │
│  │  (Nginx)     │  │              │  │  (OAuth 2.0) │  │            │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Business Services Layer                           │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────┐ ┌────────────────┐ ┌───────────────┐ ┌─────────────┐│
│ │Clinical Service│ │Order Management│ │Results Service│ │Billing Svc │ │
│ └───────────────┘ └────────────────┘ └───────────────┘ └─────────────┘│
│ ┌───────────────┐ ┌────────────────┐ ┌───────────────┐ ┌─────────────┐│
│ │ CDS Engine    │ │Notification Svc│ │Analytics Svc  │ │Workflow Svc│ │
│ └───────────────┘ └────────────────┘ └───────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Data Access Layer                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌───────────────┐  ┌────────────────┐            │
│  │ Medplum FHIR   │  │ Cache Layer   │  │ Search Engine  │            │
│  │    Server      │  │   (Redis)     │  │(Elasticsearch)│            │
│  └────────────────┘  └───────────────┘  └────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Data Storage Layer                              │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌───────────────┐  ┌────────────────┐            │
│  │  PostgreSQL    │  │ Object Storage│  │  Audit Database│            │
│  │  (Primary DB)  │  │   (S3/Blob)   │  │  (PostgreSQL) │            │
│  └────────────────┘  └───────────────┘  └────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Architecture

#### Web Application (Next.js)
```typescript
// Application Structure
/frontend
├── /src
│   ├── /app                 # Next.js App Router
│   │   ├── /dashboard      # Clinical dashboard
│   │   ├── /patients       # Patient management
│   │   ├── /clinical       # Clinical documentation
│   │   └── /api           # API routes
│   ├── /components         # Reusable UI components
│   │   ├── /clinical      # Clinical-specific components
│   │   ├── /patient       # Patient-related components
│   │   └── /shared        # Shared components
│   ├── /hooks             # Custom React hooks
│   ├── /services          # API service layer
│   ├── /stores            # State management (Zustand)
│   └── /utils             # Utility functions
```

#### Key Frontend Technologies
- **React 18.3**: Latest React with concurrent features
- **Next.js 15**: Server-side rendering and static generation
- **TypeScript 5.x**: Type-safe development
- **Mantine UI 7.x**: Component library
- **TanStack Query**: Server state management
- **Zustand**: Client state management
- **Service Workers**: Offline functionality

### Backend Architecture

#### Service Layer Design
```typescript
// Microservice Structure
/backend
├── /src
│   ├── /auth              # Authentication service
│   ├── /clinical          # Clinical data service
│   ├── /orders            # Order management service
│   ├── /results           # Results processing service
│   ├── /billing           # Billing service
│   ├── /notifications     # Notification service
│   ├── /analytics         # Analytics service
│   └── /gateway          # API gateway
```

#### Core Services

1. **Authentication Service**
   - OAuth 2.0 / OpenID Connect
   - SMART on FHIR integration
   - Multi-factor authentication
   - Session management

2. **Clinical Service**
   - Patient data management
   - Clinical documentation
   - Problem lists and diagnoses
   - Medication management

3. **Order Management Service**
   - CPOE functionality
   - Order sets and protocols
   - Order routing and tracking
   - Result acknowledgment

4. **Notification Service**
   - Real-time notifications
   - Email/SMS integration
   - Push notifications
   - Alert management

### Data Architecture

#### FHIR Resource Model
```typescript
// Core FHIR Resources Used
interface CoreResources {
  // Administrative
  Patient: 'Demographics and identifiers';
  Practitioner: 'Healthcare provider information';
  Organization: 'Healthcare organizations';
  Location: 'Physical locations';
  
  // Clinical
  Encounter: 'Clinical visits and admissions';
  Condition: 'Diagnoses and problems';
  Observation: 'Vital signs and lab results';
  Procedure: 'Procedures performed';
  
  // Medications
  Medication: 'Medication definitions';
  MedicationRequest: 'Prescription orders';
  MedicationAdministration: 'Medication given';
  
  // Orders
  ServiceRequest: 'Lab and diagnostic orders';
  DiagnosticReport: 'Lab and imaging results';
  
  // Documents
  DocumentReference: 'Clinical documents';
  Binary: 'Binary content (PDFs, images)';
}
```

#### Database Schema
```sql
-- Core Tables (managed by Medplum)
-- FHIR resources stored as JSONB in PostgreSQL

-- Custom Tables for Performance
CREATE TABLE patient_search_index (
    id UUID PRIMARY KEY,
    patient_id VARCHAR(255) NOT NULL,
    mrn VARCHAR(100),
    name_lower VARCHAR(255),
    birth_date DATE,
    phone VARCHAR(50),
    email VARCHAR(255),
    last_updated TIMESTAMPTZ,
    CONSTRAINT fk_patient FOREIGN KEY (patient_id) 
        REFERENCES "Patient"(id) ON DELETE CASCADE
);

CREATE INDEX idx_patient_search_name ON patient_search_index(name_lower);
CREATE INDEX idx_patient_search_mrn ON patient_search_index(mrn);
CREATE INDEX idx_patient_search_dob ON patient_search_index(birth_date);
```

### Integration Architecture

#### SMART on FHIR Integration
```typescript
// SMART App Launch Flow
interface SmartLaunchFlow {
  // 1. EHR launches app with context
  launch: {
    iss: 'https://ehr.hospital.org/fhir';
    launch: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';
  };
  
  // 2. App discovers OAuth endpoints
  discovery: {
    authorization_endpoint: string;
    token_endpoint: string;
    introspection_endpoint: string;
  };
  
  // 3. App requests authorization
  authorize: {
    client_id: string;
    scope: 'patient/*.read user/*.* launch';
    redirect_uri: string;
    state: string;
  };
  
  // 4. App exchanges code for token
  token: {
    access_token: string;
    patient: string;
    expires_in: number;
  };
}
```

#### HL7v2 Integration
```typescript
// HL7v2 Message Processing
interface HL7Integration {
  // Inbound messages
  inbound: {
    ADT: 'Patient admission/discharge/transfer';
    ORM: 'Order messages';
    ORU: 'Result messages';
    MDM: 'Medical document management';
  };
  
  // Message processing pipeline
  pipeline: {
    receive: 'MLLP listener';
    parse: 'HL7 parser';
    transform: 'HL7 to FHIR mapper';
    validate: 'FHIR validation';
    store: 'FHIR server';
  };
}
```

### Security Architecture

#### Authentication Flow
```
┌─────────┐      ┌──────────┐      ┌─────────────┐      ┌──────────┐
│  User   │      │ Web App  │      │Auth Service │      │ Medplum  │
└────┬────┘      └────┬─────┘      └──────┬──────┘      └────┬─────┘
     │                │                     │                   │
     │   1. Login    │                     │                   │
     ├───────────────>                     │                   │
     │                │  2. Auth Request   │                   │
     │                ├────────────────────>                   │
     │                │                     │ 3. Validate       │
     │                │                     ├──────────────────>
     │                │                     │                   │
     │                │                     │ 4. User Info      │
     │                │                     <───────────────────
     │                │ 5. JWT Token       │                   │
     │                <─────────────────────                   │
     │  6. Redirect   │                     │                   │
     <─────────────────                     │                   │
```

#### Data Protection
- **Encryption at Rest**: AES-256-GCM
- **Encryption in Transit**: TLS 1.3
- **Key Management**: AWS KMS / Azure Key Vault
- **Field-Level Encryption**: Sensitive PHI fields

### Performance Architecture

#### Caching Strategy
```typescript
// Multi-Level Caching
interface CachingLayers {
  // L1: Browser Cache
  browser: {
    serviceWorker: 'Offline-first caching';
    localStorage: 'User preferences';
    sessionStorage: 'Temporary data';
  };
  
  // L2: CDN Cache
  cdn: {
    static: 'Static assets (JS, CSS, images)';
    api: 'Cacheable API responses';
  };
  
  // L3: Application Cache
  application: {
    redis: 'Session data and hot data';
    memory: 'Frequently accessed data';
  };
  
  // L4: Database Cache
  database: {
    queryCache: 'PostgreSQL query cache';
    indexes: 'Optimized indexes';
  };
}
```

#### Load Balancing
```yaml
# Kubernetes Service Configuration
apiVersion: v1
kind: Service
metadata:
  name: omnicare-backend
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
spec:
  type: LoadBalancer
  selector:
    app: omnicare-backend
  ports:
    - port: 80
      targetPort: 3000
  sessionAffinity: ClientIP
```

### Monitoring and Observability

#### Metrics Collection
```typescript
// Prometheus Metrics
interface MetricsCollection {
  // Application Metrics
  application: {
    httpRequestDuration: Histogram;
    httpRequestsTotal: Counter;
    activeUsers: Gauge;
    errorRate: Counter;
  };
  
  // Business Metrics
  business: {
    documentsCreated: Counter;
    ordersPlaced: Counter;
    criticalAlerts: Counter;
    loginAttempts: Counter;
  };
  
  // Infrastructure Metrics
  infrastructure: {
    cpuUsage: Gauge;
    memoryUsage: Gauge;
    databaseConnections: Gauge;
    cacheHitRate: Gauge;
  };
}
```

#### Distributed Tracing
```typescript
// Jaeger Tracing Configuration
interface TracingConfig {
  serviceName: 'omnicare-backend';
  sampler: {
    type: 'probabilistic';
    param: 0.1; // Sample 10% of requests
  };
  reporter: {
    endpoint: 'http://jaeger-collector:14268/api/traces';
  };
}
```

## Deployment Architecture

### Container Strategy
```dockerfile
# Multi-stage Dockerfile for Backend
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS dev-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM dev-deps AS build
COPY . .
RUN npm run build

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Kubernetes Deployment
```yaml
# Deployment Configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: omnicare-backend
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      containers:
      - name: backend
        image: omnicare/backend:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Scalability Patterns

### Horizontal Scaling
- **Auto-scaling**: Based on CPU, memory, and request metrics
- **Load Distribution**: Round-robin with session affinity
- **Database Pooling**: Connection pooling for database efficiency
- **Caching**: Distributed caching with Redis cluster

### Vertical Scaling
- **Resource Optimization**: JIT compilation and memory management
- **Database Tuning**: Query optimization and indexing
- **Caching Strategy**: Multi-level caching for performance

## Disaster Recovery

### Backup Strategy
- **Database**: Automated daily backups with point-in-time recovery
- **Object Storage**: Cross-region replication for documents
- **Configuration**: Version-controlled infrastructure as code

### High Availability
- **Multi-AZ Deployment**: Services distributed across availability zones
- **Database Replication**: Primary-replica configuration
- **Load Balancer**: Health checks and automatic failover
- **Circuit Breakers**: Prevent cascade failures

---

*For implementation details, see the [Implementation Guide](./03-Implementation-Guide.md)*

*Document Version: 1.0.0*  
*Last Updated: ${new Date().toISOString().split('T')[0]}*  
*© 2025 OmniCare EMR - Proprietary and Confidential*