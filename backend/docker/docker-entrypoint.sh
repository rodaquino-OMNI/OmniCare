#!/bin/sh
set -e

# OmniCare FHIR Backend Docker Entrypoint Script

echo "Starting OmniCare FHIR Backend..."

# Set default environment variables if not provided
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-8080}
export HOST=${HOST:-0.0.0.0}

# Validate required environment variables
check_required_env() {
    local var_name=$1
    local var_value=$(eval echo \$$var_name)
    
    if [ -z "$var_value" ]; then
        echo "ERROR: Required environment variable $var_name is not set"
        exit 1
    fi
}

echo "Validating environment configuration..."

# Check required environment variables
if [ "$NODE_ENV" = "production" ]; then
    echo "Production mode detected, validating required variables..."
    
    # Database configuration
    check_required_env "DATABASE_URL"
    
    # JWT configuration
    check_required_env "JWT_SECRET"
    
    # Medplum configuration
    if [ -z "$MEDPLUM_SELF_HOSTED" ] || [ "$MEDPLUM_SELF_HOSTED" = "false" ]; then
        check_required_env "MEDPLUM_CLIENT_ID"
        check_required_env "MEDPLUM_CLIENT_SECRET"
        check_required_env "MEDPLUM_PROJECT_ID"
    else
        check_required_env "MEDPLUM_SELF_HOSTED_URL"
    fi
fi

echo "Environment validation completed successfully"

# Wait for database to be ready if DATABASE_URL is provided
if [ -n "$DATABASE_URL" ]; then
    echo "Waiting for database to be ready..."
    
    # Extract database host and port from DATABASE_URL
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
        # Simple TCP check for database connectivity
        for i in $(seq 1 30); do
            if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
                echo "Database is ready!"
                break
            fi
            echo "Waiting for database... ($i/30)"
            sleep 2
        done
    fi
fi

# Wait for Redis to be ready if REDIS_URL is provided
if [ -n "$REDIS_URL" ]; then
    echo "Waiting for Redis to be ready..."
    
    # Extract Redis host and port from REDIS_URL
    REDIS_HOST=$(echo $REDIS_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    REDIS_PORT=$(echo $REDIS_URL | sed -n 's/.*:\([0-9]*\).*/\1/p')
    
    # If no @ symbol, it's likely redis://host:port format
    if [ -z "$REDIS_HOST" ]; then
        REDIS_HOST=$(echo $REDIS_URL | sed -n 's/redis:\/\/\([^:]*\):.*/\1/p')
        REDIS_PORT=$(echo $REDIS_URL | sed -n 's/redis:\/\/[^:]*:\([0-9]*\).*/\1/p')
    fi
    
    if [ -n "$REDIS_HOST" ] && [ -n "$REDIS_PORT" ]; then
        for i in $(seq 1 15); do
            if nc -z "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; then
                echo "Redis is ready!"
                break
            fi
            echo "Waiting for Redis... ($i/15)"
            sleep 2
        done
    fi
fi

# Create necessary directories
mkdir -p logs
mkdir -p certs

# Set file permissions
chmod 755 logs
chmod 700 certs

# Log startup information
echo "=========================================="
echo "OmniCare FHIR Backend Starting"
echo "Node.js Version: $(node --version)"
echo "Environment: $NODE_ENV"
echo "Port: $PORT"
echo "Host: $HOST"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "=========================================="

# Start the application
exec node dist/index.js