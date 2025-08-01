# Local Development Setup

## Overview

This guide helps you set up a complete Lang Observatory development environment on your local machine using Docker Compose, enabling rapid development and testing.

## Prerequisites

- **Docker** (v20.10+) and **Docker Compose** (v2.0+)
- **Node.js** (v18+) for running tests and build scripts
- **Helm** (v3.8+) for chart development
- **kubectl** for Kubernetes testing (optional)
- **Git** for version control

## Quick Start (2 minutes)

```bash
# Clone the repository
git clone https://github.com/terragon-labs/lang-observatory.git
cd lang-observatory

# Start the complete stack
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready (30-60 seconds)
docker-compose -f docker-compose.dev.yml logs -f

# Access the services
echo "Langfuse UI: http://localhost:3000"
echo "Grafana: http://localhost:3001 (admin/admin)"
echo "Prometheus: http://localhost:9090"
```

## Development Environment Details

### Service Overview

The development stack includes:

| Service | Port | Purpose | Credentials |
|---------|------|---------|-------------|
| Langfuse | 3000 | LLM tracing UI | Email: admin@example.com, Password: password |
| Grafana | 3001 | Dashboards and visualization | admin/admin |
| Prometheus | 9090 | Metrics collection | No auth |
| OpenLIT | 4317 | OpenTelemetry collector | No auth |
| PostgreSQL | 5432 | Database for Langfuse | langfuse/password |
| Redis | 6379 | Caching layer | No auth |

### Directory Structure

```
lang-observatory/
├── charts/                 # Helm charts
├── config/                # Development configurations
├── dashboards/            # Grafana dashboard JSON files
├── docker-compose.dev.yml # Development stack
├── docs/                  # Documentation
├── scripts/               # Development and build scripts
└── tests/                 # Test suites
```

## Development Workflow

### Making Changes to Helm Charts

```bash
# Edit chart templates
vim charts/lang-observatory/templates/langfuse-deployment.yaml

# Lint the chart
helm lint ./charts/lang-observatory

# Test template rendering
helm template test-release ./charts/lang-observatory \
  --values ./charts/lang-observatory/values.yaml

# Validate with Kubernetes
helm template ./charts/lang-observatory | kubectl apply --dry-run=client -f -
```

### Adding New Dashboards

```bash
# Create dashboard in Grafana UI (localhost:3001)
# Export dashboard JSON
# Save to dashboards/ directory
cp downloaded-dashboard.json dashboards/new-feature-dashboard.json

# Test dashboard loading
docker-compose -f docker-compose.dev.yml restart grafana
```

### Configuration Development

```bash
# Edit OpenTelemetry collector config
vim config/otel-collector-config.yaml

# Edit Prometheus config
vim config/prometheus.yml

# Restart affected services
docker-compose -f docker-compose.dev.yml restart otel-collector prometheus
```

## Testing Your Changes

### Unit Tests

```bash
# Install dependencies
npm install

# Run unit tests
npm run test:unit

# Run with coverage
npm run test -- --coverage
```

### Integration Tests

```bash
# Ensure development stack is running
docker-compose -f docker-compose.dev.yml up -d

# Run integration tests
npm run test:integration

# Test Helm chart functionality
npm run test:helm
```

### End-to-End Tests

```bash
# Run E2E tests against local stack
npm run test:e2e

# Test with sample data
npm run test:e2e -- --generate-sample-data
```

### Performance Testing

```bash
# Run load tests against local stack
npm run test:performance

# Generate performance report
npm run test:performance:memory-usage
```

## Sample Application Integration

### Python Example

Create a test application to generate sample data:

```python
# test-app.py
import time
import random
from langfuse import Langfuse
from openlit import init

# Initialize clients
langfuse = Langfuse(
    public_key="pk-lf-test",
    secret_key="sk-lf-test",
    host="http://localhost:3000"
)

init(endpoint="http://localhost:4317")

def simulate_llm_calls():
    """Generate sample LLM traces"""
    models = ["gpt-4", "gpt-3.5-turbo", "claude-3", "llama-2"]
    
    for i in range(100):
        model = random.choice(models)
        
        trace = langfuse.trace(
            name=f"chat_completion_{i}",
            user_id=f"user_{i % 10}"
        )
        
        # Simulate LLM generation
        trace.generation(
            name="llm_call",
            model=model,
            input=f"Test prompt {i}",
            output=f"Test response {i}",
            usage={
                "input_tokens": random.randint(10, 100),
                "output_tokens": random.randint(20, 200),
                "total_tokens": random.randint(30, 300)
            },
            metadata={
                "temperature": 0.7,
                "max_tokens": 256
            }
        )
        
        time.sleep(0.1)  # Rate limiting

if __name__ == "__main__":
    simulate_llm_calls()
```

Run the sample application:

```bash
# Install dependencies
pip install langfuse openlit

# Run sample data generation
python test-app.py
```

### Node.js Example

```javascript
// test-app.js
const { Langfuse } = require('langfuse');
const { init } = require('@openlit/nodejs');

const langfuse = new Langfuse({
  publicKey: 'pk-lf-test',
  secretKey: 'sk-lf-test',
  baseUrl: 'http://localhost:3000'
});

init({ endpoint: 'http://localhost:4317' });

async function simulateLLMCalls() {
  const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3'];
  
  for (let i = 0; i < 50; i++) {
    const trace = langfuse.trace({
      name: `node_chat_${i}`,
      userId: `user_${i % 5}`
    });
    
    trace.generation({
      name: 'llm_call',
      model: models[i % models.length],
      input: `Node test prompt ${i}`,
      output: `Node test response ${i}`,
      usage: {
        inputTokens: Math.floor(Math.random() * 100) + 10,
        outputTokens: Math.floor(Math.random() * 200) + 20
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

simulateLLMCalls();
```

## Debugging and Troubleshooting

### Common Issues

**Services not starting**
```bash
# Check service logs
docker-compose -f docker-compose.dev.yml logs langfuse

# Check resource usage
docker stats

# Reset everything
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

**Database connection issues**
```bash
# Connect to PostgreSQL directly
docker-compose -f docker-compose.dev.yml exec postgres psql -U langfuse -d langfuse

# Check database logs
docker-compose -f docker-compose.dev.yml logs postgres
```

**Missing metrics in Grafana**
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check OpenTelemetry collector
curl http://localhost:8888/debug/tracez

# Verify collector config
docker-compose -f docker-compose.dev.yml exec otel-collector cat /etc/otel-collector-config.yaml
```

### Performance Optimization

```bash
# Monitor resource usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Optimize for development
export COMPOSE_PROJECT_NAME=langobs-dev
docker-compose -f docker-compose.dev.yml up -d --scale langfuse=1
```

## IDE Configuration

### VS Code Setup

Create `.vscode/settings.json`:

```json
{
  "yaml.schemas": {
    "https://json.schemastore.org/helm-chart.json": "charts/*/Chart.yaml",
    "https://json.schemastore.org/chart-values.json": "charts/*/values.yaml"
  },
  "yaml.validate": true,
  "files.associations": {
    "*.yaml": "yaml",
    "*.yml": "yaml"
  }
}
```

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Dev Stack",
      "type": "shell",
      "command": "docker-compose -f docker-compose.dev.yml up -d",
      "group": "build"
    },
    {
      "label": "Run Tests",
      "type": "shell",
      "command": "npm test",
      "group": "test"
    },
    {
      "label": "Lint Helm Chart",
      "type": "shell",
      "command": "helm lint ./charts/lang-observatory",
      "group": "build"
    }
  ]
}
```

## Contributing Changes

Before submitting changes:

```bash
# Run full test suite
npm run test

# Run linting
npm run lint

# Run security scan
npm run security:scan

# Test Helm chart
helm lint ./charts/lang-observatory
helm template ./charts/lang-observatory --validate

# Clean up
docker-compose -f docker-compose.dev.yml down -v
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for detailed contribution guidelines.

## Next Steps

- Explore the [Production Deployment Guide](production-deployment.md)
- Review [Testing Patterns](../AI_ML_TESTING_PATTERNS.md)
- Check out [Custom Dashboards Guide](custom-dashboards.md)
- Learn about [Security Best Practices](security-best-practices.md)