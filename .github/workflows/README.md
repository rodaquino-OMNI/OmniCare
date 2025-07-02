# OmniCare EMR - GitHub Actions Workflows

This directory contains all GitHub Actions workflows for the OmniCare EMR project, implementing Phase 0 CI/CD pipeline requirements.

## Workflows Overview

### 1. CI Workflow (`ci.yml`)
- **Trigger**: Push to main/develop, Pull requests
- **Purpose**: Run comprehensive tests for both frontend and backend
- **Features**:
  - Backend tests with PostgreSQL service
  - Frontend tests with coverage
  - Build verification
  - Artifact uploads

### 2. PR Verification (`pr-verification.yml`)
- **Trigger**: Pull request events
- **Purpose**: Quick checks before full CI runs
- **Features**:
  - Merge conflict detection
  - Console.log statement detection
  - Parallel linting
  - Type checking
  - PR size warnings
  - Build verification

### 3. Security Scanning (`security.yml`)
- **Trigger**: Push, PR, Daily schedule
- **Purpose**: Comprehensive security analysis
- **Features**:
  - Dependency vulnerability scanning (npm audit)
  - CodeQL analysis for JavaScript/TypeScript
  - Secret scanning with Gitleaks
  - SAST with Semgrep
  - License compliance checking
  - Security summary report

### 4. HIPAA Compliance (`hipaa-compliance.yml`)
- **Trigger**: Push, PR, Weekly schedule
- **Purpose**: Ensure HIPAA compliance
- **Features**:
  - PHI exposure detection
  - Encryption verification
  - Access control checks
  - Audit logging verification
  - Data retention policy checks
  - Compliance report generation

### 5. Performance Testing (`performance.yml`)
- **Trigger**: Push to main, PR, Nightly schedule
- **Purpose**: Performance benchmarking
- **Features**:
  - Backend performance tests
  - Frontend Lighthouse CI
  - Load testing with k6
  - Performance metrics collection
  - Test result artifacts

### 6. Deploy Workflow (`deploy.yml`)
- **Trigger**: Push to main, Manual dispatch
- **Purpose**: Build and push Docker images
- **Features**:
  - Pre-deployment checks
  - Docker image building
  - Container registry push
  - Deployment notifications
  - Environment selection (staging/production)

### 7. Release Workflow (`release.yml`)
- **Trigger**: Version tags, Manual dispatch
- **Purpose**: Create releases and artifacts
- **Features**:
  - Automated changelog generation
  - Build artifacts creation
  - Docker image tagging
  - Deployment package generation
  - Multi-platform Docker builds

## Setup Requirements

To use these workflows, you need to configure the following GitHub secrets:

### Required Secrets
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `MEDPLUM_CLIENT_ID`: Medplum OAuth client ID
- `MEDPLUM_CLIENT_SECRET`: Medplum OAuth client secret

### Optional Secrets
- `DOCKER_USERNAME`: Docker Hub username (for releases)
- `DOCKER_PASSWORD`: Docker Hub password (for releases)
- `KUBE_CONFIG`: Kubernetes config (for deployments)

## Workflow Status Badges

Add these badges to your README.md:

```markdown
![CI](https://github.com/[owner]/[repo]/workflows/CI/badge.svg)
![Security](https://github.com/[owner]/[repo]/workflows/Security%20Scanning/badge.svg)
![HIPAA Compliance](https://github.com/[owner]/[repo]/workflows/HIPAA%20Compliance%20Check/badge.svg)
```

## Local Testing

To test workflows locally, you can use [act](https://github.com/nektos/act):

```bash
# Test CI workflow
act -j backend-test

# Test with specific event
act pull_request -j quick-checks
```

## Maintenance

- Review security scan results weekly
- Update dependencies monthly
- Monitor performance metrics for regressions
- Ensure HIPAA compliance checks pass before releases