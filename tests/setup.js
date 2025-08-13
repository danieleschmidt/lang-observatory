const { execSync } = require('child_process');

beforeAll(async () => {
  console.log('Setting up test environment...');

  try {
    execSync(
      'helm repo add prometheus-community https://prometheus-community.github.io/helm-charts',
      { stdio: 'inherit' }
    );
    execSync('helm repo add grafana https://grafana.github.io/helm-charts', {
      stdio: 'inherit',
    });
    execSync('helm repo update', { stdio: 'inherit' });
  } catch (error) {
    console.warn('Warning: Could not update helm repositories:', error.message);
  }
});

afterAll(async () => {
  console.log('Cleaning up test environment...');
});

global.testTimeout = 30000;
