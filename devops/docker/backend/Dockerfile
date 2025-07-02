# Multi-stage build for OmniCare Backend
FROM node:18-alpine AS base

# Install security updates and necessary tools
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    python3 \
    make \
    g++ \
    libc6-compat && \
    rm -rf /var/cache/apk/*

# Set npm configuration for better performance
RUN npm config set cache /tmp/.npm && \
    npm config set prefer-offline true && \
    npm config set audit false && \
    npm config set fund false

# Create app directory with non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

WORKDIR /app
RUN chown nodejs:nodejs /app

# Copy package files
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Dependencies stage - optimized for caching
FROM base AS dependencies
COPY backend/package*.json ./
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Dev dependencies stage
FROM dependencies AS dev-dependencies
RUN npm ci --only=development --no-audit --no-fund && \
    npm cache clean --force

# Development stage
FROM dev-dependencies as development
USER nodejs
COPY --chown=nodejs:nodejs backend/src ./src
COPY --chown=nodejs:nodejs backend/tsconfig*.json ./
EXPOSE 3001
CMD ["dumb-init", "npm", "run", "dev"]

# Build stage with performance optimizations
FROM dev-dependencies as build
USER nodejs
COPY --chown=nodejs:nodejs backend/src ./src
COPY --chown=nodejs:nodejs backend/tsconfig*.json ./
COPY --chown=nodejs:nodejs backend/scripts ./scripts

# Multi-stage build optimization
ENV NODE_OPTIONS="--max-old-space-size=2048 --experimental-modules"
ENV CI=true
ENV NODE_ENV=production

# Build with parallel processing and caching
RUN --mount=type=cache,target=/app/.cache \
    --mount=type=cache,target=/tmp/.npm \
    npm run build:parallel && \
    npm run optimize:dist && \
    npm prune --production

# Production stage
FROM node:18-alpine as production

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

WORKDIR /app
RUN chown nodejs:nodejs /app

# Copy production dependencies first (better layer caching)
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./

# Enhanced optimization - remove development artifacts
RUN find ./dist -name '*.map' -delete && \
    find ./dist -name '*.d.ts' -delete && \
    find ./node_modules -name '*.d.ts' -delete && \
    find ./node_modules -name 'README*' -delete && \
    find ./node_modules -name 'CHANGELOG*' -delete && \
    find ./node_modules -name 'LICENSE*' -delete && \
    find ./node_modules -name '*.md' -delete && \
    find ./node_modules -name 'test' -type d -exec rm -rf {} + 2>/dev/null || true && \
    find ./node_modules -name 'tests' -type d -exec rm -rf {} + 2>/dev/null || true && \
    find ./node_modules -name '__tests__' -type d -exec rm -rf {} + 2>/dev/null || true && \
    find ./node_modules -name 'spec' -type d -exec rm -rf {} + 2>/dev/null || true && \
    find ./node_modules -name 'docs' -type d -exec rm -rf {} + 2>/dev/null || true

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => { \
        r.statusCode === 200 ? process.exit(0) : process.exit(1) })"

USER nodejs
EXPOSE 3001

CMD ["dumb-init", "node", "dist/index.js"]