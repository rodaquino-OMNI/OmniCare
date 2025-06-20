# PostgreSQL Database for OmniCare EMR with HIPAA compliance
FROM postgres:15-alpine

# Install security updates and necessary tools
RUN apk update && apk upgrade && \
    apk add --no-cache \
    postgresql-contrib \
    curl \
    bash && \
    rm -rf /var/cache/apk/*

# Set environment variables
ENV POSTGRES_DB=omnicare_emr
ENV POSTGRES_USER=omnicare_user
ENV POSTGRES_PASSWORD_FILE=/run/secrets/db_password
ENV PGDATA=/var/lib/postgresql/data/pgdata

# Create necessary directories
RUN mkdir -p /var/lib/postgresql/data/pgdata && \
    mkdir -p /docker-entrypoint-initdb.d && \
    mkdir -p /var/log/postgresql && \
    chown -R postgres:postgres /var/lib/postgresql /var/log/postgresql

# Copy database initialization scripts
COPY database/schema/*.sql /docker-entrypoint-initdb.d/
COPY database/scripts/*.sql /docker-entrypoint-initdb.d/
COPY devops/docker/database/init-scripts/ /docker-entrypoint-initdb.d/

# Copy custom PostgreSQL configuration
COPY devops/docker/database/postgresql.conf /etc/postgresql/postgresql.conf
COPY devops/docker/database/pg_hba.conf /etc/postgresql/pg_hba.conf

# Set proper permissions
RUN chmod +x /docker-entrypoint-initdb.d/*.sql
RUN chown postgres:postgres /etc/postgresql/*.conf

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD pg_isready -U $POSTGRES_USER -d $POSTGRES_DB -h localhost -p 5432 || exit 1

# Expose PostgreSQL port
EXPOSE 5432

# Use custom entrypoint for additional security
COPY devops/docker/database/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER postgres

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]