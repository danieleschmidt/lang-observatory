# GitHub Actions Setup Guide

This document provides templates and instructions for setting up GitHub Actions workflows for Lang Observatory.

⚠️ **Manual Setup Required**: Due to GitHub App security restrictions, workflow files must be manually created in your repository.

## Workflow Templates

### 1. Core CI/CD Workflow

**File**: `.github/workflows/ci.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Lint Helm charts
        run: helm lint charts/lang-observatory
      
      - name: Security scan
        run: |
          curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
          trivy fs --exit-code 1 --severity HIGH,CRITICAL .

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      
      - name: Build and package
        run: |
          helm dependency update charts/lang-observatory
          helm package charts/lang-observatory
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: helm-chart
          path: "*.tgz"
```

### 2. Security Scanning Workflow

**File**: `.github/workflows/security.yml`

```yaml
name: Security Scanning

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * *'

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
      
      - name: Generate SBOM
        run: |
          curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
          syft packages . -o spdx-json > sbom.json
      
      - name: Upload SBOM
        uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: sbom.json
```

### 3. Performance Testing Workflow

**File**: `.github/workflows/performance.yml`

```yaml
name: Performance Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * 0'  # Weekly

jobs:
  performance-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup k6
        run: |
          curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz --strip-components 1
          sudo mv k6 /usr/local/bin/
      
      - name: Run performance tests
        run: |
          k6 run tests/performance/load-test.js
          k6 run tests/performance/api-load-test.js
      
      - name: Generate performance report
        run: node scripts/generate-performance-report.js
      
      - name: Upload performance results
        uses: actions/upload-artifact@v4
        with:
          name: performance-results
          path: performance-results/
```

## Required Repository Secrets

Set these up in **Repository Settings > Secrets and variables > Actions**:

```bash
# Container registry
DOCKER_USERNAME          # Docker Hub username
DOCKER_PASSWORD          # Docker Hub token

# Helm repository
HELM_REPO_TOKEN         # Chart repository token

# Notifications (optional)
SLACK_WEBHOOK_URL       # Slack notifications
```

## Branch Protection Rules

Configure in **Repository Settings > Branches**:

```yaml
Branch protection rules for 'main':
  - Require pull request reviews: ✅
  - Dismiss stale reviews: ✅
  - Require status checks: ✅
    Required checks:
      - test
      - security-scan
  - Require up-to-date branches: ✅
  - Include administrators: ✅
```

## Manual Setup Steps

1. **Create workflow directory**:
   ```bash
   mkdir -p .github/workflows
   ```

2. **Copy templates**: Copy the workflow templates above into respective files

3. **Configure secrets**: Add required secrets in repository settings

4. **Set branch protection**: Configure branch protection rules

5. **Test workflows**: Create a test PR to validate workflows

## Integration with Existing Tools

These workflows integrate with:
- **Existing test suite**: `npm test`, `npm run test:*`
- **Helm validation**: `helm lint`, `helm template`
- **Security tools**: Trivy, SBOM generation
- **Performance tools**: k6, custom performance scripts

## Monitoring Workflow Performance

Track workflow metrics through:
- GitHub Actions insights
- Custom Grafana dashboards (if integrated)
- Performance trend analysis

---

**Note**: Always test workflows in feature branches before merging to main.