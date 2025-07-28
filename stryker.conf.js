module.exports = {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress', 'json'],
  testRunner: 'jest',
  testFramework: 'jest',
  coverageAnalysis: 'perTest',
  mutate: [
    'scripts/**/*.js',
    'tests/unit/**/*.js',
    '!tests/**/*.test.js',
    '!tests/**/*.spec.js',
    '!node_modules/**/*',
    '!coverage/**/*',
    '!test-results/**/*',
    '!charts/*/charts/**/*',
  ],
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  timeoutMS: 60000,
  maxConcurrentTestRunners: 2,
  tempDirName: 'stryker-tmp',
  cleanTempDir: true,
  logLevel: 'info',
  fileLogLevel: 'trace',
  plugins: [
    '@stryker-mutator/core',
    '@stryker-mutator/jest-runner',
    '@stryker-mutator/html-reporter',
  ],
  jest: {
    projectType: 'custom',
    configFile: 'jest.config.js',
    enableFindRelatedTests: true,
  },
  htmlReporter: {
    baseDir: 'reports/mutation',
  },
  jsonReporter: {
    fileName: 'reports/mutation/mutation-report.json',
  },
  dashboard: {
    project: 'github.com/terragon-labs/lang-observatory',
    version: process.env.GITHUB_REF_NAME || 'main',
    module: 'lang-observatory',
  },
}