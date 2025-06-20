# Multi-stage build for OmniCare Mobile (React Native)
FROM node:18-alpine AS base

# Install dependencies for React Native builds
RUN apk update && apk upgrade && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    openssh \
    curl \
    bash && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mobile -u 1001

WORKDIR /app
RUN chown nodejs:nodejs /app

# Copy package files
COPY mobile/package*.json ./

# Development stage
FROM base as development
USER nodejs
RUN npm ci
COPY --chown=nodejs:nodejs mobile .
EXPOSE 8081
CMD ["npm", "start"]

# Build preparation stage
FROM base as build-prep
USER nodejs
RUN npm ci --only=production && npm cache clean --force
COPY --chown=nodejs:nodejs mobile .

# Android build stage
FROM openjdk:11-jdk AS android-build

# Install Android SDK
ENV ANDROID_HOME /opt/android-sdk-linux
ENV PATH ${PATH}:${ANDROID_HOME}/tools:${ANDROID_HOME}/platform-tools

RUN mkdir -p ${ANDROID_HOME} && \
    cd ${ANDROID_HOME} && \
    curl -o sdk-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-7583922_latest.zip && \
    unzip sdk-tools.zip && \
    rm sdk-tools.zip

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# Copy mobile app
WORKDIR /app
COPY --from=build-prep /app .

# Build Android APK
RUN npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle

# Metro bundler service (for development)
FROM base as metro
USER nodejs
COPY --from=build-prep --chown=nodejs:nodejs /app .
EXPOSE 8081
CMD ["npx", "react-native", "start", "--host", "0.0.0.0"]

# Production bundle server
FROM nginx:alpine as production

# Install security updates
RUN apk update && apk upgrade && \
    rm -rf /var/cache/apk/*

# Copy built assets
COPY --from=build-prep /app/dist /usr/share/nginx/html
COPY devops/docker/mobile/nginx.conf /etc/nginx/nginx.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]