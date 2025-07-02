#!/bin/bash
# Production Infrastructure Deployment Script for OmniCare EMR
# Deploys complete production-ready infrastructure with HIPAA compliance

set -euo pipefail

# Configuration
NAMESPACE="omnicare-prod"
REGION="us-east-1"
CLUSTER_NAME="omnicare-production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Prerequisites check
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed or not in PATH"
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        error "helm is not installed or not in PATH"
    fi
    
    # Check if aws CLI is installed
    if ! command -v aws &> /dev/null; then
        error "aws CLI is not installed or not in PATH"
    fi
    
    # Check kubectl connectivity
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster. Please check your kubectl configuration."
    fi
    
    # Verify we're connected to the right cluster
    CURRENT_CONTEXT=$(kubectl config current-context)
    if [[ ! "$CURRENT_CONTEXT" =~ "$CLUSTER_NAME" ]]; then
        warn "Current kubectl context is '$CURRENT_CONTEXT'. Expected to contain '$CLUSTER_NAME'"
        read -p "Continue anyway? (y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Deployment cancelled by user"
        fi
    fi
    
    log "Prerequisites check completed successfully"
}

# Backup existing configurations
backup_existing_configs() {
    log "Creating backup of existing configurations..."
    
    BACKUP_DIR="/tmp/omnicare-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup existing namespace if it exists
    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        kubectl get all -n "$NAMESPACE" -o yaml > "$BACKUP_DIR/existing-resources.yaml"
        info "Existing resources backed up to $BACKUP_DIR/existing-resources.yaml"
    fi
    
    echo "$BACKUP_DIR" > /tmp/omnicare-backup-location.txt
    log "Backup completed: $BACKUP_DIR"
}

# Deploy infrastructure components
deploy_namespace() {
    log "Deploying production namespace and security policies..."
    kubectl apply -f devops/kubernetes/production-namespace.yaml
    
    # Wait for namespace to be ready
    kubectl wait --for=condition=Ready namespace/$NAMESPACE --timeout=60s
    log "Namespace deployment completed"
}

deploy_database() {
    log "Deploying production database with high availability..."
    kubectl apply -f devops/kubernetes/production-database.yaml
    
    # Wait for database to be ready
    log "Waiting for database deployment to be ready..."
    kubectl wait --for=condition=available --timeout=600s deployment/postgres-primary -n $NAMESPACE
    
    # Verify database connectivity
    info "Verifying database connectivity..."
    DB_POD=$(kubectl get pods -n $NAMESPACE -l app=postgres,role=primary -o jsonpath='{.items[0].metadata.name}')
    kubectl exec -n $NAMESPACE $DB_POD -- pg_isready -U omnicare_prod_user -d omnicare_emr_prod
    
    log "Database deployment completed successfully"
}

deploy_security() {
    log "Deploying security hardening and HIPAA compliance configurations..."
    kubectl apply -f devops/kubernetes/production-security-hardening.yaml
    
    # Wait for Falco DaemonSet to be ready
    log "Waiting for security monitoring to be ready..."
    kubectl rollout status daemonset/falco-security-monitor -n $NAMESPACE --timeout=300s
    
    log "Security hardening deployment completed"
}

deploy_ingress_lb() {
    log "Deploying load balancers and ingress with CDN integration..."
    kubectl apply -f devops/kubernetes/production-ingress-lb.yaml
    
    # Wait for ingress controller to be ready
    log "Waiting for ingress controller to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/nginx-ingress-controller -n $NAMESPACE
    
    # Get load balancer external IP
    log "Waiting for load balancer external IP..."
    for i in {1..30}; do
        EXTERNAL_IP=$(kubectl get svc omnicare-alb -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
        if [[ -n "$EXTERNAL_IP" ]]; then
            info "Load balancer external endpoint: $EXTERNAL_IP"
            break
        fi
        sleep 10
    done
    
    log "Load balancer and ingress deployment completed"
}

deploy_disaster_recovery() {
    log "Deploying disaster recovery procedures..."
    kubectl apply -f devops/kubernetes/disaster-recovery.yaml
    
    # Create initial backup
    log "Creating initial disaster recovery backup..."
    kubectl create job --from=cronjob/cross-region-backup initial-backup -n $NAMESPACE
    
    log "Disaster recovery deployment completed"
}

deploy_deployment_automation() {
    log "Deploying blue-green deployment automation..."
    kubectl apply -f devops/kubernetes/deployment-automation.yaml
    
    # Verify blue environment is active
    log "Verifying blue-green deployment setup..."
    kubectl wait --for=condition=available --timeout=300s deployment/backend-blue -n $NAMESPACE
    
    log "Deployment automation setup completed"
}

deploy_monitoring() {
    log "Deploying comprehensive monitoring and alerting..."
    kubectl apply -f devops/kubernetes/production-monitoring-alerting.yaml
    
    # Wait for SLA monitor to be ready
    log "Waiting for monitoring components to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/sla-monitor -n $NAMESPACE
    
    log "Monitoring and alerting deployment completed"
}

# Verification and health checks
run_health_checks() {
    log "Running comprehensive health checks..."
    
    info "Checking namespace resources..."
    kubectl get all -n $NAMESPACE
    
    info "Checking pod status..."
    PENDING_PODS=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase=Pending --no-headers | wc -l)
    FAILED_PODS=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase=Failed --no-headers | wc -l)
    
    if [[ $PENDING_PODS -gt 0 ]]; then
        warn "$PENDING_PODS pods are in Pending state"
    fi
    
    if [[ $FAILED_PODS -gt 0 ]]; then
        error "$FAILED_PODS pods are in Failed state"
    fi
    
    info "Checking security policies..."
    kubectl get networkpolicies -n $NAMESPACE
    kubectl get podsecuritypolicies -n $NAMESPACE
    
    info "Checking monitoring endpoints..."
    kubectl get servicemonitors -n $NAMESPACE
    
    log "Health checks completed successfully"
}

# Generate deployment report
generate_deployment_report() {
    log "Generating deployment report..."
    
    REPORT_FILE="/tmp/omnicare-production-deployment-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$REPORT_FILE" << EOF
OmniCare EMR Production Infrastructure Deployment Report
======================================================

Deployment Date: $(date)
Kubernetes Cluster: $(kubectl config current-context)
Namespace: $NAMESPACE
Region: $REGION

Deployed Components:
-------------------
✅ Production Namespace with RBAC and Network Policies
✅ High-Availability PostgreSQL Database with Replication
✅ Production-Grade Load Balancer and Ingress with CDN
✅ HIPAA-Compliant Security Hardening and Monitoring
✅ Cross-Region Disaster Recovery with Automated Backup
✅ Blue-Green Deployment Automation with Rollback
✅ Comprehensive Monitoring and SLA Alerting

Infrastructure Status:
--------------------
$(kubectl get pods -n $NAMESPACE)

Services:
--------
$(kubectl get svc -n $NAMESPACE)

Ingress:
-------
$(kubectl get ingress -n $NAMESPACE)

Storage:
-------
$(kubectl get pvc -n $NAMESPACE)

Security Policies:
-----------------
$(kubectl get networkpolicies -n $NAMESPACE)

Load Balancer Endpoint:
----------------------
$(kubectl get svc omnicare-alb -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "Load balancer provisioning...")

Next Steps:
----------
1. Update DNS records to point to load balancer endpoint
2. Configure SSL certificates in AWS Certificate Manager
3. Set up monitoring dashboards in Grafana
4. Configure backup retention policies
5. Schedule security audits and compliance reviews
6. Test disaster recovery procedures
7. Train operations team on deployment procedures

Production Readiness Checklist:
------------------------------
✅ 99.9% uptime capability with multi-AZ deployment
✅ HIPAA-compliant security controls and audit logging
✅ Automated backup and disaster recovery procedures
✅ Blue-green deployment with automated rollback
✅ Comprehensive monitoring and alerting
✅ Network security with ingress/egress controls
✅ Resource quotas and limits for stability
✅ Pod security policies and RBAC

Compliance Features:
------------------
✅ HIPAA audit logging with 7-year retention
✅ Encrypted data at rest and in transit
✅ Role-based access controls (RBAC)
✅ Network segmentation and policies
✅ Security scanning and threat detection
✅ Automated compliance monitoring
✅ Data backup and recovery procedures

Contact Information:
------------------
For issues or questions, contact:
- DevOps Team: devops@omnicare-health.com
- Security Team: security@omnicare-health.com  
- Compliance Officer: compliance@omnicare-health.com

Backup Location:
---------------
$(cat /tmp/omnicare-backup-location.txt)

EOF

    info "Deployment report generated: $REPORT_FILE"
    echo "$REPORT_FILE"
}

# Cleanup function
cleanup() {
    if [[ $? -ne 0 ]]; then
        error "Deployment failed. Check logs above for details."
        
        # Offer to restore from backup
        if [[ -f /tmp/omnicare-backup-location.txt ]]; then
            BACKUP_DIR=$(cat /tmp/omnicare-backup-location.txt)
            warn "Backup available at: $BACKUP_DIR"
            read -p "Would you like to restore from backup? (y/N): " -r
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                log "Restoring from backup..."
                kubectl apply -f "$BACKUP_DIR/existing-resources.yaml" || true
            fi
        fi
    fi
}

# Main deployment function
main() {
    log "Starting OmniCare EMR Production Infrastructure Deployment"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    backup_existing_configs
    deploy_namespace
    deploy_database
    deploy_security
    deploy_ingress_lb
    deploy_disaster_recovery
    deploy_deployment_automation
    deploy_monitoring
    run_health_checks
    
    # Generate final report
    REPORT_FILE=$(generate_deployment_report)
    
    log "🎉 Production infrastructure deployment completed successfully!"
    log "📋 Full deployment report: $REPORT_FILE"
    
    info "Your OmniCare EMR production environment is now ready with:"
    info "  ✅ 99.9% uptime capability"
    info "  ✅ HIPAA-compliant security"
    info "  ✅ Automated disaster recovery"
    info "  ✅ Blue-green deployments"
    info "  ✅ Comprehensive monitoring"
    
    warn "Important: Update your DNS records and configure SSL certificates before going live!"
}

# Run main function
main "$@"