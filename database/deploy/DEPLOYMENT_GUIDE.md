# OmniCare EMR Database Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the OmniCare EMR PostgreSQL database with FHIR schema, optimized indexes, audit trails, and replication/backup strategies.

## Prerequisites

### System Requirements

- **PostgreSQL**: Version 13 or higher
- **Operating System**: Linux (Ubuntu 20.04+ or RHEL 8+) recommended
- **Hardware**:
  - CPU: 8+ cores recommended
  - RAM: 32GB minimum, 64GB recommended
  - Storage: SSD with at least 500GB available
  - Network: Low latency connection for replication

### Required PostgreSQL Extensions

```sql
-- These will be installed automatically
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
```

## Pre-Deployment Checklist

- [ ] PostgreSQL 13+ installed and running
- [ ] Sufficient disk space (500GB+ recommended)
- [ ] Backup storage configured
- [ ] Network access for replication (if applicable)
- [ ] SSL certificates prepared
- [ ] Monitoring infrastructure ready

## Deployment Steps

### 1. Clone Repository and Navigate to Database Directory

```bash
git clone <repository-url>
cd OmniCare/database/deploy
```

### 2. Configure Environment Variables

Create a `.env` file:

```bash
# Database Configuration
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=omnicare_emr
export DB_ADMIN_USER=postgres
export DB_APP_USER=omnicare_app

# Backup Configuration
export BACKUP_PATH=/var/lib/postgresql/backups
export WAL_ARCHIVE_PATH=/var/lib/postgresql/wal_archive

# Replication Configuration (if applicable)
export REPLICA_HOST=replica.omnicare.local
export REPLICA_PORT=5432
```

### 3. Run Deployment Script

```bash
# Make script executable
chmod +x deploy_database.sh

# Run deployment
sudo -u postgres ./deploy_database.sh
```

### 4. Post-Deployment Security Configuration

#### Change Default Passwords

```sql
-- Connect as superuser
psql -U postgres -d omnicare_emr

-- Change application user password
ALTER USER omnicare_app PASSWORD 'SecurePassword123!';
ALTER USER omnicare_readonly PASSWORD 'ReadOnlyPass456!';
ALTER USER omnicare_backup PASSWORD 'BackupPass789!';
ALTER USER omnicare_monitor PASSWORD 'MonitorPass012!';
```

#### Configure pg_hba.conf

Add appropriate authentication rules:

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    omnicare_emr    omnicare_app    10.0.0.0/8             scram-sha-256
host    omnicare_emr    omnicare_readonly 10.0.0.0/8           scram-sha-256
host    replication     replicator      10.0.1.0/24            scram-sha-256
hostssl all             all             0.0.0.0/0              scram-sha-256
```

### 5. SSL Configuration

```bash
# Generate SSL certificates
openssl req -new -x509 -days 365 -nodes -text -out server.crt \
  -keyout server.key -subj "/CN=omnicare-db.local"

# Set permissions
chmod 600 server.key
chown postgres:postgres server.key server.crt

# Update postgresql.conf
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
```

## Database Architecture

### Schemas

1. **fhir**: Core FHIR resources (Patient, Encounter, Observation, etc.)
2. **audit**: Comprehensive audit logging and HIPAA compliance
3. **admin**: User management and permissions
4. **reporting**: Materialized views for analytics
5. **migration**: Migration tracking
6. **backup**: Backup management and catalog
7. **replication**: Replication monitoring

### Key Features

#### Partitioning Strategy

- **resource_base**: Partitioned by resource_type
- **observation**: Range partitioned by effective_datetime (monthly)
- **audit.activity_log**: Range partitioned by event_time (monthly)

#### Optimized Indexes

- Composite indexes for common query patterns
- BRIN indexes for time-series data
- GIN indexes for JSONB searching
- Partial indexes for filtered queries

#### Audit Trail

- Comprehensive activity logging
- HIPAA-compliant access tracking
- Patient consent management
- Data modification tracking

## Replication Setup

### Streaming Replication

```bash
# On Primary
psql -U postgres -d omnicare_emr <<EOF
SELECT * FROM replication.create_physical_slot('replica1', 'replica1.omnicare.local', true);
EOF

# On Replica
pg_basebackup -h primary.omnicare.local -U replicator -D /var/lib/postgresql/13/main \
  -Fp -Xs -P -R -S replica1

# Start replica
systemctl start postgresql
```

### Logical Replication (for specific tables)

```sql
-- On Primary
SELECT replication.create_publication('omnicare_clinical', 
  ARRAY['fhir.patient', 'fhir.encounter', 'fhir.observation']);

-- On Subscriber
CREATE SUBSCRIPTION omnicare_clinical_sub
CONNECTION 'host=primary.omnicare.local dbname=omnicare_emr user=replicator'
PUBLICATION omnicare_clinical;
```

## Backup Configuration

### Automated Backup Schedule

```bash
# Add to postgres crontab
crontab -e

# Daily full backup at 2 AM
0 2 * * * /var/lib/postgresql/backups/scripts/full_backup.sh

# Hourly incremental backup
0 * * * * /var/lib/postgresql/backups/scripts/incremental_backup.sh

# Continuous WAL archiving (configured in postgresql.conf)
archive_mode = on
archive_command = '/var/lib/postgresql/backups/scripts/wal_archive.sh %f %p'
```

### Manual Backup

```bash
# Full backup
pg_basebackup -h localhost -U omnicare_backup -D /backup/manual/$(date +%Y%m%d) \
  -Ft -z -Xs -P

# Logical backup of specific schemas
pg_dump -h localhost -U omnicare_backup -d omnicare_emr \
  -n fhir -n audit -Fc -f /backup/logical/omnicare_$(date +%Y%m%d).dump
```

## Monitoring and Maintenance

### Health Checks

```sql
-- Overall system health
SELECT * FROM admin.health_check();

-- Backup status
SELECT * FROM backup.backup_health_dashboard;

-- Replication status
SELECT * FROM replication.replication_health_dashboard;

-- Query performance
SELECT * FROM admin.analyze_fhir_query_performance();
```

### Regular Maintenance Tasks

```bash
# Weekly maintenance script
#!/bin/bash

# Analyze tables
psql -U postgres -d omnicare_emr -c "ANALYZE;"

# Update table statistics
psql -U postgres -d omnicare_emr -c "SELECT admin.update_table_statistics();"

# Refresh materialized views
psql -U postgres -d omnicare_emr -c "SELECT admin.refresh_materialized_views();"

# Check data integrity
psql -U postgres -d omnicare_emr -c "SELECT * FROM fhir.validate_data_integrity();"

# Create future partitions
psql -U postgres -d omnicare_emr -c "SELECT admin.create_future_partitions();"
```

## Performance Tuning

### PostgreSQL Configuration

Key parameters for healthcare workload:

```conf
# Memory
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 256MB
maintenance_work_mem = 1GB

# Checkpoint
checkpoint_completion_target = 0.9
max_wal_size = 4GB
min_wal_size = 1GB

# Query Planning
default_statistics_target = 500
random_page_cost = 1.1  # For SSD

# Parallel Query
max_parallel_workers_per_gather = 4
max_parallel_maintenance_workers = 4
```

### Connection Pooling

Configure PgBouncer for connection pooling:

```ini
[databases]
omnicare_emr = host=localhost port=5432 dbname=omnicare_emr

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
```

## Troubleshooting

### Common Issues

1. **High Replication Lag**
   ```sql
   -- Check lag
   SELECT * FROM replication.check_replication_lag();
   
   -- Increase wal_keep_size if needed
   ALTER SYSTEM SET wal_keep_size = '2GB';
   ```

2. **Slow Queries**
   ```sql
   -- Enable query logging
   ALTER SYSTEM SET log_min_duration_statement = 500;
   
   -- Check slow queries
   SELECT * FROM pg_stat_statements 
   WHERE mean_exec_time > 1000 
   ORDER BY mean_exec_time DESC;
   ```

3. **Backup Failures**
   ```sql
   -- Check backup status
   SELECT * FROM backup.backup_catalog 
   WHERE status = 'failed' 
   ORDER BY started_at DESC;
   ```

## Security Best Practices

1. **Encryption at Rest**
   - Use encrypted file systems (LUKS, EBS encryption)
   - Enable backup encryption

2. **Encryption in Transit**
   - Always use SSL/TLS connections
   - Require SSL in pg_hba.conf

3. **Access Control**
   - Use role-based access control
   - Enable row-level security
   - Audit all access to patient data

4. **Regular Security Audits**
   ```sql
   -- Check for unauthorized access
   SELECT * FROM audit.suspicious_access_patterns;
   
   -- Review user permissions
   SELECT * FROM admin.user_permission_audit();
   ```

## Disaster Recovery

### Recovery Procedures

1. **Point-in-Time Recovery**
   ```bash
   # Restore base backup
   pg_basebackup -h backup-server -D /recovery/data -Ft -x
   
   # Configure recovery
   echo "restore_command = 'cp /backup/wal/%f %p'" > recovery.conf
   echo "recovery_target_time = '2025-01-20 14:30:00'" >> recovery.conf
   ```

2. **Failover to Replica**
   ```bash
   # On replica
   pg_ctl promote -D /var/lib/postgresql/13/main
   
   # Update application connection strings
   ```

## Support and Maintenance

- **Documentation**: Refer to `/database/docs/` for detailed documentation
- **Logs**: Check PostgreSQL logs at `/var/log/postgresql/`
- **Monitoring**: Set up alerts for critical metrics
- **Updates**: Regular PostgreSQL updates for security patches

## Compliance Notes

This deployment is designed to meet:
- HIPAA requirements for healthcare data
- FHIR R4 standards
- Data retention policies (7-year minimum)
- Audit trail requirements
- Encryption standards

## Contact Information

For issues or questions:
- Database Team: dba@omnicare.health
- Security Team: security@omnicare.health
- On-call Support: +1-555-DBA-HELP