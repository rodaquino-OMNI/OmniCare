# OmniCare EMR Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the OmniCare EMR platform to production using Kubernetes, Terraform, and AWS infrastructure. The deployment is fully HIPAA-compliant with high availability, automated monitoring, and disaster recovery capabilities.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials
3. **kubectl** (v1.28+)
4. **Helm** (v3.12+)
5. **Terraform** (v1.5+)
6. **Docker** for building images
7. **GitHub repository** with secrets configured

## Infrastructure Components

### AWS Resources (Terraform)
- **VPC** with 3 availability zones
- **EKS Cluster** (v1.28) with autoscaling node groups
- **RDS PostgreSQL** (v15.4) with Multi-AZ deployment
- **ElastiCache Redis** cluster
- **S3 Buckets** for application storage and backups
- **KMS Keys** for encryption at rest
- **CloudWatch** for logging and monitoring
- **IAM Roles** with IRSA for pod-level permissions

### Kubernetes Resources
- **Namespaces**: `omnicare` (app), `monitoring` (observability stack)
- **Deployments**: Backend API, Frontend, PostgreSQL, Redis
- **Services**: ClusterIP for internal, LoadBalancer for external
- **Ingress**: NGINX with automatic SSL via cert-manager
- **ConfigMaps & Secrets**: Application configuration
- **HPA**: Horizontal Pod Autoscalers for dynamic scaling
- **PDB**: Pod Disruption Budgets for high availability
- **NetworkPolicies**: Secure pod-to-pod communication

## Deployment Steps

### 1. Infrastructure Provisioning

```bash
# Clone the repository
git clone https://github.com/omnicare/omnicare-emr.git
cd omnicare-emr

# Initialize Terraform
cd devops/terraform/aws
terraform init

# Create workspace for production
terraform workspace new production

# Review the plan
terraform plan -var="environment=production" -var="aws_region=us-east-1"

# Apply infrastructure
terraform apply -var="environment=production" -var="aws_region=us-east-1" -auto-approve

# Save outputs
terraform output -json > terraform-outputs.json
```

### 2. Configure kubectl

```bash
# Update kubeconfig
aws eks update-kubeconfig --name omnicare-production --region us-east-1

# Verify connection
kubectl get nodes
```

### 3. Install Prerequisites

```bash
# Install NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# Install cert-manager for SSL
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: devops@omnicare.example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### 4. Deploy Application with Helm

```bash
# Create namespace
kubectl create namespace omnicare

# Add Helm repository dependencies
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add elastic https://helm.elastic.co
helm repo update

# Deploy OmniCare application
helm upgrade --install omnicare ./devops/helm/omnicare \
  --namespace omnicare \
  --values ./devops/helm/omnicare/values.yaml \
  --values ./devops/helm/omnicare/values.production.yaml \
  --set backend.secrets.JWT_SECRET=$(openssl rand -base64 32) \
  --set postgresql.auth.postgresPassword=$(openssl rand -base64 24) \
  --set redis.auth.password=$(openssl rand -base64 24) \
  --wait --timeout 15m
```

### 5. Deploy Monitoring Stack

```bash
# Create monitoring namespace
kubectl create namespace monitoring

# Deploy Prometheus Stack
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values ./devops/monitoring/prometheus-values.yaml \
  --wait

# Deploy Grafana
helm upgrade --install grafana grafana/grafana \
  --namespace monitoring \
  --values ./devops/monitoring/grafana-values.yaml \
  --set adminPassword=$(openssl rand -base64 24) \
  --wait

# Deploy Elasticsearch and Kibana
helm upgrade --install elasticsearch elastic/elasticsearch \
  --namespace monitoring \
  --set replicas=3 \
  --set minimumMasterNodes=2 \
  --wait

helm upgrade --install kibana elastic/kibana \
  --namespace monitoring \
  --set elasticsearchHosts="http://elasticsearch-master:9200" \
  --wait

# Apply HIPAA compliance rules
kubectl apply -f ./devops/monitoring/hipaa-compliance-rules.yaml -n monitoring
```

### 6. Configure CI/CD

The GitHub Actions workflows are pre-configured in `.github/workflows/`:

1. **ci-cd.yml**: Main CI/CD pipeline for code deployment
2. **infrastructure.yml**: Infrastructure provisioning with Terraform
3. **monitoring.yml**: Monitoring stack deployment

Required GitHub Secrets:
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
SNYK_TOKEN
CODECOV_TOKEN
SONAR_TOKEN
SLACK_WEBHOOK
GRAFANA_ADMIN_PASSWORD
PAGERDUTY_SERVICE_KEY
```

### 7. Post-Deployment Verification

```bash
# Check pod status
kubectl get pods -n omnicare
kubectl get pods -n monitoring

# Verify services
kubectl get svc -n omnicare
kubectl get ingress -n omnicare

# Test endpoints
curl -f https://omnicare.example.com/api/health
curl -f https://api.omnicare.example.com/health

# Check logs
kubectl logs -n omnicare -l app=backend --tail=100
kubectl logs -n omnicare -l app=frontend --tail=100

# Access Grafana locally
kubectl port-forward -n monitoring svc/grafana 3000:80
# Open http://localhost:3000 (admin/[password])
```

## Security Considerations

### HIPAA Compliance
- **Encryption**: All data encrypted at rest (KMS) and in transit (TLS 1.2+)
- **Audit Logging**: 7-year retention for audit logs
- **Access Control**: RBAC, Network Policies, IAM roles
- **Backup**: Automated daily backups with 90-day retention
- **Monitoring**: Real-time alerts for security events

### Best Practices
1. Rotate secrets regularly using AWS Secrets Manager
2. Enable MFA for AWS console access
3. Use separate AWS accounts for prod/staging
4. Implement least-privilege IAM policies
5. Regular security scanning with Trivy/Snyk
6. Enable AWS GuardDuty and Security Hub

## Maintenance

### Scaling
```bash
# Manual scaling
kubectl scale deployment backend --replicas=5 -n omnicare

# Update HPA limits
kubectl edit hpa backend-hpa -n omnicare
```

### Updates
```bash
# Update application
helm upgrade omnicare ./devops/helm/omnicare \
  --namespace omnicare \
  --values ./devops/helm/omnicare/values.production.yaml \
  --set backend.image.tag=v1.0.1 \
  --set frontend.image.tag=v1.0.1

# Update Kubernetes
# Use eksctl or Terraform to update EKS version
```

### Backup and Restore
```bash
# Manual database backup
kubectl exec -n omnicare deployment/postgres -- \
  pg_dump -U omnicare_user omnicare_emr > backup-$(date +%Y%m%d).sql

# Restore database
kubectl exec -i -n omnicare deployment/postgres -- \
  psql -U omnicare_user omnicare_emr < backup-20240620.sql
```

## Troubleshooting

### Common Issues

1. **Pods not starting**
   ```bash
   kubectl describe pod <pod-name> -n omnicare
   kubectl logs <pod-name> -n omnicare --previous
   ```

2. **Database connection issues**
   ```bash
   kubectl exec -it deployment/postgres -n omnicare -- psql -U omnicare_user
   kubectl get secret postgres-secret -n omnicare -o yaml
   ```

3. **Ingress not working**
   ```bash
   kubectl get ingress -n omnicare -o yaml
   kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
   ```

4. **SSL certificate issues**
   ```bash
   kubectl get certificate -n omnicare
   kubectl describe certificate omnicare-tls -n omnicare
   ```

## Disaster Recovery

### RTO: 30 minutes, RPO: 1 hour

1. **Database Failure**:
   - Automated failover to read replica
   - Point-in-time recovery from snapshots

2. **Region Failure**:
   - Deploy to DR region using Terraform
   - Restore from S3 cross-region replicated backups

3. **Full Recovery Procedure**:
   ```bash
   # Deploy infrastructure in DR region
   terraform workspace new dr
   terraform apply -var="environment=dr" -var="aws_region=us-west-2"
   
   # Restore database from backup
   aws s3 cp s3://omnicare-backups/latest.sql .
   kubectl exec -i deployment/postgres -- psql < latest.sql
   
   # Update DNS to point to DR region
   ```

## Support

- **Documentation**: `/devops/docs/`
- **Monitoring**: https://monitoring.omnicare.example.com
- **Alerts**: Slack #alerts channel, PagerDuty
- **On-call**: DevOps team rotation

For additional support, contact: devops@omnicare.example.com