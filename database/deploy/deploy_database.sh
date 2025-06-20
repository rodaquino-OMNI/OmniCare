#!/bin/bash
# =====================================================
# OmniCare EMR - Database Deployment Script
# Author: Database Engineer
# Purpose: Deploy PostgreSQL database with FHIR schema and migrations
# Version: 1.0.0
# Date: 2025-01-20
# =====================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-omnicare_emr}"
DB_ADMIN_USER="${DB_ADMIN_USER:-postgres}"
DB_APP_USER="${DB_APP_USER:-omnicare_app}"
BACKUP_PATH="${BACKUP_PATH:-/var/lib/postgresql/backups}"
LOG_FILE="${LOG_FILE:-/var/log/omnicare_deploy.log}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check PostgreSQL client
    if ! command -v psql &> /dev/null; then
        error "PostgreSQL client (psql) not found. Please install PostgreSQL."
    fi
    
    # Check PostgreSQL version
    PG_VERSION=$(psql --version | awk '{print $3}' | cut -d. -f1)
    if [ "$PG_VERSION" -lt 13 ]; then
        error "PostgreSQL 13 or higher is required. Found version: $PG_VERSION"
    fi
    
    # Check connection
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -c '\l' &> /dev/null; then
        error "Cannot connect to PostgreSQL at $DB_HOST:$DB_PORT"
    fi
    
    log "Prerequisites check passed."
}

create_database() {
    log "Creating database $DB_NAME..."
    
    # Check if database exists
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        warning "Database $DB_NAME already exists. Skipping creation."
    else
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" <<EOF
CREATE DATABASE $DB_NAME
    WITH 
    OWNER = $DB_ADMIN_USER
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF8'
    LC_CTYPE = 'en_US.UTF8'
    TABLESPACE = pg_default
    CONNECTION LIMIT = 200;

COMMENT ON DATABASE $DB_NAME IS 'OmniCare EMR FHIR R4 Compliant Database';
EOF
        log "Database created successfully."
    fi
}

configure_database() {
    log "Configuring database parameters..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -d "$DB_NAME" <<EOF
-- Performance tuning for healthcare workload
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET max_wal_size = '4GB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '32MB';
ALTER SYSTEM SET default_statistics_target = 500;
ALTER SYSTEM SET random_page_cost = 1.1;

-- Enable query optimization
ALTER SYSTEM SET enable_partitionwise_join = on;
ALTER SYSTEM SET enable_partitionwise_aggregate = on;
ALTER SYSTEM SET jit = on;

-- Security settings
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET password_encryption = 'scram-sha-256';

-- Logging for audit
ALTER SYSTEM SET log_statement = 'mod';
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;

-- Replication settings
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET max_wal_senders = 3;
ALTER SYSTEM SET wal_keep_size = '1GB';

SELECT pg_reload_conf();
EOF
    
    log "Database configuration applied."
}

create_users() {
    log "Creating database users..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -d "$DB_NAME" <<EOF
-- Create application user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_APP_USER') THEN
        CREATE ROLE $DB_APP_USER WITH LOGIN PASSWORD 'ChangeMeImmediately';
    END IF;
END
\$\$;

-- Create other required users
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'omnicare_readonly') THEN
        CREATE ROLE omnicare_readonly WITH LOGIN PASSWORD 'ChangeMeImmediately';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'omnicare_backup') THEN
        CREATE ROLE omnicare_backup WITH LOGIN PASSWORD 'ChangeMeImmediately';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'omnicare_monitor') THEN
        CREATE ROLE omnicare_monitor WITH LOGIN PASSWORD 'ChangeMeImmediately';
    END IF;
END
\$\$;

-- Create functional roles
CREATE ROLE IF NOT EXISTS physician_role;
CREATE ROLE IF NOT EXISTS nurse_role;
CREATE ROLE IF NOT EXISTS admin_staff_role;
CREATE ROLE IF NOT EXISTS pharmacist_role;
CREATE ROLE IF NOT EXISTS lab_tech_role;
CREATE ROLE IF NOT EXISTS patient_role;
EOF
    
    warning "Default passwords set. Please change them immediately!"
    log "Users created successfully."
}

run_schema_scripts() {
    log "Running schema creation scripts..."
    
    local SCHEMA_DIR="../schema"
    
    # Run schema scripts in order
    for script in \
        "01_fhir_foundation.sql" \
        "02_fhir_workflow.sql" \
        "03_audit_security.sql" \
        "04_performance_optimization.sql"
    do
        if [ -f "$SCHEMA_DIR/$script" ]; then
            log "Executing $script..."
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -d "$DB_NAME" -f "$SCHEMA_DIR/$script"
        else
            warning "Schema script $script not found, skipping..."
        fi
    done
    
    log "Schema creation completed."
}

run_migrations() {
    log "Running database migrations..."
    
    local MIGRATION_DIR="../migrations"
    
    # Create migration tracking table if not exists
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -d "$DB_NAME" <<EOF
CREATE SCHEMA IF NOT EXISTS migration;

CREATE TABLE IF NOT EXISTS migration.applied_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    applied_by VARCHAR(100),
    execution_time_ms INTEGER,
    checksum VARCHAR(64),
    rollback_sql TEXT,
    status VARCHAR(20) DEFAULT 'applied'
);
EOF
    
    # Run migrations in order
    for migration in \
        "001_fhir_optimized_migrations.sql" \
        "002_enhanced_audit_trail.sql" \
        "003_replication_backup_strategy.sql"
    do
        if [ -f "$MIGRATION_DIR/$migration" ]; then
            VERSION=$(echo "$migration" | cut -d'_' -f1)
            
            # Check if migration already applied
            APPLIED=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -d "$DB_NAME" -tAc \
                "SELECT COUNT(*) FROM migration.applied_migrations WHERE version = '$VERSION'")
            
            if [ "$APPLIED" -eq 0 ]; then
                log "Applying migration $migration..."
                START_TIME=$(date +%s%N)
                
                psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -d "$DB_NAME" -f "$MIGRATION_DIR/$migration"
                
                END_TIME=$(date +%s%N)
                EXEC_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
                
                log "Migration $migration completed in ${EXEC_TIME}ms"
            else
                log "Migration $migration already applied, skipping..."
            fi
        else
            warning "Migration $migration not found, skipping..."
        fi
    done
    
    log "All migrations completed."
}

setup_backup_directories() {
    log "Setting up backup directories..."
    
    # Create backup directories
    sudo mkdir -p "$BACKUP_PATH/full"
    sudo mkdir -p "$BACKUP_PATH/incremental"
    sudo mkdir -p "$BACKUP_PATH/wal"
    sudo mkdir -p "$BACKUP_PATH/scripts"
    
    # Set permissions
    sudo chown -R postgres:postgres "$BACKUP_PATH"
    sudo chmod -R 750 "$BACKUP_PATH"
    
    log "Backup directories created."
}

create_backup_scripts() {
    log "Creating backup scripts..."
    
    # Create full backup script
    cat > "$BACKUP_PATH/scripts/full_backup.sh" <<'EOF'
#!/bin/bash
BACKUP_DIR="/var/lib/postgresql/backups/full"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="omnicare_full_${TIMESTAMP}"

pg_basebackup -h localhost -p 5432 -U omnicare_backup \
    -D "${BACKUP_DIR}/${BACKUP_NAME}" \
    -Ft -z -Xs -P \
    -l "Full Backup ${TIMESTAMP}"

# Update backup catalog
psql -h localhost -U omnicare_backup -d omnicare_emr <<SQL
INSERT INTO backup.backup_catalog (
    backup_label, backup_type, started_at, completed_at,
    backup_location, status
) VALUES (
    '${BACKUP_NAME}', 'full', NOW() - INTERVAL '10 minutes', NOW(),
    '${BACKUP_DIR}/${BACKUP_NAME}', 'completed'
);
SQL
EOF
    
    # Create WAL archive script
    cat > "$BACKUP_PATH/scripts/wal_archive.sh" <<'EOF'
#!/bin/bash
# PostgreSQL archive_command script
WAL_FILE=$1
WAL_PATH=$2
ARCHIVE_DIR="/var/lib/postgresql/backups/wal"

# Copy WAL file to archive
cp "$WAL_PATH" "${ARCHIVE_DIR}/${WAL_FILE}"

# Compress older WAL files
find "$ARCHIVE_DIR" -name "*.wal" -mtime +1 -exec gzip {} \;

# Clean up old WAL files (keep 7 days)
find "$ARCHIVE_DIR" -name "*.wal.gz" -mtime +7 -delete
EOF
    
    chmod +x "$BACKUP_PATH/scripts/"*.sh
    
    log "Backup scripts created."
}

setup_monitoring() {
    log "Setting up monitoring views and functions..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -d "$DB_NAME" <<EOF
-- Create monitoring user views
CREATE OR REPLACE VIEW monitoring.database_health AS
SELECT 
    current_database() as database_name,
    pg_database_size(current_database()) as database_size_bytes,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
    (SELECT count(*) FROM pg_stat_activity) as total_connections,
    (SELECT count(*) FROM pg_stat_replication) as replication_connections,
    (SELECT max(age(clock_timestamp(), query_start)) 
     FROM pg_stat_activity 
     WHERE state != 'idle') as oldest_query_duration,
    (SELECT count(*) FROM pg_locks WHERE NOT granted) as waiting_locks,
    NOW() as check_time;

-- Grant monitoring permissions
GRANT USAGE ON SCHEMA monitoring TO omnicare_monitor;
GRANT SELECT ON ALL TABLES IN SCHEMA monitoring TO omnicare_monitor;
GRANT pg_monitor TO omnicare_monitor;
EOF
    
    log "Monitoring setup completed."
}

validate_deployment() {
    log "Validating deployment..."
    
    # Run validation queries
    VALIDATION_RESULT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -d "$DB_NAME" -t <<EOF
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM pg_namespace WHERE nspname IN ('fhir', 'audit', 'admin', 'reporting')) >= 4
         AND (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'fhir') > 10
         AND (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'fhir') > 50
        THEN 'PASSED'
        ELSE 'FAILED'
    END as validation_status;
EOF
)
    
    if [[ "$VALIDATION_RESULT" == *"PASSED"* ]]; then
        log "Deployment validation PASSED"
    else
        error "Deployment validation FAILED"
    fi
}

generate_summary() {
    log "Generating deployment summary..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -d "$DB_NAME" <<EOF
\echo 'DEPLOYMENT SUMMARY'
\echo '=================='
\echo ''
\echo 'Database Information:'
SELECT current_database() as database, 
       version() as postgres_version,
       pg_size_pretty(pg_database_size(current_database())) as database_size;

\echo ''
\echo 'Schemas Created:'
SELECT nspname as schema_name 
FROM pg_namespace 
WHERE nspname IN ('fhir', 'audit', 'admin', 'reporting', 'migration', 'backup', 'replication')
ORDER BY nspname;

\echo ''
\echo 'Tables by Schema:'
SELECT schemaname, COUNT(*) as table_count
FROM pg_tables
WHERE schemaname IN ('fhir', 'audit', 'admin', 'reporting', 'backup', 'replication')
GROUP BY schemaname
ORDER BY schemaname;

\echo ''
\echo 'Applied Migrations:'
SELECT version, name, applied_at, status
FROM migration.applied_migrations
ORDER BY version;

\echo ''
\echo 'Users Created:'
SELECT usename as username, 
       CASE WHEN usesuper THEN 'SUPERUSER' ELSE 'REGULAR' END as user_type
FROM pg_user
WHERE usename LIKE 'omnicare%'
ORDER BY usename;
EOF
}

# Main execution
main() {
    log "Starting OmniCare EMR database deployment..."
    
    check_prerequisites
    create_database
    configure_database
    create_users
    run_schema_scripts
    run_migrations
    setup_backup_directories
    create_backup_scripts
    setup_monitoring
    validate_deployment
    generate_summary
    
    log "Deployment completed successfully!"
    
    echo ""
    echo "IMPORTANT POST-DEPLOYMENT STEPS:"
    echo "1. Change all default passwords immediately"
    echo "2. Configure SSL certificates in postgresql.conf"
    echo "3. Update pg_hba.conf for proper authentication"
    echo "4. Set up backup cron jobs"
    echo "5. Configure replication if needed"
    echo "6. Test application connectivity"
    echo "7. Run initial data integrity checks"
}

# Run main function
main "$@"