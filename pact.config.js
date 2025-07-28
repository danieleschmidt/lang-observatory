const path = require('path')

module.exports = {
  // Consumer configuration
  consumer: 'lang-observatory',
  
  // Provider configuration 
  provider: 'lang-observatory-api',
  
  // Pact file output directory
  dir: path.resolve(process.cwd(), 'pacts'),
  
  // Pact specification version
  spec: 3,
  
  // Log level for Pact
  logLevel: 'INFO',
  
  // Pact Broker configuration
  pactBroker: process.env.PACT_BROKER_BASE_URL || 'http://localhost:9292',
  pactBrokerUsername: process.env.PACT_BROKER_USERNAME,
  pactBrokerPassword: process.env.PACT_BROKER_PASSWORD,
  pactBrokerToken: process.env.PACT_BROKER_TOKEN,
  
  // Consumer version
  consumerVersion: process.env.GIT_COMMIT || process.env.GITHUB_SHA || 'latest',
  
  // Provider version
  providerVersion: process.env.GIT_COMMIT || process.env.GITHUB_SHA || 'latest',
  
  // Git branch for versioning
  branch: process.env.GIT_BRANCH || process.env.GITHUB_REF_NAME || 'main',
  
  // Tags for organizing contracts
  tags: [
    process.env.NODE_ENV || 'development',
    process.env.GIT_BRANCH || process.env.GITHUB_REF_NAME || 'main',
  ],
  
  // Verification configuration
  providerBaseUrl: process.env.PROVIDER_BASE_URL || 'http://localhost:3000',
  
  // State change URL for provider verification
  providerStatesSetupUrl: process.env.PROVIDER_STATES_SETUP_URL || 'http://localhost:3000/pact/provider-states',
  
  // Timeout for verification
  timeout: 30000,
  
  // Publishing configuration
  publishVerificationResult: process.env.CI === 'true',
  
  // Provider version tags
  providerVersionTags: [
    process.env.NODE_ENV || 'development',
    process.env.GIT_BRANCH || process.env.GITHUB_REF_NAME || 'main',
  ],
  
  // Contract verification options
  changeOrigin: true,
  format: 'progress',
  
  // Custom headers for verification
  customProviderHeaders: [
    'Authorization: Bearer ' + (process.env.API_TOKEN || 'test-token'),
  ],
  
  // Pact contract tests directory
  contractsDir: path.resolve(process.cwd(), 'tests/contracts'),
  
  // JUnit output for CI/CD
  reportDir: path.resolve(process.cwd(), 'test-results'),
  reportFormat: 'junit',
  
  // Enable Pact mock server logging
  cors: true,
  host: 'localhost',
  
  // SSL configuration
  ssl: false,
  sslcert: null,
  sslkey: null,
  
  // Verification hooks
  beforeEach: function() {
    // Setup code before each verification
  },
  
  afterEach: function() {
    // Cleanup code after each verification  
  },
}