# Clinical Workflow System Deployment Guide

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Requirements](#infrastructure-requirements)
4. [Environment Configuration](#environment-configuration)
5. [Deployment Steps](#deployment-steps)
6. [Security Configuration](#security-configuration)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedures](#rollback-procedures)

## Overview

This guide provides comprehensive instructions for deploying the OmniCare Clinical Workflow System. The system consists of:

- Backend API service (Node.js/Express)
- Frontend application (Next.js)
- PostgreSQL database
- Redis cache (optional but recommended)
- Medplum integration for FHIR data management

## Prerequisites

### Software Requirements

- Node.js 18.x or higher
- npm 9.x or higher
- PostgreSQL 13+ 
- Redis 6+ (optional but recommended)
- Docker and Docker Compose (for containerized deployment)
- Git

### Access Requirements

- Medplum account and API credentials
- SMTP server credentials for email notifications
- SSL certificates for HTTPS
- Domain names for API and frontend

### Hardware Requirements (Minimum)

**Backend Server:**
- 4 CPU cores
- 8GB RAM
- 50GB SSD storage
- 100Mbps network connection

**Database Server:**
- 4 CPU cores
- 16GB RAM
- 100GB SSD storage with ability to expand
- Daily backup capability

**Frontend Hosting:**
- CDN-capable hosting service
- Support for Next.js applications
- SSL certificate support

## Infrastructure Requirements

### Network Architecture

```
                           ┌─────────────────┐
                           │   Load Balancer │
                           │   (HTTPS/443)   │
                           └────────┬────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
            ┌───────▼────────┐           ┌───────▼────────┐
            │  Frontend CDN  │           │   API Gateway  │
            │  (Next.js)     │           │  (Express.js)  │
            └────────────────┘           └───────┬────────┘
                                                 │
                                        ┌────────┴────────┐
                                        │                 │
                                ┌───────▼────────┐ ┌─────▼──────┐
                                │  PostgreSQL    │ │   Redis    │
                                │   Database     │ │   Cache    │
                                └────────────────┘ └────────────┘
```

### Port Configuration

- Frontend: 3000 (development), 80/443 (production)
- Backend API: 8080 (internal), exposed via reverse proxy
- PostgreSQL: 5432 (internal only)
- Redis: 6379 (internal only)

## Environment Configuration

### Backend Environment Variables

Create a `.env.production` file in the backend directory:

```bash
# Application Configuration
NODE_ENV=production
PORT=8080
API_URL=https://api.yourdomain.com

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/omnicare_production
DATABASE_POOL_SIZE=20
DATABASE_SSL=true

# Redis Configuration (optional but recommended)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d
SESSION_SECRET=your-session-secret-min-32-chars

# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key
ENCRYPTION_ALGORITHM=aes-256-gcm

# Medplum Configuration
MEDPLUM_SERVER_URL=https://api.medplum.com
MEDPLUM_CLIENT_ID=your_medplum_client_id
MEDPLUM_CLIENT_SECRET=your_medplum_client_secret
MEDPLUM_PROJECT_ID=your_medplum_project_id

# Email Configuration
SMTP_HOST=smtp.your-email-provider.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@yourdomain.com

# Security Headers
CORS_ORIGIN=https://app.yourdomain.com
ALLOWED_HOSTS=app.yourdomain.com,api.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE_PATH=/var/log/omnicare/app.log

# Monitoring
SENTRY_DSN=your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-new-relic-key
```

### Frontend Environment Variables

Create a `.env.production` file in the frontend directory:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_API_VERSION=v1

# Application Settings
NEXT_PUBLIC_APP_NAME=OmniCare Clinical Workflow
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com

# Feature Flags
NEXT_PUBLIC_ENABLE_OFFLINE_MODE=true
NEXT_PUBLIC_ENABLE_PWA=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true

# Third-party Services
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=GA-XXXXXXXXX
NEXT_PUBLIC_SENTRY_DSN=your-frontend-sentry-dsn

# Security
NEXT_PUBLIC_CSP_REPORT_URI=https://api.yourdomain.com/api/csp-report
```

## Deployment Steps

### 1. Database Setup

```bash
# Create production database
sudo -u postgres psql
CREATE DATABASE omnicare_production;
CREATE USER omnicare_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE omnicare_production TO omnicare_user;
\q

# Run migrations
cd backend
NODE_ENV=production npm run db:migrate

# Seed initial data (if needed)
NODE_ENV=production npm run db:seed
```

### 2. Backend Deployment

#### Option A: Traditional Deployment

```bash
# Clone repository
git clone https://github.com/your-org/omnicare.git
cd omnicare/backend

# Install dependencies
npm ci --production

# Build application
npm run build

# Create systemd service file
sudo nano /etc/systemd/system/omnicare-backend.service
```

Add the following content:

```ini
[Unit]
Description=OmniCare Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=omnicare
WorkingDirectory=/var/www/omnicare/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/omnicare

[Install]
WantedBy=multi-user.target
```

Start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable omnicare-backend
sudo systemctl start omnicare-backend
sudo systemctl status omnicare-backend
```

#### Option B: Docker Deployment

Create a `Dockerfile` in the backend directory:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Install production dependencies only
RUN npm ci --production

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 8080

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

Build and run:

```bash
# Build Docker image
docker build -t omnicare-backend:latest .

# Run container
docker run -d \
  --name omnicare-backend \
  --env-file .env.production \
  -p 8080:8080 \
  --restart unless-stopped \
  omnicare-backend:latest
```

### 3. Frontend Deployment

#### Option A: Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
cd frontend
vercel --prod
```

#### Option B: Self-hosted Deployment

```bash
cd frontend

# Install dependencies
npm ci

# Build application
npm run build

# Create PM2 ecosystem file
nano ecosystem.config.js
```

Add the following:

```javascript
module.exports = {
  apps: [{
    name: 'omnicare-frontend',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '1G'
  }]
};
```

Start with PM2:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4. Nginx Configuration

Create Nginx configuration for reverse proxy:

```nginx
# API server configuration
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# Frontend server configuration
server {
    listen 443 ssl http2;
    server_name app.yourdomain.com;

    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.yourdomain.com app.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 5. SSL Certificate Setup

Using Let's Encrypt:

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d api.yourdomain.com -d app.yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## Security Configuration

### 1. Firewall Rules

```bash
# Allow SSH (if needed)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow backend port (only from localhost)
sudo ufw allow from 127.0.0.1 to any port 8080

# Enable firewall
sudo ufw enable
```

### 2. Database Security

```sql
-- Restrict database access
ALTER USER omnicare_user CONNECTION LIMIT 100;

-- Create read-only user for reporting
CREATE USER omnicare_readonly WITH ENCRYPTED PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE omnicare_production TO omnicare_readonly;
GRANT USAGE ON SCHEMA public TO omnicare_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO omnicare_readonly;
```

### 3. API Security Headers

Ensure these headers are set in your Express application:

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.medplum.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## Monitoring and Maintenance

### 1. Health Checks

Set up monitoring for the following endpoints:

```bash
# Backend health check
curl https://api.yourdomain.com/api/health

# Detailed health check (requires authentication)
curl -H "Authorization: Bearer $TOKEN" https://api.yourdomain.com/api/health/detailed
```

### 2. Log Management

Configure centralized logging:

```bash
# Install log rotation
sudo apt-get install logrotate

# Create logrotate configuration
sudo nano /etc/logrotate.d/omnicare
```

Add:

```
/var/log/omnicare/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 omnicare omnicare
    sharedscripts
    postrotate
        systemctl reload omnicare-backend
    endscript
}
```

### 3. Backup Strategy

Create automated backup script:

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/var/backups/omnicare"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="omnicare_production"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U omnicare_user -d $DB_NAME | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

# Upload to S3 (optional)
# aws s3 cp "$BACKUP_DIR/db_backup_$DATE.sql.gz" s3://your-backup-bucket/
```

Add to crontab:

```bash
# Run backup daily at 2 AM
0 2 * * * /home/omnicare/backup.sh
```

### 4. Performance Monitoring

Configure application monitoring:

```javascript
// New Relic example
if (process.env.NEW_RELIC_LICENSE_KEY) {
  require('newrelic');
}

// Custom metrics
const prometheus = require('prom-client');
const register = new prometheus.Registry();

// Request duration histogram
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

register.registerMetric(httpRequestDuration);
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Database Connection Errors

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -h localhost -U omnicare_user -d omnicare_production

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### 2. Memory Issues

```bash
# Check memory usage
free -h

# Check Node.js memory
ps aux | grep node

# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

#### 3. Permission Issues

```bash
# Fix file permissions
sudo chown -R omnicare:omnicare /var/www/omnicare
sudo chmod -R 755 /var/www/omnicare

# Fix log directory permissions
sudo chown -R omnicare:omnicare /var/log/omnicare
sudo chmod -R 640 /var/log/omnicare
```

#### 4. SSL Certificate Issues

```bash
# Test SSL configuration
openssl s_client -connect api.yourdomain.com:443

# Renew certificates manually
sudo certbot renew --dry-run
sudo certbot renew
```

## Rollback Procedures

### 1. Application Rollback

```bash
# Stop current version
sudo systemctl stop omnicare-backend

# Restore previous version
cd /var/www/omnicare/backend
git checkout previous-version-tag

# Rebuild and restart
npm ci --production
npm run build
sudo systemctl start omnicare-backend
```

### 2. Database Rollback

```bash
# Stop application
sudo systemctl stop omnicare-backend

# Restore from backup
gunzip < /var/backups/omnicare/db_backup_20240110_020000.sql.gz | \
  psql -U omnicare_user -d omnicare_production

# Restart application
sudo systemctl start omnicare-backend
```

### 3. Emergency Maintenance Mode

Create a maintenance page:

```html
<!-- /var/www/maintenance/index.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Maintenance - OmniCare</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            border-radius: 10px;
            padding: 40px;
            max-width: 600px;
            margin: 0 auto;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #333; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>System Maintenance</h1>
        <p>We're currently performing scheduled maintenance.</p>
        <p>The system will be back online shortly.</p>
        <p>Thank you for your patience.</p>
    </div>
</body>
</html>
```

Enable maintenance mode in Nginx:

```nginx
# Add to server block
location / {
    if (-f /var/www/maintenance/maintenance.flag) {
        return 503;
    }
    # ... rest of configuration
}

error_page 503 @maintenance;
location @maintenance {
    root /var/www/maintenance;
    rewrite ^(.*)$ /index.html break;
}
```

Toggle maintenance mode:

```bash
# Enable maintenance
touch /var/www/maintenance/maintenance.flag

# Disable maintenance
rm /var/www/maintenance/maintenance.flag
```

## Post-Deployment Checklist

- [ ] Verify all environment variables are set correctly
- [ ] Test all API endpoints are accessible
- [ ] Verify database connectivity
- [ ] Check SSL certificates are valid
- [ ] Test authentication flow
- [ ] Verify clinical workflow creation and updates
- [ ] Check error logging is working
- [ ] Verify backup scripts are running
- [ ] Test monitoring alerts
- [ ] Load test the application
- [ ] Update DNS records if needed
- [ ] Document any custom configurations
- [ ] Share deployment details with team

## Support and Resources

- Technical Documentation: [Internal Wiki]
- Monitoring Dashboard: https://monitoring.yourdomain.com
- Log Aggregation: https://logs.yourdomain.com
- Issue Tracking: https://jira.yourdomain.com
- On-call Schedule: [PagerDuty]

For urgent issues, contact the DevOps team at: devops@yourdomain.com