const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

describe('Helm Chart Tests', () => {
  const chartPath = path.join(__dirname, '../../charts/lang-observatory');

  test('Chart.yaml is valid', () => {
    const chartFile = path.join(chartPath, 'Chart.yaml');
    expect(fs.existsSync(chartFile)).toBe(true);

    const chartContent = fs.readFileSync(chartFile, 'utf8');
    const chart = yaml.load(chartContent);

    expect(chart.name).toBe('lang-observatory');
    expect(chart.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(chart.description).toBeDefined();
    expect(chart.dependencies).toBeDefined();
  });

  test('values.yaml is valid', () => {
    const valuesFile = path.join(chartPath, 'values.yaml');
    expect(fs.existsSync(valuesFile)).toBe(true);

    const valuesContent = fs.readFileSync(valuesFile, 'utf8');
    const values = yaml.load(valuesContent);

    expect(values).toBeDefined();
    expect(typeof values).toBe('object');
  });

  test('Helm lint passes', () => {
    expect(() => {
      execSync(`helm lint ${chartPath}`, { stdio: 'pipe' });
    }).not.toThrow();
  });

  test('Helm template renders without errors', () => {
    expect(() => {
      execSync(`helm template test ${chartPath}`, { stdio: 'pipe' });
    }).not.toThrow();
  });

  test('Required templates exist', () => {
    const templatesDir = path.join(chartPath, 'templates');
    const requiredTemplates = [
      'langfuse-deployment.yaml',
      'langfuse-service.yaml',
      'openlit-deployment.yaml',
      'openlit-service.yaml',
      'serviceaccount.yaml',
    ];

    requiredTemplates.forEach(template => {
      const templatePath = path.join(templatesDir, template);
      expect(fs.existsSync(templatePath)).toBe(true);
    });
  });
});
