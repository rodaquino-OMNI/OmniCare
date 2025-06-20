# Multi-stage build for OmniCare Frontend (Next.js)
FROM node:18-alpine AS base

# Install security updates and necessary tools
RUN apk update && apk upgrade && \
    apk add --no-cache libc6-compat && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S frontend -u 1001

WORKDIR /app
RUN chown nodejs:nodejs /app

# Install dependencies based on the preferred package manager
COPY frontend/package*.json ./

# Development stage
FROM base as development
USER nodejs
RUN npm ci
COPY --chown=nodejs:nodejs frontend .
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
CMD ["npm", "run", "dev"]

# Dependencies stage
FROM base AS deps
USER nodejs
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS build
USER nodejs
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs frontend .

# Environment variables for build
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Build the application
RUN npm run build

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

# Copy necessary files
COPY --from=build --chown=nodejs:nodejs /app/public ./public
COPY --from=build --chown=nodejs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nodejs:nodejs /app/.next/static ./.next/static

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