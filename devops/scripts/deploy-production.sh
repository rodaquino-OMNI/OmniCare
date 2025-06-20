#!/bin/bash

# OmniCare EMR Production Deployment Script
# HIPAA-compliant production deployment with security checks

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
NAMESPACE="omnicare"
ENVIRONMENT="${ENVIRONMENT:-production}"
CLUSTER_NAME="${CLUSTER_NAME:-omnicare-production}"
REGION="${REGION:-us-east-1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "helm" "docker" "aws" "jq" "curl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' is not installed"
            exit 1
        fi
    done
    
    # Check environment variables
    local required_vars=("AWS_ACCESS_KEY_ID" "AWS_SECRET_ACCESS_KEY" "KUBE_CONFIG_PATH")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable '$var' is not set"
            exit 1
        fi
    done
    
    log_success "Prerequisites check passed"
}

# Setup Kubernetes context
setup_k8s_context() {
    log_info "Setting up Kubernetes context..."
    
    if [[ -f "$KUBE_CONFIG_PATH" ]]; then
        export KUBECONFIG="$KUBE_CONFIG_PATH"
        log_success "Kubernetes config loaded from $KUBE_CONFIG_PATH"
    else
        log_error "Kubernetes config file not found at $KUBE_CONFIG_PATH"
        exit 1
    fi
    
    # Test connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Kubernetes context configured for cluster: $(kubectl config current-context)"
}

# Pre-deployment security checks
pre_deployment_security_check() {
    log_info "Running pre-deployment security checks..."
    
    # Check cluster security policies
    log_info "Checking cluster security policies..."
    kubectl get networkpolicies -n "$NAMESPACE" || log_warning "No network policies found"
    kubectl get podsecuritypolicies || log_warning "No pod security policies found"
    
    # Verify RBAC
    log_info "Verifying RBAC permissions..."
    kubectl auth can-i create deployments --namespace="$NAMESPACE"
    kubectl auth can-i create services --namespace="$NAMESPACE"
    kubectl auth can-i create ingresses --namespace="$NAMESPACE"
    
    # Check for existing resources
    log_info "Checking existing resources..."
    kubectl get all -n "$NAMESPACE" || log_info "Namespace does not exist yet"
    
    log_success "Pre-deployment security checks completed"
}

# Backup existing deployment
backup_deployment() {
    log_info "Creating backup of existing deployment..."
    
    local backup_dir="${PROJECT_ROOT}/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup Kubernetes resources
    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        kubectl get all -n "$NAMESPACE" -o yaml > "$backup_dir/k8s-resources.yaml"
        kubectl get configmaps -n "$NAMESPACE" -o yaml > "$backup_dir/configmaps.yaml"
        kubectl get secrets -n "$NAMESPACE" -o yaml > "$backup_dir/secrets.yaml"
        
        log_success "Kubernetes resources backed up to $backup_dir"
    else
        log_info "No existing deployment to backup"
    fi
    
    # Backup database
    if kubectl get deployment postgres -n "$NAMESPACE" &> /dev/null; then
        log_info "Creating database backup..."
        kubectl exec -n "$NAMESPACE" deployment/postgres -- pg_dump -U omnicare_user omnicare_emr > "$backup_dir/database_backup.sql"
        log_success "Database backed up to $backup_dir/database_backup.sql"
    fi
}

# Deploy secrets
deploy_secrets() {
    log_info "Deploying secrets..."
    
    # Check if secrets exist
    local secrets_file="${PROJECT_ROOT}/devops/secrets/production-secrets.yaml"
    if [[ ! -f "$secrets_file" ]]; then
        log_error "Production secrets file not found at $secrets_file"
        log_error "Please create the secrets file with encrypted values"
        exit 1
    fi
    
    # Apply secrets
    kubectl apply -f "$secrets_file" -n "$NAMESPACE"
    
    log_success "Secrets deployed successfully"
}

# Deploy application
deploy_application() {
    log_info "Deploying OmniCare EMR application..."
    
    local k8s_dir="${PROJECT_ROOT}/devops/kubernetes"
    
    # Create namespace
    log_info "Creating namespace..."
    kubectl apply -f "$k8s_dir/namespace.yaml"
    
    # Deploy in order: database, cache, backend, frontend, ingress
    local components=("database" "redis" "backend" "frontend" "ingress")
    
    for component in "${components[@]}"; do
        log_info "Deploying $component..."
        
        # Substitute environment variables if needed
        if [[ -f "$k8s_dir/$component.yaml" ]]; then
            envsubst < "$k8s_dir/$component.yaml" | kubectl apply -f - -n "$NAMESPACE"
            log_success "$component deployed"
        else
            log_warning "$component.yaml not found, skipping"
        fi
    done
    
    log_success "Application deployment completed"
}

# Wait for deployment to be ready
wait_for_deployment() {
    log_info "Waiting for deployment to be ready..."
    
    local deployments=("postgres" "redis" "backend" "frontend")
    
    for deployment in "${deployments[@]}"; do
        log_info "Waiting for $deployment to be ready..."
        if kubectl get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
            kubectl wait --for=condition=available --timeout=600s deployment/"$deployment" -n "$NAMESPACE"
            log_success "$deployment is ready"
        else
            log_warning "$deployment not found, skipping wait"
        fi
    done
    
    log_success "All deployments are ready"
}

# Health checks
perform_health_checks() {
    log_info "Performing health checks..."
    
    # Get ingress URL
    local ingress_ip
    ingress_ip=$(kubectl get ingress omnicare-ingress -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    
    if [[ -z "$ingress_ip" ]]; then
        log_warning "Ingress IP not found, using port-forward for health checks"
        kubectl port-forward -n "$NAMESPACE" service/backend 8080:3001 &
        local port_forward_pid=$!
        sleep 5
        local health_url="http://localhost:8080/health"
    else
        local health_url="https://$ingress_ip/api/health"
    fi
    
    # Backend health check
    log_info "Checking backend health..."
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "$health_url" > /dev/null; then
            log_success "Backend health check passed"
            break
        else
            log_info "Attempt $attempt/$max_attempts: Backend not ready, waiting..."
            sleep 10
            ((attempt++))
        fi
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        log_error "Backend health check failed after $max_attempts attempts"
        # Kill port-forward if it was started
        [[ -n "${port_forward_pid:-}" ]] && kill "$port_forward_pid" 2>/dev/null || true
        exit 1
    fi
    
    # Kill port-forward if it was started
    [[ -n "${port_forward_pid:-}" ]] && kill "$port_forward_pid" 2>/dev/null || true
    
    # Database connectivity check
    log_info "Checking database connectivity..."
    kubectl exec -n "$NAMESPACE" deployment/backend -- node -e "
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        pool.query('SELECT 1').then(() => {
            console.log('Database connection successful');
            process.exit(0);
        }).catch(err => {
            console.error('Database connection failed:', err);
            process.exit(1);
        });
    "
    
    log_success "All health checks passed"
}

# Post-deployment security verification
post_deployment_security_check() {
    log_info "Running post-deployment security verification..."
    
    # Check network policies
    log_info "Verifying network policies are applied..."
    kubectl get networkpolicies -n "$NAMESPACE"
    
    # Check pod security context
    log_info "Verifying pod security contexts..."
    kubectl get pods -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.securityContext}{"\n"}{end}'
    
    # Check TLS certificates
    log_info "Verifying TLS certificates..."
    kubectl get certificates -n "$NAMESPACE"
    
    # Verify HIPAA compliance requirements
    log_info "Verifying HIPAA compliance..."
    
    # Check encryption in transit
    local ingress_tls
    ingress_tls=$(kubectl get ingress omnicare-ingress -n "$NAMESPACE" -o jsonpath='{.spec.tls}' 2>/dev/null || echo "")
    if [[ -n "$ingress_tls" && "$ingress_tls" != "null" ]]; then
        log_success "TLS encryption configured"
    else
        log_error "TLS encryption not configured - HIPAA violation"
        exit 1
    fi
    
    # Check audit logging
    log_info "Verifying audit logging..."
    kubectl logs -n "$NAMESPACE" deployment/backend --tail=10 | grep -q "audit" && log_success "Audit logging active" || log_warning "Audit logging not detected"
    
    log_success "Post-deployment security verification completed"
}

# Setup monitoring and alerting
setup_monitoring() {
    log_info "Setting up monitoring and alerting..."
    
    local monitoring_dir="${PROJECT_ROOT}/devops/kubernetes/monitoring"
    
    if [[ -d "$monitoring_dir" ]]; then
        log_info "Deploying monitoring stack..."
        kubectl apply -f "$monitoring_dir/" -n "$NAMESPACE"
        
        # Wait for monitoring components
        local monitoring_components=("prometheus" "grafana")
        for component in "${monitoring_components[@]}"; do
            if kubectl get deployment "$component" -n "$NAMESPACE" &> /dev/null; then
                kubectl wait --for=condition=available --timeout=300s deployment/"$component" -n "$NAMESPACE"
                log_success "$component monitoring deployed"
            fi
        done
    else
        log_warning "Monitoring configuration not found at $monitoring_dir"
    fi
    
    log_success "Monitoring setup completed"
}

# Cleanup function
cleanup() {
    log_info "Performing cleanup..."
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
}

# Main deployment function
main() {
    log_info "Starting OmniCare EMR production deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Namespace: $NAMESPACE"
    log_info "Cluster: $CLUSTER_NAME"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Execute deployment steps
    check_prerequisites
    setup_k8s_context
    pre_deployment_security_check
    backup_deployment
    deploy_secrets
    deploy_application
    wait_for_deployment
    perform_health_checks
    post_deployment_security_check
    setup_monitoring
    
    log_success "🎉 OmniCare EMR production deployment completed successfully!"
    log_info "Access the application at: https://omnicare.example.com"
    log_info "Monitor the deployment at: https://monitoring.omnicare.example.com"
    
    # Display deployment summary
    echo
    log_info "Deployment Summary:"
    kubectl get all -n "$NAMESPACE"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi