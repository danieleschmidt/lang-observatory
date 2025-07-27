# Build stage for Node.js dependencies
FROM node:20-alpine AS node-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Base stage with tools
FROM alpine:3.19 AS base

# Install system dependencies
RUN apk add --no-cache \
    curl \
    ca-certificates \
    bash \
    git \
    jq \
    yq \
    && rm -rf /var/cache/apk/*

# Install Helm
RUN curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 && \
    chmod 700 get_helm.sh && \
    ./get_helm.sh && \
    rm get_helm.sh

# Install kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/

# Install security scanning tools
RUN curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# Builder stage
FROM base AS builder

WORKDIR /app

# Copy source files
COPY charts/ ./charts/
COPY config/ ./config/
COPY scripts/ ./scripts/
COPY package*.json ./
COPY --from=node-builder /app/node_modules ./node_modules

# Validate and build charts
RUN helm dependency update ./charts/lang-observatory
RUN helm lint ./charts/lang-observatory
RUN helm template ./charts/lang-observatory --validate
RUN helm package ./charts/lang-observatory

# Run security scans during build
RUN trivy fs --security-checks vuln,config --format json --output trivy-results.json .

# Production runtime stage
FROM base AS runtime

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/*.tgz ./charts/
COPY --from=builder /app/charts/ ./charts/
COPY --from=builder /app/config/ ./config/
COPY --from=builder /app/scripts/ ./scripts/

# Copy Node.js artifacts for scripts that need them
COPY --from=node-builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

# Health check script
COPY scripts/health-check.sh /usr/local/bin/health-check
RUN chmod +x /usr/local/bin/health-check

USER appuser

# Expose ports for health checks and metrics
EXPOSE 8080 9090

# Add labels for better image management
LABEL org.opencontainers.image.title="Lang Observatory" \
      org.opencontainers.image.description="A turnkey observability stack for large language models" \
      org.opencontainers.image.source="https://github.com/terragon-labs/lang-observatory" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.vendor="Terragon Labs" \
      org.opencontainers.image.version="${VERSION:-latest}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /usr/local/bin/health-check

# Default command
CMD ["helm", "template", "lang-observatory", "./charts/lang-observatory"]