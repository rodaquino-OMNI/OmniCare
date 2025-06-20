# AWS Secrets Manager for OmniCare EMR
# Secure storage for sensitive configuration

# Application secrets
resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "${local.cluster_name}/app/secrets"
  description = "Application secrets for OmniCare EMR"
  
  kms_key_id = aws_kms_key.secrets.arn
  
  recovery_window_in_days = 7
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  
  secret_string = jsonencode({
    jwt_secret             = random_password.jwt_secret.result
    medplum_client_id      = var.medplum_client_id
    medplum_client_secret  = var.medplum_client_secret
    smtp_password          = var.smtp_password
    grafana_admin_password = random_password.grafana_admin.result
  })
}

# JWT Secret
resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

# Grafana Admin Password
resource "random_password" "grafana_admin" {
  length  = 24
  special = true
}

# Backup encryption key
resource "aws_secretsmanager_secret" "backup_key" {
  name        = "${local.cluster_name}/backup/encryption-key"
  description = "Encryption key for backups"
  
  kms_key_id = aws_kms_key.secrets.arn
  
  recovery_window_in_days = 7
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "backup_key" {
  secret_id = aws_secretsmanager_secret.backup_key.id
  
  secret_string = jsonencode({
    encryption_key = random_password.backup_encryption.result
  })
}

resource "random_password" "backup_encryption" {
  length  = 32
  special = false  # Some backup tools don't handle special characters well
}

# Docker Registry Credentials (for ECR)
resource "aws_secretsmanager_secret" "docker_registry" {
  name        = "${local.cluster_name}/docker/registry"
  description = "Docker registry credentials for ECR"
  
  kms_key_id = aws_kms_key.secrets.arn
  
  recovery_window_in_days = 7
  
  tags = local.common_tags
}

# This will be populated by the CI/CD pipeline
resource "aws_secretsmanager_secret_version" "docker_registry" {
  secret_id = aws_secretsmanager_secret.docker_registry.id
  
  secret_string = jsonencode({
    registry = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    username = "AWS"
    password = "ECR_TOKEN_PLACEHOLDER"  # This will be replaced by CI/CD
  })
  
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# SSL Certificate Private Key (if using self-managed certs)
resource "aws_secretsmanager_secret" "ssl_private_key" {
  count = var.certificate_arn == "" ? 1 : 0
  
  name        = "${local.cluster_name}/ssl/private-key"
  description = "SSL certificate private key"
  
  kms_key_id = aws_kms_key.secrets.arn
  
  recovery_window_in_days = 7
  
  tags = local.common_tags
}

# Monitoring credentials
resource "aws_secretsmanager_secret" "monitoring_auth" {
  name        = "${local.cluster_name}/monitoring/auth"
  description = "Authentication for monitoring services"
  
  kms_key_id = aws_kms_key.secrets.arn
  
  recovery_window_in_days = 7
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "monitoring_auth" {
  secret_id = aws_secretsmanager_secret.monitoring_auth.id
  
  secret_string = jsonencode({
    prometheus_basic_auth = base64encode("admin:${random_password.prometheus_auth.result}")
    elasticsearch_password = random_password.elasticsearch_auth.result
    kibana_password = random_password.kibana_auth.result
  })
}

resource "random_password" "prometheus_auth" {
  length  = 24
  special = true
}

resource "random_password" "elasticsearch_auth" {
  length  = 24
  special = true
}

resource "random_password" "kibana_auth" {
  length  = 24
  special = true
}

# OAuth/SAML credentials for SSO (if enabled)
resource "aws_secretsmanager_secret" "sso_credentials" {
  count = var.enable_sso ? 1 : 0
  
  name        = "${local.cluster_name}/auth/sso"
  description = "SSO provider credentials"
  
  kms_key_id = aws_kms_key.secrets.arn
  
  recovery_window_in_days = 7
  
  tags = local.common_tags
}

# API Keys for third-party services
resource "aws_secretsmanager_secret" "api_keys" {
  name        = "${local.cluster_name}/api/keys"
  description = "API keys for third-party integrations"
  
  kms_key_id = aws_kms_key.secrets.arn
  
  recovery_window_in_days = 7
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "api_keys" {
  secret_id = aws_secretsmanager_secret.api_keys.id
  
  secret_string = jsonencode({
    pagerduty_key = var.pagerduty_service_key
    datadog_api_key = var.datadog_api_key
    sentry_dsn = var.sentry_dsn
  })
}