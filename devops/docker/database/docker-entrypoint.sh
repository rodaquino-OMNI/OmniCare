#!/bin/bash
set -e

# Custom entrypoint for OmniCare PostgreSQL with enhanced security

# Function to generate SSL certificates
generate_ssl_certs() {
    if [ ! -f "/var/lib/postgresql/server.key" ]; then
        echo "Generating SSL certificates..."
        
        # Generate private key
        openssl genrsa -out /var/lib/postgresql/server.key 2048
        
        # Generate certificate
        openssl req -new -x509 -days 365 -key /var/lib/postgresql/server.key \
            -out /var/lib/postgresql/server.crt \
            -subj "/C=US/ST=State/L=City/O=OmniCare/OU=EMR/CN=postgres"
        
        # Set proper permissions
        chown postgres:postgres /var/lib/postgresql/server.key /var/lib/postgresql/server.crt
        chmod 600 /var/lib/postgresql/server.key
        chmod 644 /var/lib/postgresql/server.crt
        
        echo "SSL certificates generated successfully"
    fi
}

# Function to setup logging directory
setup_logging() {
    mkdir -p /var/log/postgresql
    chown postgres:postgres /var/log/postgresql
    chmod 755 /var/log/postgresql
}

# Function to validate environment variables
validate_env() {
    if [ -z "$POSTGRES_DB" ]; then
        echo "Error: POSTGRES_DB environment variable is not set"
        exit 1
    fi
    
    if [ -z "$POSTGRES_USER" ]; then
        echo "Error: POSTGRES_USER environment variable is not set"
        exit 1
    fi
    
    if [ ! -f "/run/secrets/db_password" ] && [ -z "$POSTGRES_PASSWORD" ]; then
        echo "Error: Neither POSTGRES_PASSWORD_FILE nor POSTGRES_PASSWORD is set"
        exit 1
    fi
}

# Function to setup database password from secret
setup_password() {
    if [ -f "/run/secrets/db_password" ]; then
        export POSTGRES_PASSWORD=$(cat /run/secrets/db_password)
        echo "Database password loaded from secret"
    fi
}

# Function to create audit log table
create_audit_infrastructure() {
    echo "Setting up audit infrastructure..."
}

# Function to setup monitoring extensions
setup_monitoring() {
    echo "Setting up monitoring extensions..."
}

# Main execution
main() {
    echo "Starting OmniCare PostgreSQL initialization..."
    
    # Validate environment
    validate_env
    
    # Setup password from secret if available
    setup_password
    
    # Generate SSL certificates
    generate_ssl_certs
    
    # Setup logging
    setup_logging
    
    # Create necessary directories
    mkdir -p "$PGDATA"
    chown postgres:postgres "$PGDATA"
    chmod 700 "$PGDATA"
    
    echo "OmniCare PostgreSQL initialization completed"
    
    # Call the original PostgreSQL entrypoint
    exec docker-entrypoint.sh "$@"
}

# Execute main function
main "$@"