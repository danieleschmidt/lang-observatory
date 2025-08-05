# Testing Guide for Lang Observatory

## Overview

Lang Observatory uses a comprehensive testing strategy that covers unit,
integration, end-to-end, performance, and security testing across multiple
languages and frameworks.

## Testing Stack

### JavaScript/Node.js Testing

- **Jest**: Primary test runner for JavaScript/Node.js tests
- **Playwright**: End-to-end browser testing
- **Stryker**: Mutation testing for test quality
- **k6**: Performance and load testing
- **Pact**: Contract testing for APIs

### Python Testing

- **pytest**: Primary test runner for Python tests
- **pytest-asyncio**: Async testing support
- **pytest-cov**: Code coverage reporting
- **locust**: Load testing framework
- **bandit**: Security testing

### Infrastructure Testing

- **Helm**: Chart testing and validation
- **kubectl**: Kubernetes resource validation
- **Trivy**: Security scanning
- **Kubesec**: Kubernetes security analysis

## Test Types and Structure

```
tests/
├── unit/                 # Unit tests (Jest)
├── integration/          # Integration tests (Jest)
├── e2e/                  # End-to-end tests (Playwright)
├── performance/          # Performance tests (k6)
├── contracts/            # Contract tests (Pact)
├── chaos/               # Chaos engineering tests
├── python/              # Python tests (pytest)
│   ├── unit/           # Python unit tests
│   ├── integration/    # Python integration tests
│   ├── e2e/            # Python E2E tests
│   ├── performance/    # Python performance tests
│   └── fixtures/       # Test data and fixtures
└── security/            # Security tests
```

## Running Tests

### All Tests

```bash
# Run complete test suite
npm test

# Run with coverage
npm run test -- --coverage

# Run tests in watch mode
npm run test -- --watch
```

### Unit Tests

```bash
# JavaScript unit tests
npm run test:unit

# Python unit tests
pytest tests/python/unit/ -v

# Run specific test file
npm run test:unit -- tests/unit/chart.test.js
pytest tests/python/unit/test_langfuse_integration.py -v
```

### Integration Tests

```bash
# Start development stack first
docker-compose -f docker-compose.dev.yml up -d

# JavaScript integration tests
npm run test:integration

# Python integration tests
pytest tests/python/integration/ -v -m integration
```

### End-to-End Tests

```bash
# Playwright E2E tests
npm run test:playwright

# Python E2E tests
pytest tests/python/e2e/ -v -m e2e

# Run E2E with specific browser
npx playwright test --project=chromium
```

### Performance Tests

```bash
# k6 load tests
npm run test:performance

# Python load tests with locust
pytest tests/python/performance/ -v -m performance

# Memory usage testing
npm run test:performance:memory-usage
```

### Security Tests

```bash
# Security scanning
npm run security:scan

# Python security tests
bandit -r src/ -f json -o reports/bandit-report.json
```

### Mutation Testing

```bash
# Run mutation tests
npm run test:mutation

# Generate mutation report
stryker run --reporters html,json
```

## Test Configuration

### Jest Configuration

Located in `jest.config.js`, supports:

- Multiple test projects (unit, integration, e2e)
- Coverage thresholds per project type
- Custom reporters (JUnit XML, HTML, JSON)
- Parallel test execution

### Pytest Configuration

Located in `pytest.ini`, includes:

- Comprehensive markers for test categorization
- Coverage reporting in multiple formats
- Logging configuration for debugging
- Test timeouts and parallel execution

### Playwright Configuration

Located in `playwright.config.js`, provides:

- Multi-browser testing (Chrome, Firefox, Safari)
- Mobile device emulation
- Screenshot and video capture on failure
- Automatic web server management

## Test Markers and Categories

### Python Test Markers

```python
@pytest.mark.unit          # Unit tests
@pytest.mark.integration   # Integration tests
@pytest.mark.e2e          # End-to-end tests
@pytest.mark.performance  # Performance tests
@pytest.mark.slow         # Long-running tests
@pytest.mark.security     # Security tests
@pytest.mark.llm          # LLM-specific tests
@pytest.mark.observability # Observability tests
@pytest.mark.kubernetes   # Kubernetes tests
@pytest.mark.docker       # Docker tests
```

### Running Tests by Marker

```bash
# Run only unit tests
pytest -m unit

# Run integration and e2e tests
pytest -m "integration or e2e"

# Skip slow tests
pytest -m "not slow"

# Run LLM-specific tests
pytest -m llm
```

## Test Data and Fixtures

### Shared Fixtures

Located in `tests/python/conftest.py`:

- Mock clients for Langfuse, OpenLIT, Kubernetes
- Sample data for traces, metrics, configurations
- Temporary directories and files
- Performance timing utilities

### Test Data Files

```
tests/fixtures/
├── traces/              # Sample trace data
├── metrics/             # Sample metrics data
├── configs/             # Test configurations
├── helm-values/         # Test Helm values
└── kubernetes/          # Test K8s manifests
```

## Continuous Integration

### Pre-commit Hooks

```bash
# Install pre-commit hooks
pre-commit install

# Run hooks manually
pre-commit run --all-files
```

### CI Pipeline Tests

The CI pipeline runs:

1. **Linting**: ESLint, Pylint, Helm lint
2. **Unit Tests**: Jest and pytest unit tests
3. **Integration Tests**: With real services
4. **Security Scanning**: Trivy, Bandit, Kubesec
5. **Performance Tests**: Basic load testing
6. **Mutation Testing**: Code quality validation

## Test Development Guidelines

### Writing Unit Tests

```javascript
// Jest unit test example
describe('ChartValidator', () => {
  test('should validate valid Helm chart', () => {
    const validator = new ChartValidator();
    const result = validator.validate(validChart);
    expect(result.isValid).toBe(true);
  });
});
```

```python
# pytest unit test example
class TestLangfuseIntegration:
    def test_trace_creation(self, mock_langfuse_client):
        trace = mock_langfuse_client.trace(name="test")
        assert trace is not None
```

### Writing Integration Tests

```javascript
// Integration test with real services
describe('Langfuse Integration', () => {
  beforeAll(async () => {
    // Wait for services to be ready
    await waitForServices(['langfuse', 'prometheus']);
  });

  test('should create trace and retrieve metrics', async () => {
    // Test actual integration
  });
});
```

### Writing E2E Tests

```javascript
// Playwright E2E test
test('dashboard displays LLM metrics', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('[data-testid="llm-metrics"]')).toBeVisible();
});
```

## Performance Testing

### Load Testing with k6

```javascript
// k6 load test script
import http from 'k6/http';

export default function () {
  const response = http.get('http://localhost:3000/api/traces');
  check(response, {
    'status is 200': r => r.status === 200,
    'response time < 500ms': r => r.timings.duration < 500,
  });
}
```

### Memory Testing

```bash
# Monitor memory usage during tests
npm run test:performance:memory-profile
```

## Debugging Tests

### Debug Configuration

VS Code launch configurations in `.vscode/launch.json`:

- Debug Jest tests
- Debug Playwright tests
- Debug Python tests
- Attach to running processes

### Test Debugging Tips

```bash
# Run single test with verbose output
npm run test -- tests/unit/specific.test.js --verbose

# Debug Python test with pdb
pytest tests/python/unit/test_file.py::test_function -s --pdb

# Run Playwright in headed mode
npx playwright test --headed
```

## Code Coverage

### Coverage Requirements

- **Unit tests**: 85% coverage minimum
- **Integration tests**: 70% coverage minimum
- **Overall project**: 80% coverage minimum

### Coverage Reports

```bash
# Generate coverage reports
npm run test -- --coverage
pytest --cov=src --cov-report=html

# View coverage reports
open coverage/lcov-report/index.html
open coverage/python/index.html
```

## Test Data Management

### Fixtures and Mocks

- Use consistent test data across test suites
- Mock external services for unit tests
- Use real services for integration tests
- Implement data cleanup for E2E tests

### Environment Variables

```bash
# Test environment variables
NODE_ENV=test
TESTING=true
LOG_LEVEL=DEBUG
LANGFUSE_HOST=http://localhost:3000
PROMETHEUS_URL=http://localhost:9090
```

## Troubleshooting Tests

### Common Issues

1. **Services not ready**: Ensure development stack is running
2. **Port conflicts**: Check for conflicting services
3. **Timeout issues**: Increase test timeouts for slow operations
4. **Flaky tests**: Add proper waits and assertions

### Test Logs

```bash
# View test logs
cat logs/pytest.log
npm run test -- --verbose
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clear Naming**: Use descriptive test names
3. **Single Responsibility**: One assertion per test when possible
4. **Mock External Dependencies**: Use mocks for external services in unit tests
5. **Test Edge Cases**: Include error conditions and boundary cases
6. **Performance Awareness**: Set appropriate timeouts and resource limits
7. **Documentation**: Document complex test scenarios
8. **Continuous Maintenance**: Regularly update and refactor tests

## Contributing to Tests

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines on:

- Adding new test cases
- Updating test configurations
- Creating test fixtures
- Reporting test-related issues
