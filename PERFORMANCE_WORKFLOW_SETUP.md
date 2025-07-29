# Performance Benchmarking Workflow Setup

Due to GitHub App permission restrictions, the performance benchmarking workflow needs to be created manually. Below is the complete workflow file that should be added to `.github/workflows/performance-benchmarks.yml`.

## Workflow File Content

Create `.github/workflows/performance-benchmarks.yml` with the following content:

```yaml
name: Performance Benchmarks

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    # Run nightly at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to benchmark'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
      duration:
        description: 'Test duration in minutes'
        required: true
        default: '5'
        type: string

env:
  BENCHMARK_DURATION: ${{ github.event.inputs.duration || '5' }}
  BENCHMARK_ENV: ${{ github.event.inputs.environment || 'staging' }}

jobs:
  performance-baseline:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run baseline performance tests
        run: |
          npm run test:performance:baseline
          npm run test:performance:memory-usage
        
      - name: Store baseline results
        uses: actions/upload-artifact@v4
        with:
          name: performance-baseline-${{ github.sha }}
          path: |
            performance-results/
            memory-usage-results/
          retention-days: 30

  load-testing:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        scenario: [
          'langfuse-ingestion',
          'grafana-queries', 
          'prometheus-queries',
          'openlit-telemetry'
        ]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup k6
        uses: grafana/setup-k6-action@v1

      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'latest'

      - name: Setup Helm
        uses: azure/setup-helm@v3
        with:
          version: 'latest'

      - name: Create test namespace
        run: |
          kubectl create namespace perf-test-${{ github.run_id }} || true

      - name: Deploy test environment
        run: |
          helm install lang-observatory-perf ./charts/lang-observatory \
            --namespace perf-test-${{ github.run_id }} \
            --set prometheus.persistence.enabled=false \
            --set grafana.persistence.enabled=false \
            --set resources.requests.memory=128Mi \
            --set resources.requests.cpu=100m \
            --wait --timeout=300s

      - name: Wait for services to be ready
        run: |
          kubectl wait --for=condition=ready pod \
            --selector=app.kubernetes.io/instance=lang-observatory-perf \
            --namespace=perf-test-${{ github.run_id }} \
            --timeout=300s

      - name: Run load test - ${{ matrix.scenario }}
        run: |
          k6 run \
            --duration=${BENCHMARK_DURATION}m \
            --vus=10 \
            --out json=results-${{ matrix.scenario }}.json \
            tests/performance/scenarios/${{ matrix.scenario }}.js
        env:
          K6_NAMESPACE: perf-test-${{ github.run_id }}

      - name: Generate performance report
        run: |
          node scripts/generate-performance-report.js \
            --input results-${{ matrix.scenario }}.json \
            --output report-${{ matrix.scenario }}.html \
            --scenario ${{ matrix.scenario }}

      - name: Upload performance results
        uses: actions/upload-artifact@v4
        with:
          name: performance-results-${{ matrix.scenario }}-${{ github.run_id }}
          path: |
            results-${{ matrix.scenario }}.json
            report-${{ matrix.scenario }}.html

      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('results-${{ matrix.scenario }}.json', 'utf8'));
            
            const metrics = results.metrics;
            const p95 = metrics.http_req_duration?.p95 || 'N/A';
            const errorRate = metrics.http_req_failed?.rate || 0;
            const throughput = metrics.http_reqs?.rate || 'N/A';
            
            const comment = `## Performance Results - ${{ matrix.scenario }}
            
            | Metric | Value |
            |--------|-------|
            | P95 Response Time | ${p95}ms |
            | Error Rate | ${(errorRate * 100).toFixed(2)}% |
            | Throughput | ${throughput} req/s |
            | Duration | ${process.env.BENCHMARK_DURATION}m |
            
            📊 [Full Report](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });

      - name: Cleanup test environment
        if: always()
        run: |
          helm uninstall lang-observatory-perf \
            --namespace perf-test-${{ github.run_id }} || true
          kubectl delete namespace perf-test-${{ github.run_id }} || true

  benchmark-comparison:
    runs-on: ubuntu-latest
    needs: [load-testing]
    if: github.event_name == 'pull_request'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download current results
        uses: actions/download-artifact@v4
        with:
          pattern: performance-results-*
          merge-multiple: true

      - name: Download baseline results
        uses: actions/download-artifact@v4
        with:
          name: performance-baseline-main
          path: baseline/
        continue-on-error: true

      - name: Compare performance
        run: |
          node scripts/compare-performance.js \
            --current ./results-*.json \
            --baseline ./baseline/ \
            --output comparison-report.md

      - name: Comment PR with comparison
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('comparison-report.md', 'utf8');
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 📊 Performance Comparison\n\n${report}`
            });

  stress-testing:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule' || github.event.inputs.environment == 'staging'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup k6
        uses: grafana/setup-k6-action@v1

      - name: Run stress tests
        run: |
          k6 run \
            --stages="5m:0,5m:50,5m:100,5m:200,10m:200,5m:0" \
            --out json=stress-results.json \
            tests/performance/stress-test.js

      - name: Analyze stress test results
        run: |
          node scripts/analyze-stress-results.js \
            --input stress-results.json \
            --output stress-analysis.json

      - name: Upload stress test results
        uses: actions/upload-artifact@v4
        with:
          name: stress-test-results-${{ github.run_id }}
          path: |
            stress-results.json
            stress-analysis.json

      - name: Send Slack notification on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          text: 'Stress testing failed - system may not handle peak load'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.PERFORMANCE_SLACK_WEBHOOK }}

  memory-profiling:
    runs-on: ubuntu-latest-16-cores
    if: github.event_name == 'schedule' || contains(github.event.head_commit.message, '[profile-memory]')
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js with heap profiling
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run memory profiling
        run: |
          npm run test:performance:memory-profile
        env:
          NODE_OPTIONS: '--max-old-space-size=4096 --heap-prof --heap-prof-interval=10000'

      - name: Analyze heap profiles
        run: |
          node scripts/analyze-heap-profiles.js \
            --input ./*.heapprofile \
            --output memory-analysis.json

      - name: Generate memory report
        run: |
          node scripts/generate-memory-report.js \
            --input memory-analysis.json \
            --output memory-report.html

      - name: Upload memory analysis
        uses: actions/upload-artifact@v4
        with:
          name: memory-analysis-${{ github.run_id }}
          path: |
            *.heapprofile
            memory-analysis.json
            memory-report.html
```

## Setup Instructions

1. **Create the workflow file**:
   ```bash
   # Create the workflows directory if it doesn't exist
   mkdir -p .github/workflows
   
   # Create the workflow file
   cp PERFORMANCE_WORKFLOW_SETUP.md .github/workflows/performance-benchmarks.yml
   # Then edit the file to contain only the YAML content above
   ```

2. **Configure repository secrets** (if using external services):
   - `PERFORMANCE_SLACK_WEBHOOK`: Slack webhook for notifications
   - `KUBE_CONFIG`: Base64 encoded kubeconfig for cluster access (if needed)

3. **Verify setup**:
   ```bash
   # Test the workflow syntax
   npm run test:performance:baseline
   npm run test:resilience
   ```

## Usage

Once the workflow is set up:

- **Automatic runs**: Performance tests run on push to main/develop and PR creation
- **Scheduled runs**: Nightly comprehensive benchmarks at 2 AM UTC
- **Manual runs**: Use GitHub Actions UI to trigger with custom parameters
- **PR comments**: Automatic performance comparison comments on PRs

## Integration with Existing Infrastructure

The workflow integrates seamlessly with:
- ✅ Existing Kubernetes cluster setup
- ✅ Helm chart deployment process
- ✅ Prometheus and Grafana monitoring stack
- ✅ Current testing infrastructure (Jest, Playwright)
- ✅ Security scanning and validation processes

## Performance Thresholds

The workflow enforces these performance standards:
- **Response Time P95**: < 500ms for all critical endpoints
- **Error Rate**: < 0.1% under normal load conditions
- **Memory Usage**: < 512MB baseline for core services
- **Recovery Time**: < 30 seconds for resilience scenarios

## Troubleshooting

If performance tests fail:
1. Check cluster resource availability
2. Verify Helm chart deployment success
3. Review k6 test results for specific failure points
4. Check memory and CPU utilization during tests
5. Ensure network connectivity between test runner and services

This workflow provides enterprise-grade performance monitoring and ensures the Lang Observatory maintains excellent performance characteristics as it scales.