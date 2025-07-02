# OmniCare EMR Production Operations Runbook

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Incident Response](#incident-response)
3. [Maintenance Procedures](#maintenance-procedures)
4. [Security Operations](#security-operations)
5. [Performance Management](#performance-management)
6. [Backup & Recovery](#backup--recovery)
7. [Compliance Operations](#compliance-operations)
8. [Communication Protocols](#communication-protocols)

## Daily Operations

### Morning Health Check (8:00 AM EST)

```bash
#!/bin/bash
# Daily health check script

echo "=== OmniCare Production Health Check ==="
echo "Date: $(date)"

# 1. Check cluster health
echo -e "\n[1] Kubernetes Cluster Status"
kubectl get nodes
kubectl get pods -n omnicare-prod | grep -v Running

# 2. Check application health
echo -e "\n[2] Application Health"
curl -s https://api.omnicare-health.com/health | jq .
curl -s https://omnicare-health.com/api/health | jq .

# 3. Check database health
echo -e "\n[3] Database Status"
kubectl exec -it postgres-primary-0 -n omnicare-prod -- \
  psql -U omnicare_prod_user -c "SELECT version();"

# 4. Check recent errors
echo -e "\n[4] Recent Errors (last hour)"
kubectl logs -n omnicare-prod -l app=backend --since=1h | grep ERROR | tail -10

# 5. Check SLA metrics
echo -e "\n[5] SLA Metrics"
curl -s http://prometheus:9090/api/v1/query?query=omnicare_sla_availability_percentage
```

### Shift Handover Checklist

- [ ] Review overnight incidents in PagerDuty
- [ ] Check Slack #omnicare-alerts for warnings
- [ ] Review morning health check results
- [ ] Check scheduled maintenance calendar
- [ ] Update team on any ongoing issues
- [ ] Review resource utilization trends

### End-of-Day Procedures

1. **Backup Verification**
   ```bash
   # Verify today's backups
   aws s3 ls s3://omnicare-prod-backups/database/ --recursive | grep $(date +%Y%m%d)
   ```

2. **Log Rotation Check**
   ```bash
   # Ensure logs are rotating properly
   kubectl exec -it backend-pod -n omnicare-prod -- ls -la /app/logs/
   ```

3. **Security Scan Results**
   ```bash
   # Review daily security scan
   kubectl logs -n omnicare-prod job/security-scan-$(date +%Y%m%d)
   ```

## Incident Response

### Incident Severity Levels

| Level | Definition | Response Time | Examples |
|-------|------------|---------------|----------|
| P1 | Complete service outage | < 5 minutes | Site down, data breach |
| P2 | Major functionality impaired | < 15 minutes | Login failures, slow response |
| P3 | Minor functionality affected | < 1 hour | Single feature broken |
| P4 | Non-critical issue | < 4 hours | UI glitch, minor bug |

### P1 Incident Response Procedure

1. **Immediate Actions (0-5 minutes)**
   ```bash
   # Quick diagnostics
   ./scripts/incident-diagnostics.sh
   
   # Capture current state
   kubectl get all -n omnicare-prod > incident-$(date +%s).log
   kubectl describe pods -n omnicare-prod >> incident-$(date +%s).log
   ```

2. **Notify Stakeholders**
   - Page incident commander via PagerDuty
   - Post in #incident-response Slack channel
   - Send initial status to status page

3. **Triage and Diagnose (5-15 minutes)**
   ```bash
   # Check recent deployments
   kubectl rollout history deployment/backend -n omnicare-prod
   
   # Review error logs
   kubectl logs -n omnicare-prod -l app=backend --tail=100 | grep ERROR
   
   # Check database status
   kubectl exec -it postgres-primary-0 -- pg_isready
   ```

4. **Mitigation Options**
   - **Option A**: Rollback to previous version
     ```bash
     kubectl rollout undo deployment/backend -n omnicare-prod
     kubectl rollout undo deployment/frontend -n omnicare-prod
     ```
   
   - **Option B**: Scale up resources
     ```bash
     kubectl scale deployment/backend --replicas=10 -n omnicare-prod
     ```
   
   - **Option C**: Enable maintenance mode
     ```bash
     kubectl apply -f devops/kubernetes/maintenance-mode.yaml
     ```

5. **Resolution and Recovery**
   - Document all actions taken
   - Verify service restoration
   - Monitor for 30 minutes post-recovery
   - Schedule post-mortem

### Incident Communication Template

```
INCIDENT STATUS UPDATE

Severity: P[1-4]
Service: [Affected service]
Impact: [User impact description]
Status: [Investigating/Identified/Monitoring/Resolved]

Current Status:
- [Bullet points of current situation]

Actions Taken:
- [List of mitigation steps]

Next Steps:
- [Planned actions]

ETA: [Estimated time to resolution]
```

## Maintenance Procedures

### Planned Maintenance Window

**Standard Window**: Sundays 2:00 AM - 6:00 AM EST

#### Pre-Maintenance Checklist

- [ ] Maintenance announced 72 hours in advance
- [ ] Backup completed and verified
- [ ] Rollback plan documented
- [ ] Maintenance mode page ready
- [ ] On-call team notified

#### Maintenance Execution

1. **Enable Maintenance Mode**
   ```bash
   kubectl apply -f devops/kubernetes/maintenance-mode.yaml
   kubectl scale deployment/frontend --replicas=1 -n omnicare-prod
   ```

2. **Database Maintenance**
   ```bash
   # Backup current state
   kubectl exec -it postgres-primary-0 -- pg_dump omnicare_emr_prod > backup-pre-maintenance.sql
   
   # Perform maintenance
   kubectl exec -it postgres-primary-0 -- psql -c "VACUUM ANALYZE;"
   kubectl exec -it postgres-primary-0 -- psql -c "REINDEX DATABASE omnicare_emr_prod;"
   ```

3. **Application Updates**
   ```bash
   # Update backend
   kubectl set image deployment/backend backend=$NEW_IMAGE -n omnicare-prod
   kubectl rollout status deployment/backend -n omnicare-prod
   
   # Update frontend
   kubectl set image deployment/frontend frontend=$NEW_IMAGE -n omnicare-prod
   kubectl rollout status deployment/frontend -n omnicare-prod
   ```

4. **Post-Maintenance Verification**
   ```bash
   # Run health checks
   ./scripts/health-check-comprehensive.sh
   
   # Run smoke tests
   npm run test:smoke:production
   
   # Disable maintenance mode
   kubectl delete -f devops/kubernetes/maintenance-mode.yaml
   kubectl scale deployment/frontend --replicas=3 -n omnicare-prod
   ```

### Emergency Maintenance

For critical security patches or urgent fixes:

1. **Assess Impact**
   - Can it wait for maintenance window?
   - What's the risk of not patching?
   - Can we do rolling update?

2. **Expedited Process**
   ```bash
   # Notify stakeholders (minimum 30 min)
   ./scripts/send-emergency-maintenance-notice.sh
   
   # Perform rolling update
   kubectl set image deployment/backend backend=$PATCH_IMAGE \
     -n omnicare-prod --record
   
   # Monitor closely
   watch kubectl get pods -n omnicare-prod
   ```

## Security Operations

### Daily Security Tasks

1. **Review Authentication Logs**
   ```bash
   # Check failed login attempts
   kubectl logs -n omnicare-prod -l app=backend | \
     grep "authentication failed" | \
     awk '{print $5}' | sort | uniq -c | sort -nr
   ```

2. **Monitor Access Patterns**
   ```bash
   # Unusual access patterns
   kubectl exec -it backend-pod -- npm run security:access-audit
   ```

3. **Certificate Expiration Check**
   ```bash
   # Check TLS certificates
   echo | openssl s_client -connect omnicare-health.com:443 2>/dev/null | \
     openssl x509 -noout -enddate
   ```

### Weekly Security Review

- [ ] Review AWS CloudTrail logs
- [ ] Check for new CVEs in dependencies
- [ ] Verify backup encryption
- [ ] Review user access permissions
- [ ] Test incident response procedures

### Security Incident Response

1. **Data Breach Suspected**
   ```bash
   # Immediate actions
   kubectl apply -f devops/kubernetes/emergency-lockdown.yaml
   
   # Preserve evidence
   kubectl cp backend-pod:/var/log/audit.log ./evidence-$(date +%s).log
   
   # Notify security team
   ./scripts/security-breach-notification.sh
   ```

2. **Suspicious Activity**
   - Enable enhanced logging
   - Isolate affected components
   - Review audit trails
   - Implement temporary restrictions

## Performance Management

### Performance Monitoring

```bash
# Real-time performance metrics
watch -n 5 'kubectl top pods -n omnicare-prod'

# Database performance
kubectl exec -it postgres-primary-0 -- \
  psql -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# API response times
curl -w "@curl-format.txt" -o /dev/null -s https://api.omnicare-health.com/health
```

### Performance Optimization Procedures

1. **High CPU Usage**
   ```bash
   # Identify CPU-intensive pods
   kubectl top pods -n omnicare-prod --sort-by=cpu
   
   # Scale horizontally
   kubectl autoscale deployment backend --cpu-percent=70 --min=3 --max=10
   ```

2. **Memory Issues**
   ```bash
   # Check memory usage
   kubectl describe pod <pod-name> | grep -A 5 "Limits:"
   
   # Increase memory limits if needed
   kubectl set resources deployment backend \
     --limits=memory=2Gi --requests=memory=1Gi
   ```

3. **Database Optimization**
   ```sql
   -- Find slow queries
   SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC LIMIT 10;
   
   -- Update statistics
   ANALYZE;
   
   -- Check index usage
   SELECT schemaname, tablename, indexname, idx_scan
   FROM pg_stat_user_indexes
   ORDER BY idx_scan;
   ```

## Backup & Recovery

### Backup Schedule

| Type | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| Database Full | Daily 2 AM | 30 days | S3 |
| Database Incremental | Every 6 hours | 7 days | S3 |
| Application Config | Daily | 30 days | S3 |
| Persistent Volumes | Daily | 7 days | EBS Snapshots |

### Backup Verification

```bash
#!/bin/bash
# Daily backup verification

BUCKET="omnicare-prod-backups"
TODAY=$(date +%Y%m%d)

# Check if backups exist
echo "Checking backups for $TODAY..."

# Database backups
aws s3 ls s3://$BUCKET/database/ | grep $TODAY

# Test restore to verify backup integrity
kubectl run backup-test --rm -it --image=postgres:15 -- \
  psql $TEST_DATABASE_URL < backup-sample.sql
```

### Recovery Procedures

#### Database Recovery

```bash
# Point-in-time recovery
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier omnicare-prod \
  --target-db-instance-identifier omnicare-prod-recovered \
  --restore-time 2024-01-15T03:00:00.000Z

# From snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier omnicare-prod-recovered \
  --db-snapshot-identifier omnicare-prod-snapshot-20240115
```

#### Application Recovery

```bash
# Restore from backup
kubectl create -f backup/omnicare-deployment-backup.yaml

# Restore persistent volumes
kubectl apply -f backup/pvc-restore.yaml

# Restore configuration
kubectl create configmap backend-config \
  --from-file=backup/config/
```

## Compliance Operations

### HIPAA Compliance Daily Tasks

1. **Audit Log Review**
   ```bash
   # Check audit log generation
   kubectl logs -n omnicare-prod audit-logger | grep -c "AUDIT"
   
   # Verify PHI access logging
   kubectl exec -it backend-pod -- tail -f /var/log/phi-access.log
   ```

2. **Access Control Verification**
   ```bash
   # Review user permissions
   kubectl exec -it backend-pod -- npm run compliance:access-review
   
   # Check for orphaned sessions
   kubectl exec -it backend-pod -- npm run session:cleanup
   ```

### Monthly Compliance Audit

- [ ] Generate compliance report
- [ ] Review encryption status
- [ ] Verify backup encryption
- [ ] Test data retention policies
- [ ] Update risk assessment
- [ ] Review third-party access

### Compliance Reporting

```bash
# Generate monthly HIPAA compliance report
./scripts/generate-compliance-report.sh > compliance-$(date +%Y%m).pdf

# Key metrics to include:
# - Uptime percentage
# - Security incidents
# - Failed login attempts
# - PHI access patterns
# - Backup success rate
# - Encryption status
```

## Communication Protocols

### Stakeholder Communication Matrix

| Event | Internal Team | Management | Customers | Method |
|-------|--------------|------------|-----------|---------|
| P1 Incident | Immediate | 15 min | 30 min | Slack/Page/Status |
| P2 Incident | 15 min | 30 min | 1 hour | Slack/Email |
| Maintenance | 72 hours | 72 hours | 72 hours | Email/Banner |
| Security Issue | Immediate | Immediate | As needed | Secure channel |

### Status Page Updates

```bash
# Update status page
curl -X POST https://api.statuspage.io/v1/pages/$PAGE_ID/incidents \
  -H "Authorization: OAuth $STATUS_PAGE_TOKEN" \
  -d '{
    "incident": {
      "name": "Service degradation",
      "status": "investigating",
      "impact": "minor",
      "body": "We are investigating reports of slow response times."
    }
  }'
```

### Internal Communication Channels

- **#omnicare-ops**: General operations
- **#omnicare-alerts**: Automated alerts
- **#incident-response**: Active incidents
- **#omnicare-releases**: Deployment notifications
- **#omnicare-security**: Security matters

## Appendix

### Useful Scripts Location

```
/opt/omnicare/scripts/
├── daily-health-check.sh
├── incident-diagnostics.sh
├── backup-verification.sh
├── performance-report.sh
├── compliance-audit.sh
└── emergency-procedures/
    ├── lockdown.sh
    ├── rollback.sh
    └── data-recovery.sh
```

### Emergency Contact List

- **Incident Commander**: [Name] - [Phone]
- **DevOps Lead**: [Name] - [Phone]
- **Database Admin**: [Name] - [Phone]
- **Security Lead**: [Name] - [Phone]
- **VP Engineering**: [Name] - [Phone]
- **AWS Support**: [Case URL]

### Reference Documentation

- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [HIPAA Compliance Guide](./HIPAA_COMPLIANCE.md)
- [Disaster Recovery Plan](./DISASTER_RECOVERY.md)
- [Security Incident Response](./SECURITY_INCIDENT_RESPONSE.md)