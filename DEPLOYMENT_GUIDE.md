# 🚀 Lang Observatory Deployment Guide

Complete guide for deploying Lang Observatory in production environments with
comprehensive automation, monitoring, and scaling capabilities.

## 📋 Prerequisites

### System Requirements

- **CPU**: 4+ cores recommended
- **Memory**: 8GB+ RAM for production
- **Storage**: 50GB+ available space
- **Network**: Internet connectivity for external dependencies

### Software Requirements

- Docker 24.0+ and Docker Compose 2.0+
- Kubernetes 1.28+ (for K8s deployment)
- Helm 3.12+ (for Helm deployment)
- Node.js 20+ (for development)

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │────│  Lang Observatory │────│    Database     │
│     (NGINX)     │    │   (Node.js API)   │    │   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐             │
         │──────────────│     Cache       │─────────────│
                        │    (Redis)      │
                        └─────────────────┘
                                 │
                ┌─────────────────────────────────┐
                │        Observability Stack      │
                │  ┌──────────┐ ┌──────────────┐  │
                │  │ Langfuse │ │ OpenLIT OTEL │  │
                │  └──────────┘ └──────────────┘  │
                │  ┌──────────┐ ┌──────────────┐  │
                │  │Prometheus│ │   Grafana    │  │
                │  └──────────┘ └──────────────┘  │
                └─────────────────────────────────┘
```

## 🐳 Docker Deployment (Recommended for Development/Testing)

### Quick Start

```bash
# Clone repository
git clone https://github.com/terragon-labs/lang-observatory.git
cd lang-observatory

# Deploy with automated script
./scripts/deploy.sh --type docker --environment production

# Or manual deployment
docker-compose -f docker/docker-compose.production.yml up -d
```

### Environment Configuration

```bash
# Generate secure environment file
./scripts/deploy.sh --type docker --dry-run

# Edit configuration
vim .env.production

# Deploy with custom configuration
docker-compose -f docker/docker-compose.production.yml --env-file .env.production up -d
```

### Service Endpoints

- **Main API**: http://localhost:3000
- **Langfuse UI**: http://localhost:3001
- **Grafana Dashboard**: http://localhost:3002
- **Prometheus**: http://localhost:9090

## ☸️ Kubernetes Deployment (Recommended for Production)

### Prerequisites Setup

```bash
# Ensure kubectl is configured
kubectl cluster-info

# Create namespace
kubectl create namespace lang-observatory

# Apply RBAC and security policies
kubectl apply -f deployment/kubernetes/base/rbac.yaml
```

### Automated Deployment

```bash
# Deploy to Kubernetes
./scripts/deploy.sh --type kubernetes --namespace lang-observatory

# Monitor deployment
kubectl get pods -n lang-observatory -w
```

### Manual Deployment

```bash
# Apply all manifests
kubectl apply -f deployment/kubernetes/base/ -n lang-observatory

# Wait for deployment
kubectl wait --for=condition=available --timeout=600s deployment/lang-observatory -n lang-observatory

# Port forward for access
kubectl port-forward svc/lang-observatory 3000:3000 -n lang-observatory
```

### Scaling

```bash
# Horizontal scaling
kubectl scale deployment lang-observatory --replicas=5 -n lang-observatory

# Auto-scaling (HPA)
kubectl apply -f deployment/kubernetes/base/horizontalpodautoscaler.yaml -n lang-observatory
```

## 🎯 Helm Deployment (Recommended for Production)

### Installation

```bash
# Add Terragon Helm repository
helm repo add terragon-charts https://terragon-labs.github.io/lang-observatory
helm repo update

# Install with default values
helm install lang-observatory terragon-charts/lang-observatory

# Or deploy from source
./scripts/deploy.sh --type helm --environment production
```

### Custom Configuration

```bash
# Generate custom values file
helm show values terragon-charts/lang-observatory > values-custom.yaml

# Edit configuration
vim values-custom.yaml

# Deploy with custom values
helm upgrade --install lang-observatory terragon-charts/lang-observatory \
  --namespace lang-observatory \
  --create-namespace \
  --values values-custom.yaml
```

### Production Values Example

```yaml
# values-production.yaml
replicaCount: 3

image:
  repository: terragon-labs/lang-observatory
  tag: '0.1.0'
  pullPolicy: Always

resources:
  requests:
    cpu: 200m
    memory: 512Mi
  limits:
    cpu: 1
    memory: 1Gi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: lang-observatory.example.com
      paths:
        - path: /
          pathType: Prefix

langfuse:
  enabled: true
  database:
    external: true
    host: postgres.example.com

monitoring:
  prometheus:
    enabled: true
  grafana:
    enabled: true
    ingress:
      enabled: true
      hosts:
        - grafana.example.com

security:
  podSecurityStandards:
    enforceLevel: restricted
  networkPolicies:
    enabled: true
```

## 🔧 Configuration Management

### Environment Variables

```bash
# Core Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Database Configuration
DATABASE_URL=postgresql://user:password@host:5432/langfuse
REDIS_URL=redis://user:password@host:6379

# Langfuse Integration
LANGFUSE_PUBLIC_KEY=pk-lf-<generated>
LANGFUSE_SECRET_KEY=sk-lf-<generated>
LANGFUSE_HOST=http://langfuse:3000

# OpenTelemetry
OPENLIT_ENDPOINT=http://openlit-collector:4317

# Security
JWT_SECRET=<secure-random-string>
ENCRYPTION_KEY=<secure-random-string>

# Performance
ENABLE_CACHING=true
ENABLE_COMPRESSION=true
MAX_REQUEST_SIZE=10mb
```

### Database Initialization

```sql
-- Initialize PostgreSQL database
CREATE DATABASE langfuse;
CREATE USER langfuse WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE langfuse TO langfuse;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
```

## 📊 Monitoring & Observability

### Health Checks

```bash
# Application health
curl http://localhost:3000/api/health

# Detailed health status
curl http://localhost:3000/api/health/detailed

# Prometheus metrics
curl http://localhost:3000/api/metrics
```

### Monitoring Stack

1. **Prometheus**: Metrics collection and alerting
2. **Grafana**: Visualization dashboards
3. **Langfuse**: LLM trace analysis
4. **OpenLIT**: OpenTelemetry collection

### Key Metrics to Monitor

- **Request Rate**: Requests per second
- **Error Rate**: Error percentage
- **Response Time**: P95, P99 latencies
- **CPU/Memory**: Resource utilization
- **Queue Depth**: Background job queues
- **Cache Hit Rate**: Performance optimization

### Alerts Configuration

```yaml
# alerts.yaml
groups:
  - name: lang-observatory
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 2m
        annotations:
          summary: High error rate detected

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 2
        for: 5m
        annotations:
          summary: High response time detected

      - alert: DatabaseConnectionFailed
        expr: up{job="postgres"} == 0
        for: 1m
        annotations:
          summary: Database connection failed
```

## 🔐 Security Configuration

### TLS/SSL Setup

```bash
# Generate certificates (production should use proper CA)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key -out tls.crt

# Create Kubernetes secret
kubectl create secret tls lang-observatory-tls \
  --cert=tls.crt --key=tls.key -n lang-observatory
```

### Security Headers

```nginx
# nginx.conf security headers
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### Network Policies

```yaml
# networkpolicy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: lang-observatory-netpol
spec:
  podSelector:
    matchLabels:
      app: lang-observatory
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: nginx-ingress
      ports:
        - protocol: TCP
          port: 3000
```

## 🚀 Performance Optimization

### Resource Limits

```yaml
# Kubernetes resource configuration
resources:
  requests:
    cpu: '100m'
    memory: '256Mi'
  limits:
    cpu: '500m'
    memory: '512Mi'
```

### Caching Strategy

```yaml
# Redis configuration
redis:
  enabled: true
  master:
    persistence:
      enabled: true
      size: 8Gi
  replica:
    replicaCount: 2
```

### Load Balancing

```yaml
# Service configuration
spec:
  type: LoadBalancer
  sessionAffinity: ClientIP
  ports:
    - port: 80
      targetPort: 3000
      protocol: TCP
```

## 🔄 Backup & Recovery

### Database Backup

```bash
# Automated PostgreSQL backup
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME | \
  gzip > "backup_${DATE}.sql.gz"

# Upload to cloud storage
aws s3 cp "backup_${DATE}.sql.gz" s3://backups/lang-observatory/
```

### Configuration Backup

```bash
# Backup Kubernetes configurations
kubectl get all,cm,secrets -n lang-observatory -o yaml > \
  "k8s-backup-$(date +%Y%m%d).yaml"

# Backup Helm values
helm get values lang-observatory -n lang-observatory > \
  "helm-values-backup-$(date +%Y%m%d).yaml"
```

## 🔧 Troubleshooting

### Common Issues

#### Application Won't Start

```bash
# Check logs
docker-compose logs lang-observatory
# or
kubectl logs -f deployment/lang-observatory -n lang-observatory

# Common causes:
# - Database connection issues
# - Missing environment variables
# - Port conflicts
# - Resource constraints
```

#### Database Connection Issues

```bash
# Test database connectivity
docker exec -it lang-observatory-postgres psql -U langfuse -d langfuse -c "SELECT 1;"

# Check connection string
echo $DATABASE_URL
```

#### Performance Issues

```bash
# Check resource utilization
kubectl top pods -n lang-observatory

# Monitor metrics
curl http://localhost:3000/api/metrics | grep -E "(cpu|memory|requests)"

# Check for memory leaks
kubectl exec -it deployment/lang-observatory -n lang-observatory -- \
  node --inspect-brk=0.0.0.0:9229 src/cli/index.js
```

### Log Analysis

```bash
# Structured log queries
# Application logs
kubectl logs -f deployment/lang-observatory -n lang-observatory | \
  jq 'select(.level=="error")'

# Database logs
kubectl logs -f deployment/postgres -n lang-observatory | \
  grep -i "error\|warning"
```

## 📈 Scaling Guidelines

### Horizontal Scaling

```bash
# Scale based on CPU utilization
kubectl autoscale deployment lang-observatory \
  --cpu-percent=70 \
  --min=3 \
  --max=10 \
  -n lang-observatory
```

### Vertical Scaling

```bash
# Increase resource limits
kubectl patch deployment lang-observatory -n lang-observatory -p \
  '{"spec":{"template":{"spec":{"containers":[{"name":"lang-observatory","resources":{"limits":{"cpu":"1","memory":"1Gi"}}}]}}}}'
```

### Database Scaling

```sql
-- PostgreSQL optimization
-- Connection pooling
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';

-- Indexing for performance
CREATE INDEX CONCURRENTLY idx_llm_calls_timestamp ON llm_calls(created_at);
CREATE INDEX CONCURRENTLY idx_traces_session ON traces(session_id);
```

## 🔄 Maintenance

### Regular Maintenance Tasks

```bash
# Weekly maintenance script
#!/bin/bash

# Update container images
docker-compose pull
kubectl set image deployment/lang-observatory lang-observatory=lang-observatory:latest -n lang-observatory

# Clean up old data
psql $DATABASE_URL -c "DELETE FROM traces WHERE created_at < NOW() - INTERVAL '30 days';"

# Vacuum database
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Clean Docker images
docker system prune -f

# Restart services if needed
kubectl rollout restart deployment/lang-observatory -n lang-observatory
```

### Security Updates

```bash
# Check for vulnerabilities
trivy image lang-observatory:latest

# Update base images
docker build --pull --no-cache -f docker/Dockerfile.production -t lang-observatory:latest .

# Apply security patches
kubectl apply -f security/pod-security-standards.yaml -n lang-observatory
```

## 📚 Additional Resources

- [API Documentation](docs/API.md)
- [Architecture Guide](docs/ARCHITECTURE.md)
- [Security Configuration](docs/SECURITY_CONFIGURATION.md)
- [Performance Tuning](docs/PERFORMANCE_TUNING.md)
- [Monitoring Guide](docs/MONITORING.md)

## 🆘 Support

For deployment issues or questions:

- GitHub Issues: https://github.com/terragon-labs/lang-observatory/issues
- Documentation: https://docs.terragon-labs.com/lang-observatory
- Community: https://discord.gg/terragon-labs

---

**Production Deployment Checklist:**

- [ ] Environment variables configured
- [ ] TLS certificates installed
- [ ] Database initialized and secured
- [ ] Monitoring and alerting configured
- [ ] Backup strategy implemented
- [ ] Security policies applied
- [ ] Performance testing completed
- [ ] Documentation updated
- [ ] Team training completed
