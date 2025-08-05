# Development Guide

## Prerequisites

### Required Tools

- **Kubernetes**: v1.24+ (kind, minikube, or full cluster)
- **Helm**: v3.8+
- **Docker**: v20.10+
- **Node.js**: v18+ (for development tools)
- **kubectl**: Compatible with your Kubernetes version

### Development Environment Setup

#### 1. Using Dev Container (Recommended)

The project includes a complete dev container configuration:

```bash
# Open in VS Code with Dev Containers extension
code .
# VS Code will prompt to reopen in container
```

#### 2. Manual Setup

```bash
# Clone the repository
git clone https://github.com/terragon-labs/lang-observatory.git
cd lang-observatory

# Install dependencies
npm install

# Add Helm repositories
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Update chart dependencies
helm dependency update ./charts/lang-observatory
```

## Development Workflow

### 1. Local Development with Docker Compose

For rapid development and testing:

```bash
# Start local development environment
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f

# Stop environment
docker-compose down
```

Access services:

- **Langfuse**: http://localhost:3000
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090

### 2. Kubernetes Development

#### Using Kind (Kubernetes in Docker)

```bash
# Create kind cluster
kind create cluster --name lang-observatory

# Set kubectl context
kubectl cluster-info --context kind-lang-observatory

# Install the chart
helm install lang-observatory ./charts/lang-observatory \
  --create-namespace \
  --namespace lang-observatory \
  --wait
```

#### Using Minikube

```bash
# Start minikube
minikube start --memory=4096 --cpus=2

# Enable ingress addon
minikube addons enable ingress

# Install the chart
helm install lang-observatory ./charts/lang-observatory \
  --create-namespace \
  --namespace lang-observatory \
  --set ingress.enabled=true \
  --wait
```

### 3. Testing Changes

#### Unit Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration

# Run tests with coverage
npm test -- --coverage
```

#### Helm Chart Testing

```bash
# Lint the chart
helm lint ./charts/lang-observatory

# Test template rendering
helm template lang-observatory ./charts/lang-observatory

# Validate against Kubernetes
npm run validate

# Run Helm tests
helm test lang-observatory -n lang-observatory
```

#### End-to-End Testing

```bash
# Run e2e tests (requires running cluster)
npm run test:e2e

# Run performance tests
npm run test:performance
```

## Chart Development

### Chart Structure

```
charts/lang-observatory/
├── Chart.yaml              # Chart metadata
├── Chart.lock              # Dependency lock file
├── values.yaml             # Default values
├── templates/              # Kubernetes templates
│   ├── NOTES.txt           # Post-install notes
│   ├── _helpers.tpl        # Template helpers
│   ├── tests/              # Helm test templates
│   └── *.yaml              # Resource templates
└── charts/                 # Subchart dependencies
```

### Adding New Components

#### 1. Create Template Files

```bash
# Create deployment template
cat > charts/lang-observatory/templates/my-component-deployment.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "lang-observatory.fullname" . }}-my-component
  labels:
    {{- include "lang-observatory.labels" . | nindent 4 }}
    app.kubernetes.io/component: my-component
spec:
  # Your deployment spec here
EOF
```

#### 2. Update Values Schema

Add configuration to `values.yaml`:

```yaml
myComponent:
  enabled: true
  replicaCount: 1
  image:
    repository: my-component
    tag: latest
    pullPolicy: IfNotPresent
  service:
    type: ClusterIP
    port: 8080
```

#### 3. Add Tests

Create test template in `charts/lang-observatory/templates/tests/`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ include "lang-observatory.fullname" . }}-my-component-test"
  annotations:
    "helm.sh/hook": test
spec:
  restartPolicy: Never
  containers:
    - name: test
      image: curlimages/curl
      command: ['curl']
      args: ['{{ include "lang-observatory.fullname" . }}-my-component:8080/health']
```

### Configuration Best Practices

#### 1. Template Helpers

Use the `_helpers.tpl` file for reusable template functions:

```yaml
{{/*
My component selector labels
*/}}
{{- define "lang-observatory.myComponentSelectorLabels" -}}
{{ include "lang-observatory.selectorLabels" . }}
app.kubernetes.io/component: my-component
{{- end }}
```

#### 2. Conditional Resources

Make components optional:

```yaml
{{- if .Values.myComponent.enabled }}
apiVersion: apps/v1
kind: Deployment
# ... deployment spec
{{- end }}
```

#### 3. Resource Naming

Follow consistent naming patterns:

```yaml
metadata:
  name: {{ include "lang-observatory.fullname" . }}-my-component
```

## Code Quality

### Linting and Formatting

```bash
# Lint Helm charts
helm lint ./charts/lang-observatory

# Lint YAML files
yamllint charts/

# Format files
npm run lint:fix
```

### Pre-commit Hooks

The project uses Husky for pre-commit hooks:

```bash
# Install Husky hooks
npm run prepare

# Manual pre-commit check
npm run precommit
```

## Debugging

### Chart Debugging

```bash
# Debug template rendering
helm template lang-observatory ./charts/lang-observatory --debug

# Debug with values
helm template lang-observatory ./charts/lang-observatory \
  --debug \
  --set langfuse.enabled=false

# Check rendered manifests
helm get manifest lang-observatory -n lang-observatory
```

### Application Debugging

```bash
# Check pod status
kubectl get pods -n lang-observatory

# View pod logs
kubectl logs -f deployment/lang-observatory-langfuse -n lang-observatory

# Describe problematic pods
kubectl describe pod <pod-name> -n lang-observatory

# Execute into pod for debugging
kubectl exec -it <pod-name> -n lang-observatory -- /bin/sh
```

### Port Forwarding for Local Access

```bash
# Langfuse UI
kubectl port-forward svc/lang-observatory-langfuse 3000:3000 -n lang-observatory

# Grafana
kubectl port-forward svc/lang-observatory-grafana 3001:80 -n lang-observatory

# Prometheus
kubectl port-forward svc/lang-observatory-prometheus 9090:9090 -n lang-observatory
```

## Performance Testing

### Load Testing with k6

```bash
# Install k6
brew install k6  # macOS
# or download from https://k6.io/

# Run performance tests
k6 run tests/performance/load-test.js \
  --env BASE_URL=http://localhost:3000
```

### Benchmarking

```bash
# Benchmark Helm operations
time helm install test-release ./charts/lang-observatory --dry-run

# Benchmark Kubernetes resource creation
time kubectl apply -f <(helm template ./charts/lang-observatory)
```

## Security Development

### Security Scanning

```bash
# Run all security scans
./scripts/security-scan.sh all

# Scan specific components
./scripts/security-scan.sh docker
./scripts/security-scan.sh kubernetes
```

### Security Testing

```bash
# Test pod security policies
kubectl auth can-i create pods --as=system:serviceaccount:lang-observatory:lang-observatory

# Test network policies
kubectl exec -it test-pod -- curl lang-observatory-langfuse:3000
```

## Contributing

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and add tests
4. Run the full test suite: `npm test`
5. Commit with conventional commits format
6. Push and create a pull request

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Code Review Guidelines

- All changes require at least one reviewer
- Automated tests must pass
- Security scans must pass
- Documentation must be updated for user-facing changes

## Troubleshooting

### Common Issues

#### 1. Chart Dependencies Not Found

```bash
helm dependency update ./charts/lang-observatory
```

#### 2. Kubernetes Resources Not Creating

```bash
# Check cluster connectivity
kubectl cluster-info

# Verify RBAC permissions
kubectl auth can-i create deployments -n lang-observatory
```

#### 3. Services Not Accessible

```bash
# Check service endpoints
kubectl get endpoints -n lang-observatory

# Verify network policies
kubectl describe networkpolicy -n lang-observatory
```

### Getting Help

- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions
- **Security**: security@terragonlabs.com for security issues
- **Documentation**: Check docs/ directory for additional guides
