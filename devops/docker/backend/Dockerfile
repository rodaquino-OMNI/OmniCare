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

# Create app directory with non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

WORKDIR /app
RUN chown nodejs:nodejs /app

# Copy package files
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Development stage
FROM base as development
USER nodejs
RUN npm ci --only=development
COPY --chown=nodejs:nodejs backend/src ./src
EXPOSE 3001
CMD ["dumb-init", "npm", "run", "dev"]

# Build stage
FROM base as build
USER nodejs
RUN npm ci --only=production && npm cache clean --force
COPY --chown=nodejs:nodejs backend/src ./src
RUN npm run build

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

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => { \
        r.statusCode === 200 ? process.exit(0) : process.exit(1) })"

USER nodejs
EXPOSE 3001

CMD ["dumb-init", "node", "dist/index.js"]