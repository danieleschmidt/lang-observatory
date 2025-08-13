const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Integration Tests', () => {
  const chartPath = path.join(__dirname, '../../charts/lang-observatory');

  beforeAll(async () => {
    try {
      execSync(`helm dependency update ${chartPath}`, { stdio: 'inherit' });
    } catch (error) {
      console.warn('Warning: Could not update dependencies:', error.message);
    }
  });

  test('Chart dependencies are resolved', () => {
    const chartLockFile = path.join(chartPath, 'Chart.lock');
    const chartsDir = path.join(chartPath, 'charts');

    expect(fs.existsSync(chartLockFile)).toBe(true);
    expect(fs.existsSync(chartsDir)).toBe(true);

    const chartsDirContents = fs.readdirSync(chartsDir);
    expect(chartsDirContents.length).toBeGreaterThan(0);
  });

  test('Rendered manifests are valid Kubernetes resources', () => {
    const output = execSync(`helm template test ${chartPath}`, {
      encoding: 'utf8',
    });

    expect(output).toContain('apiVersion:');
    expect(output).toContain('kind:');
    expect(output).toContain('metadata:');

    expect(output).toContain('kind: Deployment');
    expect(output).toContain('kind: Service');
    expect(output).toContain('kind: ServiceAccount');
  });

  test('Chart can be validated against Kubernetes', () => {
    expect(() => {
      execSync(
        `helm template test ${chartPath} | kubectl apply --dry-run=client -f -`,
        { stdio: 'pipe' }
      );
    }).not.toThrow();
  });

  test('All required labels are present', () => {
    const output = execSync(`helm template test ${chartPath}`, {
      encoding: 'utf8',
    });

    expect(output).toContain('app.kubernetes.io/name');
    expect(output).toContain('app.kubernetes.io/instance');
    expect(output).toContain('app.kubernetes.io/version');
    expect(output).toContain('app.kubernetes.io/managed-by');
  });
});
