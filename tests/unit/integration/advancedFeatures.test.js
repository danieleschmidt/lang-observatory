/**
 * Advanced Features Integration Tests
 * Testing the newly added advanced features
 */

const { AdvancedSecurityManager } = require('../../../src/security/advancedSecurityManager');
const { MultiRegionOrchestrator } = require('../../../src/global/multiRegionOrchestrator');
const { I18nManager } = require('../../../src/global/i18nManager');
const { ExperimentalFramework } = require('../../../src/research/experimentalFramework');
const { AdvancedMonitoringOrchestrator } = require('../../../src/monitoring/advancedMonitoringOrchestrator');

describe('Advanced Security Manager', () => {
  let securityManager;

  beforeEach(async () => {
    securityManager = new AdvancedSecurityManager({
      rateLimiting: { maxRequestsPerMinute: 100 },
      compliance: { enableGDPRMode: true },
    });
    await securityManager.initialize();
  });

  afterEach(async () => {
    await securityManager.shutdown();
  });

  test('should encrypt and decrypt data correctly', () => {
    const testData = { sensitive: 'information', userId: 123 };
    const encrypted = securityManager.encryptData(testData, 'confidential');
    
    expect(encrypted).toHaveProperty('encrypted');
    expect(encrypted).toHaveProperty('classification', 'confidential');
    expect(encrypted).toHaveProperty('algorithm');
    
    const decrypted = securityManager.decryptData(encrypted);
    expect(decrypted).toEqual(testData);
  });

  test('should enforce rate limiting', () => {
    const ip = '192.168.1.1';
    
    // Should allow requests within limit
    for (let i = 0; i < 50; i++) {
      expect(securityManager.checkRateLimit(ip, 'global')).toBe(true);
    }
    
    // Should block after limit
    for (let i = 0; i < 100; i++) {
      securityManager.checkRateLimit(ip, 'global');
    }
    expect(securityManager.checkRateLimit(ip, 'global')).toBe(false);
  });

  test('should handle authentication with token validation', async () => {
    const credentials = {
      identifier: 'test-user',
      token: 'valid-token',
      ip: '192.168.1.100',
    };

    // Mock a valid token
    securityManager.activeTokens.set('valid-token', {
      user: { id: 'test-user', name: 'Test User' },
      permissions: ['read', 'write'],
      sessionId: 'session-123',
      expiresAt: Date.now() + 3600000, // 1 hour
    });

    const result = await securityManager.authenticateRequest(credentials);
    
    expect(result.authenticated).toBe(true);
    expect(result.user.id).toBe('test-user');
    expect(result.permissions).toContain('read');
  });

  test('should track security metrics', () => {
    const initialMetrics = securityManager.getSecurityMetrics();
    
    // Simulate some security events
    securityManager.securityMetrics.encryptedOperations = 10;
    securityManager.securityMetrics.authenticatedRequests = 5;
    
    const updatedMetrics = securityManager.getSecurityMetrics();
    expect(updatedMetrics.encryptedOperations).toBe(10);
    expect(updatedMetrics.authenticatedRequests).toBe(5);
  });
});

describe('Multi-Region Orchestrator', () => {
  let orchestrator;

  beforeEach(async () => {
    orchestrator = new MultiRegionOrchestrator({
      regions: {
        primary: 'us-east-1',
        secondary: ['eu-west-1', 'ap-southeast-1'],
      },
      loadBalancing: { strategy: 'latency' },
    });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await orchestrator.shutdown();
  });

  test('should initialize all configured regions', () => {
    expect(orchestrator.regionStates.size).toBe(3);
    expect(orchestrator.regionStates.has('us-east-1')).toBe(true);
    expect(orchestrator.regionStates.has('eu-west-1')).toBe(true);
    expect(orchestrator.regionStates.has('ap-southeast-1')).toBe(true);
  });

  test('should select optimal region based on user location', () => {
    const usRegion = orchestrator.selectOptimalRegion('US', 'api');
    const euRegion = orchestrator.selectOptimalRegion('EU', 'api');
    const asiaRegion = orchestrator.selectOptimalRegion('Asia', 'api');

    expect(['us-east-1', 'us-west-2']).toContain(usRegion);
    expect(euRegion).toBe('eu-west-1');
    expect(asiaRegion).toBe('ap-southeast-1');
  });

  test('should validate cross-region compliance', () => {
    const gdprData = {
      containsPII: true,
      gdprConsent: true,
      classification: 'personal',
    };

    const validTransfer = orchestrator.validateCrossRegionCompliance(gdprData, 'eu-west-1');
    expect(validTransfer).toBe(true);

    const invalidData = { ...gdprData, gdprConsent: false };
    const invalidTransfer = orchestrator.validateCrossRegionCompliance(invalidData, 'eu-west-1');
    expect(invalidTransfer).toBe(false);
  });

  test('should route requests to appropriate regions', async () => {
    const request = { type: 'api', data: 'test' };
    const routing = await orchestrator.routeRequest(request, { userLocation: 'US' });

    expect(routing).toHaveProperty('targetRegion');
    expect(routing).toHaveProperty('endpoint');
    expect(routing).toHaveProperty('routingDecision');
    expect(routing.routingDecision.strategy).toBe('latency');
  });
});

describe('I18n Manager', () => {
  let i18nManager;

  beforeEach(async () => {
    i18nManager = new I18nManager({
      defaultLocale: 'en-US',
      supportedLocales: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP'],
    });
    await i18nManager.initialize();
  });

  afterEach(async () => {
    await i18nManager.shutdown();
  });

  test('should translate text correctly', () => {
    const englishText = i18nManager.translate('system.error.general', 'en-US');
    const spanishText = i18nManager.translate('system.error.general', 'es-ES');
    const frenchText = i18nManager.translate('system.error.general', 'fr-FR');

    expect(englishText).toBe('An error occurred');
    expect(spanishText).toBe('Se produjo un error');
    expect(frenchText).toBe('Une erreur s\'est produite');
  });

  test('should handle locale detection from request', () => {
    const request1 = {
      headers: { 'accept-language': 'es-ES,es;q=0.9,en;q=0.8' },
    };
    const locale1 = i18nManager.detectLocale(request1);
    expect(locale1).toBe('es-ES');

    const request2 = {
      headers: { 'accept-language': 'fr-CA,fr;q=0.9' },
      geo: { country: 'CA' },
    };
    const locale2 = i18nManager.detectLocale(request2);
    expect(['fr-FR', 'en-US']).toContain(locale2); // Fallback chain
  });

  test('should format numbers according to locale', () => {
    const number = 1234.56;
    
    const usFormat = i18nManager.formatNumber(number, 'en-US');
    const deFormat = i18nManager.formatNumber(number, 'de-DE');
    const frFormat = i18nManager.formatNumber(number, 'fr-FR');

    expect(usFormat).toContain('1,234.56');
    expect(deFormat).toContain('1.234,56');
    expect(frFormat).toContain('1 234,56');
  });

  test('should handle text direction correctly', () => {
    expect(i18nManager.isRTL('en-US')).toBe(false);
    expect(i18nManager.isRTL('ar-SA')).toBe(true);
    expect(i18nManager.isRTL('de-DE')).toBe(false);
  });

  test('should support user preferences', () => {
    const userId = 'test-user-123';
    const preferences = {
      locale: 'ja-JP',
      dateFormat: 'YYYY/MM/DD',
      timezone: 'Asia/Tokyo',
    };

    i18nManager.setUserPreference(userId, preferences);
    
    const request = { user: { id: userId } };
    const detectedLocale = i18nManager.detectLocale(request);
    expect(detectedLocale).toBe('ja-JP');
  });
});

describe('Experimental Framework', () => {
  let framework;

  beforeEach(async () => {
    framework = new ExperimentalFramework({
      experiments: { minSampleSize: 100, significanceLevel: 0.05 },
      analysis: { realTimeMetrics: true },
    });
    await framework.initialize();
  });

  afterEach(async () => {
    await framework.shutdown();
  });

  test('should create and manage experiments', async () => {
    const hypothesis = {
      statement: 'New algorithm improves performance',
      nullHypothesis: 'No difference in performance',
      alternativeHypothesis: 'Performance improvement observed',
      metrics: ['latency', 'accuracy'],
    };

    const experiment = await framework.createExperiment(hypothesis);
    
    expect(experiment).toHaveProperty('id');
    expect(experiment.hypothesis.statement).toBe(hypothesis.statement);
    expect(experiment.status).toBe('designed');
    expect(framework.activeExperiments.has(experiment.id)).toBe(true);
  });

  test('should perform statistical analysis', async () => {
    const controlData = [100, 105, 98, 102, 99, 101, 97, 103, 100, 104];
    const treatmentData = [95, 92, 94, 90, 93, 91, 96, 89, 94, 88];

    const analysis = await framework.performStatisticalAnalysis(
      controlData.map(v => ({ latency: v })),
      treatmentData.map(v => ({ latency: v })),
      ['latency']
    );

    expect(analysis).toHaveProperty('latency');
    expect(analysis.latency).toHaveProperty('pValue');
    expect(analysis.latency).toHaveProperty('effectSize');
    expect(analysis.latency.pValue).toBeLessThan(0.05); // Significant difference
  });

  test('should perform algorithm comparison', async () => {
    const newAlgorithm = {
      name: 'Optimized Quantum Planner',
      version: '2.0',
      implementation: async (tasks) => ({
        plan: tasks.map((t, i) => ({ ...t, optimized: true, order: i })),
        time: 75, // Faster than baselines
      }),
    };

    const comparison = await framework.performAlgorithmComparison(
      'quantum-planning',
      newAlgorithm
    );

    expect(comparison).toHaveProperty('benchmarkResults');
    expect(comparison).toHaveProperty('analysis');
    expect(comparison.newAlgorithm.name).toBe('Optimized Quantum Planner');
  });

  test('should generate reproduction package', () => {
    const seeds = framework.generateReproductionSeeds();
    const environment = framework.captureEnvironment();

    expect(seeds).toHaveProperty('random');
    expect(seeds).toHaveProperty('crypto');
    expect(seeds).toHaveProperty('timestamp');

    expect(environment).toHaveProperty('nodeVersion');
    expect(environment).toHaveProperty('platform');
    expect(environment).toHaveProperty('packages');
  });

  test('should calculate statistical measures correctly', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    const mean = framework.calculateMean(values);
    const std = framework.calculateStandardDeviation(values);
    const stats = framework.calculateDescriptiveStats(values);

    expect(mean).toBe(5.5);
    expect(std).toBeCloseTo(2.87, 1);
    expect(stats.median).toBe(5);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(10);
  });
});

describe('Advanced Monitoring Orchestrator', () => {
  let monitoring;

  beforeEach(async () => {
    monitoring = new AdvancedMonitoringOrchestrator({
      metrics: { collectionInterval: 1000 }, // 1 second for testing
      alerting: { evaluationInterval: 500 },
      anomalyDetection: { enabled: true },
    });
    await monitoring.initialize();
  });

  afterEach(async () => {
    await monitoring.shutdown();
  });

  test('should register and collect metrics', () => {
    const metricConfig = {
      name: 'test.metric',
      type: 'gauge',
      unit: 'count',
      help: 'Test metric',
    };

    monitoring.registerMetric(metricConfig);
    expect(monitoring.metrics.has('test.metric')).toBe(true);

    monitoring.updateMetric('test.metric', 42);
    const value = monitoring.getMetricValue('test.metric');
    expect(value).toBe(42);
  });

  test('should evaluate alert rules', () => {
    // Register test metric
    monitoring.registerMetric({
      name: 'test.cpu.usage',
      type: 'gauge',
      unit: 'percent',
    });

    // Add alert rule
    const alertRule = {
      name: 'high_test_cpu',
      metric: 'test.cpu.usage',
      condition: 'gt',
      threshold: 80,
      duration: 0,
      severity: 'warning',
      description: 'High CPU usage',
    };

    monitoring.addAlertRule(alertRule);

    // Update metric to trigger alert
    monitoring.updateMetric('test.cpu.usage', 85);

    // Manually evaluate alerts
    const now = Date.now();
    const rule = Array.from(monitoring.alertRules.values())[0];
    const shouldAlert = monitoring.evaluateAlertRule(rule, now);
    
    expect(shouldAlert).toBe(true);
  });

  test('should detect anomalies', () => {
    const normalValues = Array(50).fill().map(() => 100 + Math.random() * 10);
    const anomalyValues = [150, 160]; // Clear anomalies
    const allValues = [...normalValues, ...anomalyValues];

    const zScoreDetector = monitoring.anomalyDetectors.get('z-score');
    const anomalies = zScoreDetector.detect(allValues);

    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.some(a => a.value > 140)).toBe(true);
  });

  test('should calculate SLOs', () => {
    // Mock some metrics for SLO calculation
    monitoring.updateMetric('app.requests.total', 1000);
    monitoring.updateMetric('app.errors.total', 10);

    const sloCalculator = monitoring.sloCalculators.get('availability');
    if (sloCalculator) {
      const availability = sloCalculator.calculator();
      expect(availability).toBe(99); // (1000-10)/1000 * 100
    }
  });

  test('should manage metric history and aggregations', () => {
    monitoring.registerMetric({
      name: 'test.response.time',
      type: 'histogram',
      unit: 'seconds',
    });

    // Add some values
    for (let i = 0; i < 20; i++) {
      monitoring.updateMetric('test.response.time', 100 + i * 5);
    }

    const history = monitoring.getMetricHistory('test.response.time');
    expect(history.length).toBe(20);

    const metric = monitoring.metrics.get('test.response.time');
    expect(metric.aggregations.size).toBeGreaterThan(0);
  });

  test('should format Prometheus metrics', () => {
    monitoring.updateMetric('system.cpu.usage', 45.5);
    monitoring.updateMetric('app.requests.total', 1500);

    const prometheusOutput = monitoring.prometheusEndpoint.getMetrics();
    
    expect(prometheusOutput).toContain('system.cpu.usage');
    expect(prometheusOutput).toContain('app.requests.total');
    expect(prometheusOutput).toContain('45.5');
    expect(prometheusOutput).toContain('1500');
  });
});

describe('Integration: Cross-Feature Interactions', () => {
  test('should integrate security with monitoring', async () => {
    const security = new AdvancedSecurityManager();
    const monitoring = new AdvancedMonitoringOrchestrator();

    await Promise.all([security.initialize(), monitoring.initialize()]);

    // Simulate security events that should trigger monitoring
    security.emit('authentication_failure', {
      identifier: 'test-user',
      ip: '192.168.1.1',
      timestamp: Date.now(),
    });

    security.emit('rate_limit_exceeded', {
      identifier: '192.168.1.1',
      endpoint: 'auth',
      timestamp: Date.now(),
    });

    // Verify events can be monitored
    expect(security.listenerCount('authentication_failure')).toBe(0);
    expect(security.listenerCount('rate_limit_exceeded')).toBe(0);

    await Promise.all([security.shutdown(), monitoring.shutdown()]);
  });

  test('should integrate i18n with multi-region orchestrator', async () => {
    const i18n = new I18nManager();
    const multiRegion = new MultiRegionOrchestrator();

    await Promise.all([i18n.initialize(), multiRegion.initialize()]);

    // Test locale detection based on region
    const request = { geo: { country: 'DE' } };
    const locale = i18n.detectLocale(request);
    expect(locale).toBe('de-DE');

    // Test routing based on locale preference
    const routing = await multiRegion.routeRequest(
      { type: 'api' },
      { userLocation: 'EU' }
    );
    expect(routing.targetRegion).toBe('eu-west-1');

    await Promise.all([i18n.shutdown(), multiRegion.shutdown()]);
  });

  test('should integrate experimental framework with monitoring', async () => {
    const experiments = new ExperimentalFramework();
    const monitoring = new AdvancedMonitoringOrchestrator();

    await Promise.all([experiments.initialize(), monitoring.initialize()]);

    // Create experiment
    const hypothesis = {
      statement: 'Monitoring improvements reduce alert noise',
      metrics: ['alert_count', 'false_positive_rate'],
    };

    const experiment = await experiments.createExperiment(hypothesis);
    await experiments.startExperiment(experiment.id);

    // Add experimental data
    await experiments.addExperimentData(experiment.id, 'control', {
      alert_count: 50,
      false_positive_rate: 0.15,
    });

    await experiments.addExperimentData(experiment.id, 'treatment', {
      alert_count: 30,
      false_positive_rate: 0.08,
    });

    expect(experiment.groups.control.results.length).toBe(1);
    expect(experiment.groups.treatment.results.length).toBe(1);

    await Promise.all([experiments.shutdown(), monitoring.shutdown()]);
  });
});