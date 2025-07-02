# OmniCare EMR Production Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Overview](#infrastructure-overview)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Deployment Process](#deployment-process)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Rollback Procedures](#rollback-procedures)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools
- kubectl v1.28+
- Helm v3.12+
- Docker v24.0+
- AWS CLI v2.13+
- Node.js v18.x
- npm v9.x+

### Access Requirements
- Kubernetes cluster admin access
- AWS IAM permissions for EKS, RDS, S3
- Container registry access (GitHub Container Registry)
- Monitoring dashboard access (Prometheus/Grafana)
- PagerDuty/Slack webhook tokens

### Environment Variables
```bash
export KUBECONFIG=/path/to/omnicare-prod-kubeconfig
export AWS_PROFILE=omnicare-prod
export GITHUB_TOKEN=<your-github-token>
export REGISTRY=ghcr.io
```

## Infrastructure Overview

### Production Architecture
- **Kubernetes Cluster**: EKS 1.28 (Multi-AZ deployment)
- **Database**: PostgreSQL 15 (RDS Multi-AZ with read replicas)
- **Cache**: Redis 7 (ElastiCache cluster mode)
- **Load Balancer**: AWS ALB with WAF
- **CDN**: CloudFront
- **Storage**: S3 for backups, EBS for persistent volumes

### Services
1. **Backend API**: 3 replicas minimum, HPA enabled
2. **Frontend**: 3 replicas minimum, served via CDN
3. **Database**: Primary + 2 read replicas
4. **Redis**: Cluster mode with 3 shards
5. **Monitoring**: Prometheus, Grafana, AlertManager

## Pre-Deployment Checklist

### Code Quality Gates
- [ ] All CI/CD checks passing on main branch
- [ ] Security scans completed (Snyk, CodeQL)
- [ ] HIPAA compliance checks passed
- [ ] Performance tests meet SLA requirements
- [ ] Test coverage > 80%

### Dependency Updates
- [ ] All npm packages updated and audited
- [ ] No critical security vulnerabilities
- [ ] Docker base images updated
- [ ] Kubernetes manifests validated

### Documentation
- [ ] API documentation updated
- [ ] Release notes prepared
- [ ] Customer communication drafted

### Backup Verification
- [ ] Database backup completed and verified
- [ ] Configuration backups stored
- [ ] Recovery procedures tested

## Deployment Process

### Step 1: Build and Push Docker Images

```bash
# Build and tag images
VERSION=$(git describe --tags --always)

# Backend
cd backend
docker build -t $REGISTRY/omnicare/backend:$VERSION .
docker push $REGISTRY/omnicare/backend:$VERSION

# Frontend
cd ../frontend
docker build -t $REGISTRY/omnicare/frontend:$VERSION .
docker push $REGISTRY/omnicare/frontend:$VERSION
```

### Step 2: Database Migrations

```bash
# Connect to production database
kubectl run -it --rm migrate-pod \
  --image=$REGISTRY/omnicare/backend:$VERSION \
  --env="DATABASE_URL=$PROD_DATABASE_URL" \
  -- npm run migrate:up

# Verify migrations
kubectl exec -it postgres-primary-0 -- psql -U omnicare_prod_user -d omnicare_emr_prod \
  -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;"
```

### Step 3: Deploy Backend Services

```bash
# Update backend deployment
kubectl set image deployment/backend \
  backend=$REGISTRY/omnicare/backend:$VERSION \
  -n omnicare-prod

# Wait for rollout
kubectl rollout status deployment/backend -n omnicare-prod

# Verify pods
kubectl get pods -n omnicare-prod -l app=backend
```

### Step 4: Deploy Frontend Services

```bash
# Update frontend deployment
kubectl set image deployment/frontend \
  frontend=$REGISTRY/omnicare/frontend:$VERSION \
  -n omnicare-prod

# Wait for rollout
kubectl rollout status deployment/frontend -n omnicare-prod

# Invalidate CDN cache
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*"
```

### Step 5: Update Configuration

```bash
# Update ConfigMaps if needed
kubectl apply -f devops/kubernetes/production-config.yaml

# Update Secrets (if rotated)
kubectl create secret generic backend-secret \
  --from-literal=JWT_SECRET=$NEW_JWT_SECRET \
  --dry-run=client -o yaml | kubectl apply -f -
```

## Post-Deployment Verification

### Health Checks

```bash
# Backend health
curl -f https://api.omnicare-health.com/health

# Frontend health
curl -f https://omnicare-health.com/api/health

# Database connectivity
kubectl exec -it backend-pod -- npm run db:test
```

### Smoke Tests

```bash
# Run automated smoke tests
npm run test:smoke -- --env=production

# Key user flows to verify:
# 1. User authentication
# 2. Patient data retrieval
# 3. Clinical note creation
# 4. Offline sync functionality
```

### Performance Verification

```bash
# Run performance benchmark
npm run benchmark:production

# Check key metrics:
# - API response time < 200ms (p95)
# - Database query time < 100ms (p95)
# - Page load time < 3s
```

### Monitoring Verification

1. Check Grafana dashboards:
   - SLA metrics (availability, response time, error rate)
   - Resource utilization
   - Database performance

2. Verify alerts in AlertManager:
   - Critical alerts configured
   - PagerDuty integration working
   - Slack notifications active

## Rollback Procedures

### Immediate Rollback (< 5 minutes)

```bash
# Rollback deployment
kubectl rollout undo deployment/backend -n omnicare-prod
kubectl rollout undo deployment/frontend -n omnicare-prod

# Verify rollback
kubectl rollout status deployment/backend -n omnicare-prod
kubectl rollout status deployment/frontend -n omnicare-prod
```

### Database Rollback

```bash
# Only if migrations were applied
kubectl run -it --rm rollback-pod \
  --image=$REGISTRY/omnicare/backend:$PREVIOUS_VERSION \
  --env="DATABASE_URL=$PROD_DATABASE_URL" \
  -- npm run migrate:down

# Restore from backup if needed
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier omnicare-prod-restored \
  --db-snapshot-identifier omnicare-prod-backup-$TIMESTAMP
```

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Application Metrics**
   - Request rate and latency
   - Error rate (target < 0.1%)
   - Active user sessions
   - API endpoint performance

2. **Infrastructure Metrics**
   - CPU/Memory utilization
   - Pod restart frequency
   - Network I/O
   - Disk usage

3. **Database Metrics**
   - Connection pool usage
   - Query performance
   - Replication lag
   - Lock contention

4. **HIPAA Compliance Metrics**
   - Audit log generation
   - Failed authentication attempts
   - Data access patterns
   - Encryption status

### Alert Response Matrix

| Alert | Severity | Response Time | Action |
|-------|----------|---------------|--------|
| Service Down | Critical | < 5 min | Page on-call, initiate incident |
| High Error Rate | Critical | < 15 min | Investigate logs, consider rollback |
| Database Connection Exhaustion | High | < 30 min | Scale connection pool, investigate leaks |
| High CPU/Memory | Medium | < 1 hour | Scale resources, investigate cause |
| Certificate Expiry | Low | < 24 hours | Renew certificates |

## Troubleshooting

### Common Issues and Solutions

#### 1. Deployment Stuck in Pending
```bash
# Check pod events
kubectl describe pod <pod-name> -n omnicare-prod

# Common causes:
# - Insufficient resources: Scale cluster
# - Image pull errors: Check registry access
# - PVC issues: Verify storage availability
```

#### 2. Database Connection Errors
```bash
# Test connectivity
kubectl exec -it backend-pod -- nc -zv postgres-primary 5432

# Check connection pool
kubectl exec -it backend-pod -- npm run db:pool:status

# Verify credentials
kubectl get secret postgres-prod-secret -o jsonpath='{.data.DATABASE_URL}' | base64 -d
```

#### 3. High Response Times
```bash
# Check slow queries
kubectl exec -it postgres-primary-0 -- psql -U omnicare_prod_user \
  -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Review application logs
kubectl logs -f deployment/backend -n omnicare-prod --tail=100

# Check resource constraints
kubectl top pods -n omnicare-prod
```

#### 4. Offline Sync Issues
```bash
# Check sync queue
kubectl exec -it backend-pod -- npm run sync:status

# Verify WebSocket connectivity
kubectl logs -f deployment/backend -n omnicare-prod | grep websocket

# Clear problematic sync data
kubectl exec -it backend-pod -- npm run sync:clear-failed
```

### Emergency Contacts

- **DevOps On-Call**: +1-XXX-XXX-XXXX
- **DBA Team**: +1-XXX-XXX-XXXX
- **Security Team**: +1-XXX-XXX-XXXX
- **PagerDuty**: omnicare-critical@pagerduty.com

### Useful Commands Reference

```bash
# Get all resources in namespace
kubectl get all -n omnicare-prod

# Tail logs across all backend pods
kubectl logs -f -l app=backend -n omnicare-prod --all-containers

# Execute command in pod
kubectl exec -it <pod-name> -n omnicare-prod -- /bin/sh

# Port forward for debugging
kubectl port-forward svc/backend 3001:3001 -n omnicare-prod

# Get resource usage
kubectl top nodes
kubectl top pods -n omnicare-prod

# Check cluster events
kubectl get events -n omnicare-prod --sort-by='.lastTimestamp'
```

## Appendix

### Version History
- v1.0.0 - Initial production deployment
- v1.1.0 - Added Redis cluster mode
- v1.2.0 - Enhanced monitoring and alerting
- v2.0.0 - Multi-region deployment support

### Related Documentation
- [Disaster Recovery Plan](./DISASTER_RECOVERY.md)
- [Security Hardening Guide](./SECURITY_HARDENING.md)
- [Performance Tuning Guide](./PERFORMANCE_TUNING.md)
- [HIPAA Compliance Checklist](./HIPAA_COMPLIANCE.md)