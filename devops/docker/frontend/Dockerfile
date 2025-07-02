# Multi-stage build for OmniCare Frontend (Next.js)
FROM node:18-alpine AS base

# Install security updates and necessary tools
RUN apk update && apk upgrade && \
    apk add --no-cache libc6-compat && \
    rm -rf /var/cache/apk/*

# Set npm configuration for better performance
RUN npm config set cache /tmp/.npm && \
    npm config set prefer-offline true && \
    npm config set audit false && \
    npm config set fund false

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S frontend -u 1001

WORKDIR /app
RUN chown nodejs:nodejs /app

# Development stage
FROM dev-deps as development
USER nodejs
COPY --chown=nodejs:nodejs frontend .
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED 1
CMD ["npm", "run", "dev"]

# Dependencies stage - optimized for caching
FROM base AS deps
COPY frontend/package*.json ./
USER nodejs
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Dev dependencies stage
FROM deps AS dev-deps
RUN npm ci --only=development --no-audit --no-fund && \
    npm cache clean --force

# Build stage with enhanced optimizations
FROM dev-deps AS build
USER nodejs
COPY --chown=nodejs:nodejs frontend .

# Environment variables for build optimization
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096 --experimental-modules"
ENV NEXT_PUBLIC_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ENV CI=true
ENV DISABLE_ESLINT_PLUGIN=true
ENV TURBO_TELEMETRY_DISABLED=1

# Build with caching and parallel processing
RUN --mount=type=cache,target=/app/.next/cache \
    --mount=type=cache,target=/tmp/.npm \
    npm run build:fast && \
    npm run bundle:check || true

# Production stage
FROM node:18-alpine AS production

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S frontend -u 1001

WORKDIR /app

# Copy production dependencies first (better layer caching)
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application files
COPY --from=build --chown=nodejs:nodejs /app/public ./public
COPY --from=build --chown=nodejs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nodejs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./

# Enhanced production image optimization
RUN find .next -name '*.map' -delete && \
    find .next -name '*.d.ts' -delete && \
    find ./node_modules -name '*.d.ts' -delete && \
    find ./node_modules -name 'README*' -delete && \
    find ./node_modules -name 'CHANGELOG*' -delete && \
    find ./node_modules -name 'LICENSE*' -delete && \
    find ./node_modules -name '*.md' -delete && \
    find ./node_modules -name 'test' -type d -exec rm -rf {} + 2>/dev/null || true && \
    find ./node_modules -name 'tests' -type d -exec rm -rf {} + 2>/dev/null || true && \
    find ./node_modules -name '__tests__' -type d -exec rm -rf {} + 2>/dev/null || true && \
    find ./node_modules -name 'spec' -type d -exec rm -rf {} + 2>/dev/null || true && \
    find ./node_modules -name 'docs' -type d -exec rm -rf {} + 2>/dev/null || true && \
    # Optimize Next.js build artifacts
    rm -rf .next/cache/webpack && \
    rm -rf .next/cache/swc

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { \
        r.statusCode === 200 ? process.exit(0) : process.exit(1) })"

USER nodejs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

CMD ["dumb-init", "node", "server.js"]