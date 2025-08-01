# Getting Started with Lang Observatory

## Overview

This guide walks you through setting up Lang Observatory for monitoring your LLM applications. By the end, you'll have a fully functional observability stack running in your Kubernetes cluster.

## Prerequisites

Before you begin, ensure you have:

- **Kubernetes cluster** (v1.24 or later)
- **kubectl** configured to access your cluster
- **Helm** (v3.8 or later) installed
- **Minimum resources**: 4 CPU cores, 8GB RAM
- **Storage class** available for persistent volumes
- **Ingress controller** (nginx, traefik, etc.) for external access

## Quick Setup (5 minutes)

### Step 1: Add the Helm Repository

```bash
helm repo add terragon-charts https://terragon-labs.github.io/lang-observatory
helm repo update
```

### Step 2: Create Configuration

Create a `values.yaml` file with your configuration:

```yaml
# Basic configuration
langfuse:
  host: "https://langfuse.yourdomain.com"
  publicKey: "pk-lf-your-public-key"
  secretKey: "sk-lf-your-secret-key"

openlit:
  endpoint: "otel-collector:4317"
  environment: "production"

# Ingress configuration
ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: langfuse.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: langfuse-tls
      hosts:
        - langfuse.yourdomain.com

# Resource configuration
resources:
  langfuse:
    requests:
      memory: "512Mi"
      cpu: "250m"
    limits:
      memory: "1Gi"
      cpu: "500m"
  
  openlit:
    requests:
      memory: "256Mi"
      cpu: "100m"
    limits:
      memory: "512Mi"
      cpu: "200m"
```

### Step 3: Install Lang Observatory

```bash
helm install lang-observatory terragon-charts/lang-observatory \
  --namespace lang-observatory \
  --create-namespace \
  --values values.yaml
```

### Step 4: Verify Installation

```bash
# Check pod status
kubectl get pods -n lang-observatory

# Check services
kubectl get services -n lang-observatory

# Check ingress
kubectl get ingress -n lang-observatory
```

## Detailed Setup Guide

### Custom Database Configuration

By default, Lang Observatory uses in-cluster PostgreSQL. For production, configure an external database:

```yaml
langfuse:
  database:
    external: true
    host: "your-postgres-host"
    port: 5432
    name: "langfuse"
    user: "langfuse_user"
    password: "your-secure-password"
```

### Authentication Setup

Configure authentication for Langfuse:

```yaml
langfuse:
  auth:
    enabled: true
    providers:
      - name: "oauth"
        type: "oauth2"
        clientId: "your-oauth-client-id"
        clientSecret: "your-oauth-client-secret"
        issuer: "https://your-auth-provider.com"
```

### Monitoring Configuration

Enable comprehensive monitoring:

```yaml
monitoring:
  enabled: true
  prometheus:
    retention: "30d"
    storageClass: "fast-ssd"
    storage: "100Gi"
  
  grafana:
    adminPassword: "your-secure-password"
    dashboards:
      enabled: true
      defaultDashboards: true
    
  alertmanager:
    enabled: true
    config:
      global:
        smtp_smarthost: 'your-smtp-server:587'
        smtp_from: 'alerts@yourdomain.com'
```

## Connecting Your Application

### Python Applications

Install the Python SDK:

```bash
pip install langfuse openlit
```

Configure your application:

```python
from langfuse import Langfuse
from openlit import init

# Initialize Langfuse
langfuse = Langfuse(
    public_key="pk-lf-your-public-key",
    secret_key="sk-lf-your-secret-key",
    host="https://langfuse.yourdomain.com"
)

# Initialize OpenLIT
init(
    endpoint="https://otel.yourdomain.com",
    headers={"Authorization": "Bearer your-token"}
)

# Your LLM application code
def chat_with_llm(user_input):
    trace = langfuse.trace(name="chat_completion")
    
    # Your LLM call here
    response = your_llm_call(user_input)
    
    trace.generation(
        name="llm_response",
        input=user_input,
        output=response,
        model="gpt-4",
        usage={
            "input_tokens": len(user_input.split()),
            "output_tokens": len(response.split()),
        }
    )
    
    return response
```

### Node.js Applications

```bash
npm install langfuse @openlit/nodejs
```

```javascript
import { Langfuse } from 'langfuse';
import { init } from '@openlit/nodejs';

const langfuse = new Langfuse({
  publicKey: 'pk-lf-your-public-key',
  secretKey: 'sk-lf-your-secret-key',
  baseUrl: 'https://langfuse.yourdomain.com'
});

init({
  endpoint: 'https://otel.yourdomain.com',
  headers: { 'Authorization': 'Bearer your-token' }
});
```

## Accessing the Dashboard

### Langfuse UI
Navigate to `https://langfuse.yourdomain.com` to access the Langfuse interface for:
- Trace exploration
- Performance analysis
- Cost tracking
- Model comparison

### Grafana Dashboards
Access Grafana at `https://grafana.yourdomain.com` for:
- System metrics
- Custom dashboards
- Alerting rules
- Performance monitoring

Default login: `admin` / `password-from-values.yaml`

## Verification and Testing

### Health Checks

```bash
# Check all components
kubectl get pods -n lang-observatory

# Test Langfuse API
curl -f https://langfuse.yourdomain.com/api/public/health

# Test OpenLIT collector
curl -f https://otel.yourdomain.com/health
```

### Send Test Data

```python
# Send a test trace
trace = langfuse.trace(name="test_trace")
trace.generation(
    name="test_generation",
    input="Hello, world!",
    output="Hello! How can I help you today?",
    model="test-model"
)
```

## Troubleshooting

### Common Issues

**Pods not starting**
```bash
kubectl describe pod <pod-name> -n lang-observatory
kubectl logs <pod-name> -n lang-observatory
```

**Database connection issues**
- Verify database credentials in secrets
- Check network connectivity
- Validate database schema initialization

**Ingress not working**
- Verify ingress controller is running
- Check DNS resolution
- Validate TLS certificates

**Missing metrics**
- Verify OpenTelemetry configuration
- Check collector logs
- Validate application instrumentation

### Getting Help

- **Documentation**: [Full documentation](../README.md)
- **GitHub Issues**: [Report issues](https://github.com/terragon-labs/lang-observatory/issues)
- **Community**: [Join discussions](https://github.com/terragon-labs/lang-observatory/discussions)
- **Support**: opensource@terragonlabs.com

## Next Steps

After successful installation:

1. **Explore dashboards** - Review the pre-built Grafana dashboards
2. **Configure alerts** - Set up monitoring alerts for your use case
3. **Integrate applications** - Connect your LLM applications
4. **Customize monitoring** - Add custom metrics and dashboards
5. **Scale setup** - Configure for production scale and high availability

For detailed guides on each topic, see our [User Guides](README.md).