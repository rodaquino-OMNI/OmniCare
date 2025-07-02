# OmniCare EMR - Deployment Instructions

## Overview

This document provides comprehensive deployment instructions for OmniCare EMR across various environments including development, staging, and production. It covers both cloud and on-premises deployment scenarios.

## Infrastructure Requirements

### Minimum Hardware Requirements

#### Production Environment
- **Application Servers**: 3 nodes minimum
  - CPU: 8 vCPUs per node
  - RAM: 16GB per node
  - Storage: 100GB SSD per node
- **Database Server**:
  - CPU: 16 vCPUs
  - RAM: 64GB
  - Storage: 1TB SSD (NVMe preferred)
- **Cache Server (Redis)**:
  - CPU: 4 vCPUs
  - RAM: 16GB
  - Storage: 50GB SSD

#### Development/Staging Environment
- **Application Server**: 1 node
  - CPU: 4 vCPUs
  - RAM: 8GB
  - Storage: 50GB
- **Database Server**:
  - CPU: 4 vCPUs
  - RAM: 16GB
  - Storage: 200GB

### Software Requirements
- **Operating System**: Ubuntu 22.04 LTS or RHEL 8+
- **Container Runtime**: Docker 20.10+
- **Orchestration**: Kubernetes 1.25+
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7.0+
- **Load Balancer**: NGINX or HAProxy

## Cloud Deployment

### AWS Deployment

#### 1. Infrastructure Setup with Terraform
```hcl
# terraform/aws/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# VPC Configuration
resource "aws_vpc" "omnicare_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "omnicare-vpc"
    Environment = var.environment
  }
}

# Private Subnets for Application
resource "aws_subnet" "private_subnet" {
  count             = 3
  vpc_id            = aws_vpc.omnicare_vpc.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "omnicare-private-subnet-${count.index + 1}"
    Type = "private"
  }
}

# EKS Cluster
resource "aws_eks_cluster" "omnicare_cluster" {
  name     = "omnicare-eks-cluster"
  role_arn = aws_iam_role.eks_cluster_role.arn

  vpc_config {
    subnet_ids              = aws_subnet.private_subnet[*].id
    endpoint_private_access = true
    endpoint_public_access  = false
    security_group_ids      = [aws_security_group.eks_cluster_sg.id]
  }

  encryption_config {
    provider {
      key_arn = aws_kms_key.eks_encryption.arn
    }
    resources = ["secrets"]
  }
}

# RDS PostgreSQL
resource "aws_db_instance" "omnicare_db" {
  identifier     = "omnicare-postgres"
  engine         = "postgres"
  engine_version = "15.3"
  instance_class = "db.r6g.2xlarge"
  
  allocated_storage     = 1000
  storage_encrypted     = true
  storage_type          = "io1"
  iops                  = 10000
  
  db_name  = "omnicare"
  username = "omnicare_admin"
  password = var.db_password # From AWS Secrets Manager
  
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  db_subnet_group_name   = aws_db_subnet_group.omnicare.name
  
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  tags = {
    Name        = "omnicare-database"
    Environment = var.environment
  }
}

# ElastiCache Redis Cluster
resource "aws_elasticache_replication_group" "omnicare_redis" {
  replication_group_id       = "omnicare-redis-cluster"
  replication_group_description = "OmniCare Redis cluster"
  engine                     = "redis"
  node_type                  = "cache.r6g.large"
  number_cache_clusters      = 3
  parameter_group_name       = "default.redis7"
  port                      = 6379
  
  subnet_group_name = aws_elasticache_subnet_group.omnicare.name
  security_group_ids = [aws_security_group.redis_sg.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token
  
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  snapshot_retention_limit = 7
  snapshot_window         = "03:00-05:00"
}
```

#### 2. Kubernetes Deployment
```yaml
# k8s/production/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: omnicare-backend
  namespace: omnicare
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: omnicare-backend
  template:
    metadata:
      labels:
        app: omnicare-backend
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: omnicare-backend
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: backend
        image: omnicare/backend:v1.0.0
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: omnicare-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: omnicare-secrets
              key: redis-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: omnicare-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          successThreshold: 1
          failureThreshold: 3
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: omnicare-config
---
apiVersion: v1
kind: Service
metadata:
  name: omnicare-backend-service
  namespace: omnicare
spec:
  selector:
    app: omnicare-backend
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: omnicare-backend-hpa
  namespace: omnicare
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: omnicare-backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
```

#### 3. Ingress Configuration
```yaml
# k8s/production/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: omnicare-ingress
  namespace: omnicare
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/limit-connections: "50"
spec:
  tls:
  - hosts:
    - api.omnicare.health
    secretName: omnicare-tls
  rules:
  - host: api.omnicare.health
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: omnicare-backend-service
            port:
              number: 80
```

### Azure Deployment

#### 1. Azure Kubernetes Service (AKS)
```bash
# Create resource group
az group create --name omnicare-rg --location eastus

# Create AKS cluster
az aks create \
  --resource-group omnicare-rg \
  --name omnicare-aks \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --enable-managed-identity \
  --enable-addons monitoring \
  --enable-ahub \
  --network-plugin azure \
  --network-policy azure

# Get credentials
az aks get-credentials --resource-group omnicare-rg --name omnicare-aks

# Create Azure Database for PostgreSQL
az postgres flexible-server create \
  --resource-group omnicare-rg \
  --name omnicare-postgres \
  --location eastus \
  --admin-user omnicare \
  --admin-password $DB_PASSWORD \
  --sku-name Standard_D4s_v3 \
  --storage-size 1024 \
  --version 15 \
  --high-availability ZoneRedundant \
  --backup-retention 30
```

## Docker Deployment

### 1. Docker Compose for Development
```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:password@db:5432/omnicare
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules
    command: npm run dev

  frontend:
    build: ./frontend
    ports:
      - "3001:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3000/api
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: omnicare
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend

volumes:
  postgres_data:
  redis_data:
```

### 2. Production Docker Build
```dockerfile
# backend/Dockerfile.production
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Set permissions
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

## Deployment Process

### 1. Pre-deployment Checklist
```bash
#!/bin/bash
# scripts/pre-deployment-check.sh

echo "Running pre-deployment checks..."

# Check Node version
NODE_VERSION=$(node -v)
echo "✓ Node version: $NODE_VERSION"

# Run tests
echo "Running tests..."
npm test
if [ $? -ne 0 ]; then
  echo "✗ Tests failed. Aborting deployment."
  exit 1
fi
echo "✓ All tests passed"

# Run security audit
echo "Running security audit..."
npm audit
if [ $? -ne 0 ]; then
  echo "⚠ Security vulnerabilities found. Review before deployment."
fi

# Build application
echo "Building application..."
npm run build
if [ $? -ne 0 ]; then
  echo "✗ Build failed. Aborting deployment."
  exit 1
fi
echo "✓ Build successful"

# Check environment variables
REQUIRED_VARS=("DATABASE_URL" "REDIS_URL" "JWT_SECRET" "ENCRYPTION_KEY")
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "✗ Missing required environment variable: $var"
    exit 1
  fi
done
echo "✓ All required environment variables set"

echo "Pre-deployment checks completed successfully!"
```

### 2. Database Migration
```bash
#!/bin/bash
# scripts/migrate-database.sh

echo "Running database migrations..."

# Backup current database
echo "Creating database backup..."
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
npm run db:migrate

if [ $? -eq 0 ]; then
  echo "✓ Migrations completed successfully"
else
  echo "✗ Migration failed. Restoring from backup..."
  psql $DATABASE_URL < backup_*.sql
  exit 1
fi
```

### 3. Zero-downtime Deployment
```yaml
# k8s/rolling-update.yaml
apiVersion: v1
kind: Service
metadata:
  name: omnicare-backend-canary
spec:
  selector:
    app: omnicare-backend
    version: canary
  ports:
  - port: 80
    targetPort: 3000
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: omnicare-backend-canary
spec:
  replicas: 1
  selector:
    matchLabels:
      app: omnicare-backend
      version: canary
  template:
    metadata:
      labels:
        app: omnicare-backend
        version: canary
    spec:
      containers:
      - name: backend
        image: omnicare/backend:v1.1.0-canary
        # ... rest of configuration
```

## Monitoring and Observability

### 1. Prometheus Configuration
```yaml
# monitoring/prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    scrape_configs:
    - job_name: 'omnicare-backend'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: keep
        regex: omnicare-backend
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
```

### 2. Grafana Dashboard
```json
{
  "dashboard": {
    "title": "OmniCare EMR Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      }
    ]
  }
}
```

## Backup and Recovery

### 1. Automated Backup Script
```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/backups/$(date +%Y/%m/%d)"
mkdir -p $BACKUP_DIR

# Database backup
echo "Backing up database..."
pg_dump $DATABASE_URL | gzip > "$BACKUP_DIR/database_$(date +%H%M%S).sql.gz"

# File storage backup
echo "Backing up file storage..."
aws s3 sync s3://$S3_BUCKET "$BACKUP_DIR/files/" --exclude "*.tmp"

# Configuration backup
echo "Backing up configuration..."
kubectl get configmap -n omnicare -o yaml > "$BACKUP_DIR/configmaps.yaml"
kubectl get secret -n omnicare -o yaml > "$BACKUP_DIR/secrets.yaml"

# Upload to backup storage
aws s3 sync $BACKUP_DIR s3://$BACKUP_BUCKET/$(date +%Y/%m/%d)/

echo "Backup completed successfully"
```

### 2. Recovery Procedure
```bash
#!/bin/bash
# scripts/recover.sh

RECOVERY_DATE=$1
if [ -z "$RECOVERY_DATE" ]; then
  echo "Usage: ./recover.sh YYYY-MM-DD"
  exit 1
fi

# Download backup
aws s3 sync s3://$BACKUP_BUCKET/$RECOVERY_DATE/ /tmp/recovery/

# Restore database
gunzip -c /tmp/recovery/database_*.sql.gz | psql $DATABASE_URL

# Restore files
aws s3 sync /tmp/recovery/files/ s3://$S3_BUCKET/

# Restore configuration
kubectl apply -f /tmp/recovery/configmaps.yaml
kubectl apply -f /tmp/recovery/secrets.yaml

echo "Recovery completed"
```

## Post-deployment Verification

### 1. Health Check Script
```bash
#!/bin/bash
# scripts/post-deployment-check.sh

echo "Running post-deployment verification..."

# Check API health
API_HEALTH=$(curl -s https://api.omnicare.health/health)
if [[ $API_HEALTH == *"healthy"* ]]; then
  echo "✓ API is healthy"
else
  echo "✗ API health check failed"
  exit 1
fi

# Check database connectivity
DB_CHECK=$(curl -s https://api.omnicare.health/health/db)
if [[ $DB_CHECK == *"connected"* ]]; then
  echo "✓ Database connection successful"
else
  echo "✗ Database connection failed"
  exit 1
fi

# Run smoke tests
npm run test:smoke
if [ $? -eq 0 ]; then
  echo "✓ Smoke tests passed"
else
  echo "✗ Smoke tests failed"
  exit 1
fi

echo "Post-deployment verification completed successfully!"
```

---

*For API documentation, see the [API Documentation](./06-API-Documentation.md)*

*Document Version: 1.0.0*  
*Last Updated: ${new Date().toISOString().split('T')[0]}*  
*© 2025 OmniCare EMR - Proprietary and Confidential*