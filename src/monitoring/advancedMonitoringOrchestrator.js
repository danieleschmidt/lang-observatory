/**
 * Advanced Monitoring Orchestrator
 * Comprehensive monitoring, alerting, and observability orchestration
 */

const { EventEmitter } = require('events');
const { Logger } = require('../utils/logger');

class AdvancedMonitoringOrchestrator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = new Logger({ component: 'AdvancedMonitoringOrchestrator' });
    this.config = {
      metrics: {
        collectionInterval: 30000, // 30 seconds
        retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
        aggregationWindows: [60, 300, 900, 3600], // 1min, 5min, 15min, 1hour
        highCardinalityLimit: 10000,
        ...config.metrics,
      },
      alerting: {
        evaluationInterval: 60000, // 1 minute
        maxAlertsPerHour: 50,
        escalationLevels: ['info', 'warning', 'critical', 'emergency'],
        suppressionTime: 300000, // 5 minutes
        ...config.alerting,
      },
      anomalyDetection: {
        enabled: true,
        algorithms: ['z-score', 'isolation-forest', 'seasonal-decompose'],
        sensitivity: 0.95, // 95% confidence
        seasonalityPeriod: 24 * 60 * 60 * 1000, // 24 hours
        ...config.anomalyDetection,
      },
      performance: {
        sloTargets: {
          availability: 99.9, // 99.9%
          latency_p95: 500, // 500ms
          latency_p99: 1000, // 1000ms
          error_rate: 0.1, // 0.1%
        },
        burnRateWindows: [60, 300, 3600], // 1min, 5min, 1hour
        ...config.performance,
      },
      integrations: {
        prometheus: { enabled: true, port: 9090 },
        grafana: { enabled: true, port: 3000 },
        alertmanager: { enabled: true, port: 9093 },
        jaeger: { enabled: true, port: 14268 },
        elasticsearch: { enabled: false },
        slack: { enabled: false, webhook: null },
        pagerduty: { enabled: false, apiKey: null },
        ...config.integrations,
      },
      ...config,
    };

    // Monitoring state
    this.metrics = new Map();
    this.metricHistory = new Map();
    this.alertRules = new Map();
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.anomalyDetectors = new Map();
    this.sloCalculators = new Map();

    // Performance tracking
    this.performanceMetrics = {
      totalMetricsCollected: 0,
      alertsTriggered: 0,
      anomaliesDetected: 0,
      sloViolations: 0,
      systemHealth: 1.0,
      lastHealthCheck: Date.now(),
    };

    // Monitoring intervals
    this.intervals = new Map();

    this.initialized = false;
  }

  async initialize() {
    this.logger.info('Initializing Advanced Monitoring Orchestrator...');

    // Initialize metric collection
    await this.initializeMetricCollection();

    // Setup alerting system
    await this.setupAlertingSystem();

    // Initialize anomaly detection
    await this.initializeAnomalyDetection();

    // Setup SLO monitoring
    await this.setupSLOMonitoring();

    // Configure integrations
    await this.configureIntegrations();

    // Start monitoring loops
    this.startMonitoringLoops();

    this.initialized = true;
    this.logger.info('Advanced Monitoring Orchestrator initialized successfully');

    return this;
  }

  async initializeMetricCollection() {
    // Define core metrics to collect
    const coreMetrics = [
      // System metrics
      { name: 'system.cpu.usage', type: 'gauge', unit: 'percent' },
      { name: 'system.memory.usage', type: 'gauge', unit: 'bytes' },
      { name: 'system.disk.usage', type: 'gauge', unit: 'bytes' },
      { name: 'system.network.bytes_in', type: 'counter', unit: 'bytes' },
      { name: 'system.network.bytes_out', type: 'counter', unit: 'bytes' },

      // Application metrics
      { name: 'app.requests.total', type: 'counter', unit: 'requests' },
      { name: 'app.requests.duration', type: 'histogram', unit: 'seconds' },
      { name: 'app.errors.total', type: 'counter', unit: 'errors' },
      { name: 'app.active_connections', type: 'gauge', unit: 'connections' },

      // LLM-specific metrics
      { name: 'llm.calls.total', type: 'counter', unit: 'calls' },
      { name: 'llm.calls.duration', type: 'histogram', unit: 'seconds' },
      { name: 'llm.tokens.total', type: 'counter', unit: 'tokens' },
      { name: 'llm.cost.total', type: 'counter', unit: 'dollars' },
      { name: 'llm.errors.total', type: 'counter', unit: 'errors' },

      // Quantum metrics
      { name: 'quantum.tasks.planned', type: 'counter', unit: 'tasks' },
      { name: 'quantum.planning.duration', type: 'histogram', unit: 'seconds' },
      { name: 'quantum.efficiency.score', type: 'gauge', unit: 'ratio' },

      // Neuromorphic metrics
      { name: 'neuromorphic.processing.duration', type: 'histogram', unit: 'seconds' },
      { name: 'neuromorphic.patterns.detected', type: 'counter', unit: 'patterns' },
      { name: 'neuromorphic.adaptation.rate', type: 'gauge', unit: 'ratio' },

      // Reliability metrics
      { name: 'reliability.circuit_breaker.state', type: 'gauge', unit: 'state' },
      { name: 'reliability.retries.total', type: 'counter', unit: 'retries' },
      { name: 'reliability.fallbacks.total', type: 'counter', unit: 'fallbacks' },

      // Security metrics
      { name: 'security.auth.attempts', type: 'counter', unit: 'attempts' },
      { name: 'security.auth.failures', type: 'counter', unit: 'failures' },
      { name: 'security.rate_limit.violations', type: 'counter', unit: 'violations' },
    ];

    for (const metric of coreMetrics) {
      this.registerMetric(metric);
    }

    this.logger.info(`Registered ${coreMetrics.length} core metrics for collection`);
  }

  registerMetric(metricConfig) {
    const { name, type, unit, help, labels = [] } = metricConfig;
    
    this.metrics.set(name, {
      name,
      type,
      unit,
      help: help || `${name} metric`,
      labels,
      values: new Map(),
      lastUpdated: Date.now(),
      aggregations: new Map(),
    });

    // Initialize history
    this.metricHistory.set(name, []);
  }

  async setupAlertingSystem() {
    // Define default alert rules
    const defaultAlertRules = [
      {
        name: 'high_cpu_usage',
        metric: 'system.cpu.usage',
        condition: 'gt',
        threshold: 80,
        duration: 300000, // 5 minutes
        severity: 'warning',
        description: 'High CPU usage detected',
      },
      {
        name: 'high_memory_usage',
        metric: 'system.memory.usage',
        condition: 'gt',
        threshold: 85,
        duration: 300000,
        severity: 'warning',
        description: 'High memory usage detected',
      },
      {
        name: 'high_error_rate',
        metric: 'app.errors.total',
        condition: 'rate_gt',
        threshold: 0.05, // 5% error rate
        duration: 60000, // 1 minute
        severity: 'critical',
        description: 'High error rate detected',
      },
      {
        name: 'llm_cost_spike',
        metric: 'llm.cost.total',
        condition: 'rate_gt',
        threshold: 10, // $10/hour
        duration: 3600000, // 1 hour
        severity: 'warning',
        description: 'LLM cost spike detected',
      },
      {
        name: 'quantum_planning_failure',
        metric: 'quantum.efficiency.score',
        condition: 'lt',
        threshold: 0.5,
        duration: 180000, // 3 minutes
        severity: 'warning',
        description: 'Quantum planning efficiency degraded',
      },
      {
        name: 'circuit_breaker_open',
        metric: 'reliability.circuit_breaker.state',
        condition: 'eq',
        threshold: 2, // OPEN state
        duration: 0, // Immediate
        severity: 'critical',
        description: 'Circuit breaker opened',
      },
      {
        name: 'auth_failure_spike',
        metric: 'security.auth.failures',
        condition: 'rate_gt',
        threshold: 10, // 10 failures per minute
        duration: 60000,
        severity: 'critical',
        description: 'Authentication failure spike detected',
      },
    ];

    for (const rule of defaultAlertRules) {
      this.addAlertRule(rule);
    }

    this.logger.info(`Configured ${defaultAlertRules.length} default alert rules`);
  }

  addAlertRule(rule) {
    const alertRule = {
      ...rule,
      id: `${rule.name}_${Date.now()}`,
      enabled: true,
      lastEvaluated: 0,
      triggerCount: 0,
      createdAt: Date.now(),
    };

    this.alertRules.set(alertRule.id, alertRule);
    this.logger.info(`Added alert rule: ${rule.name}`);
  }

  async initializeAnomalyDetection() {
    if (!this.config.anomalyDetection.enabled) return;

    // Z-score anomaly detector
    this.anomalyDetectors.set('z-score', {
      name: 'Z-Score Anomaly Detection',
      detect: (values, threshold = 3) => {
        if (values.length < 10) return []; // Need at least 10 data points

        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const std = Math.sqrt(
          values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
        );

        return values.map((value, index) => {
          const zScore = Math.abs((value - mean) / std);
          return {
            index,
            value,
            anomaly: zScore > threshold,
            score: zScore,
            threshold,
          };
        }).filter(result => result.anomaly);
      },
    });

    // Isolation Forest (simplified implementation)
    this.anomalyDetectors.set('isolation-forest', {
      name: 'Isolation Forest Anomaly Detection',
      detect: (values, threshold = 0.6) => {
        if (values.length < 20) return [];

        // Simplified isolation score calculation
        const scores = values.map((value, index) => {
          let isolationScore = 0;
          for (let i = 0; i < 10; i++) { // 10 trees
            let currentValue = value;
            let pathLength = 0;
            let min = Math.min(...values);
            let max = Math.max(...values);

            while (pathLength < 10 && min < max) {
              const split = min + Math.random() * (max - min);
              if (currentValue < split) {
                max = split;
              } else {
                min = split;
              }
              pathLength++;
            }
            isolationScore += pathLength;
          }
          
          isolationScore /= 10; // Average path length
          const normalizedScore = 1 - (isolationScore / 10); // Normalize to 0-1

          return {
            index,
            value,
            anomaly: normalizedScore > threshold,
            score: normalizedScore,
            threshold,
          };
        });

        return scores.filter(result => result.anomaly);
      },
    });

    this.logger.info('Anomaly detection algorithms initialized');
  }

  async setupSLOMonitoring() {
    // Setup SLO calculators for each target
    for (const [sloName, target] of Object.entries(this.config.performance.sloTargets)) {
      this.sloCalculators.set(sloName, {
        name: sloName,
        target,
        calculator: this.createSLOCalculator(sloName, target),
        history: [],
        currentValue: null,
        status: 'unknown',
      });
    }

    this.logger.info(`Configured SLO monitoring for ${Object.keys(this.config.performance.sloTargets).length} targets`);
  }

  createSLOCalculator(sloName, target) {
    switch (sloName) {
      case 'availability':
        return () => {
          const totalRequests = this.getMetricValue('app.requests.total') || 0;
          const errorRequests = this.getMetricValue('app.errors.total') || 0;
          if (totalRequests === 0) return 100;
          return ((totalRequests - errorRequests) / totalRequests) * 100;
        };

      case 'latency_p95':
        return () => {
          const latencyHistogram = this.getMetricHistory('app.requests.duration', 3600000); // 1 hour
          if (latencyHistogram.length === 0) return 0;
          const sorted = latencyHistogram.sort((a, b) => a - b);
          return sorted[Math.floor(sorted.length * 0.95)];
        };

      case 'latency_p99':
        return () => {
          const latencyHistogram = this.getMetricHistory('app.requests.duration', 3600000);
          if (latencyHistogram.length === 0) return 0;
          const sorted = latencyHistogram.sort((a, b) => a - b);
          return sorted[Math.floor(sorted.length * 0.99)];
        };

      case 'error_rate':
        return () => {
          const totalRequests = this.getMetricValue('app.requests.total') || 0;
          const errorRequests = this.getMetricValue('app.errors.total') || 0;
          if (totalRequests === 0) return 0;
          return (errorRequests / totalRequests) * 100;
        };

      default:
        return () => 0;
    }
  }

  async configureIntegrations() {
    // Configure Prometheus integration
    if (this.config.integrations.prometheus.enabled) {
      this.setupPrometheusIntegration();
    }

    // Configure Grafana integration
    if (this.config.integrations.grafana.enabled) {
      this.setupGrafanaIntegration();
    }

    // Configure Jaeger integration
    if (this.config.integrations.jaeger.enabled) {
      this.setupJaegerIntegration();
    }

    // Configure alerting integrations
    if (this.config.integrations.slack.enabled) {
      this.setupSlackIntegration();
    }

    if (this.config.integrations.pagerduty.enabled) {
      this.setupPagerDutyIntegration();
    }

    this.logger.info('Monitoring integrations configured');
  }

  setupPrometheusIntegration() {
    // Prometheus metrics endpoint simulation
    this.prometheusEndpoint = {
      getMetrics: () => {
        let output = '';
        for (const [name, metric] of this.metrics) {
          output += `# HELP ${name} ${metric.help}\n`;
          output += `# TYPE ${name} ${metric.type}\n`;
          
          for (const [labels, value] of metric.values) {
            const labelString = labels ? `{${labels}}` : '';
            output += `${name}${labelString} ${value}\n`;
          }
          output += '\n';
        }
        return output;
      },
    };

    this.logger.info('Prometheus integration configured');
  }

  setupGrafanaIntegration() {
    // Grafana dashboard configuration
    this.grafanaDashboards = {
      system: {
        title: 'System Overview',
        panels: [
          { title: 'CPU Usage', metric: 'system.cpu.usage' },
          { title: 'Memory Usage', metric: 'system.memory.usage' },
          { title: 'Network I/O', metric: 'system.network.bytes_in' },
        ],
      },
      application: {
        title: 'Application Performance',
        panels: [
          { title: 'Request Rate', metric: 'app.requests.total' },
          { title: 'Response Time', metric: 'app.requests.duration' },
          { title: 'Error Rate', metric: 'app.errors.total' },
        ],
      },
      llm: {
        title: 'LLM Observability',
        panels: [
          { title: 'LLM Calls', metric: 'llm.calls.total' },
          { title: 'Token Usage', metric: 'llm.tokens.total' },
          { title: 'Cost Tracking', metric: 'llm.cost.total' },
        ],
      },
    };

    this.logger.info('Grafana integration configured');
  }

  setupJaegerIntegration() {
    // Jaeger tracing configuration
    this.jaegerConfig = {
      serviceName: 'lang-observatory',
      sampler: { type: 'const', param: 1 },
      reporter: { logSpans: true },
    };

    this.logger.info('Jaeger integration configured');
  }

  setupSlackIntegration() {
    if (!this.config.integrations.slack.webhook) return;

    this.slackNotifier = {
      sendAlert: async (alert) => {
        const message = {
          text: `🚨 Alert: ${alert.name}`,
          attachments: [{
            color: this.getSlackColor(alert.severity),
            fields: [
              { title: 'Severity', value: alert.severity, short: true },
              { title: 'Metric', value: alert.metric, short: true },
              { title: 'Description', value: alert.description, short: false },
              { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: true },
            ],
          }],
        };

        // In production, send to actual Slack webhook
        this.logger.info('Slack alert sent', message);
      },
    };

    this.logger.info('Slack integration configured');
  }

  setupPagerDutyIntegration() {
    if (!this.config.integrations.pagerduty.apiKey) return;

    this.pagerDutyNotifier = {
      createIncident: async (alert) => {
        const incident = {
          routing_key: this.config.integrations.pagerduty.apiKey,
          event_action: 'trigger',
          dedup_key: alert.id,
          payload: {
            summary: alert.description,
            severity: alert.severity,
            source: 'lang-observatory',
            timestamp: new Date(alert.timestamp).toISOString(),
          },
        };

        // In production, send to actual PagerDuty API
        this.logger.info('PagerDuty incident created', incident);
      },
    };

    this.logger.info('PagerDuty integration configured');
  }

  startMonitoringLoops() {
    // Metric collection loop
    this.intervals.set('metricCollection', setInterval(() => {
      this.collectMetrics();
    }, this.config.metrics.collectionInterval));

    // Alert evaluation loop
    this.intervals.set('alertEvaluation', setInterval(() => {
      this.evaluateAlerts();
    }, this.config.alerting.evaluationInterval));

    // Anomaly detection loop
    this.intervals.set('anomalyDetection', setInterval(() => {
      this.detectAnomalies();
    }, 60000)); // Every minute

    // SLO calculation loop
    this.intervals.set('sloCalculation', setInterval(() => {
      this.calculateSLOs();
    }, 300000)); // Every 5 minutes

    // Health check loop
    this.intervals.set('healthCheck', setInterval(() => {
      this.performHealthCheck();
    }, 30000)); // Every 30 seconds

    this.logger.info('Monitoring loops started');
  }

  collectMetrics() {
    try {
      // Collect system metrics
      this.updateMetric('system.cpu.usage', process.cpuUsage().user / 1000000); // Convert to seconds
      this.updateMetric('system.memory.usage', process.memoryUsage().heapUsed);

      // Collect performance metrics
      this.performanceMetrics.totalMetricsCollected++;
      this.performanceMetrics.lastHealthCheck = Date.now();

      // Emit metrics collected event
      this.emit('metricsCollected', {
        timestamp: Date.now(),
        metricsCount: this.metrics.size,
      });
    } catch (error) {
      this.logger.error('Metric collection failed:', error);
    }
  }

  updateMetric(name, value, labels = '') {
    const metric = this.metrics.get(name);
    if (!metric) {
      this.logger.warn(`Unknown metric: ${name}`);
      return;
    }

    metric.values.set(labels, value);
    metric.lastUpdated = Date.now();

    // Add to history
    const history = this.metricHistory.get(name) || [];
    history.push({ timestamp: Date.now(), value, labels });
    
    // Limit history size
    if (history.length > 1000) {
      history.shift();
    }
    
    this.metricHistory.set(name, history);

    // Calculate aggregations
    this.calculateMetricAggregations(name, metric);
  }

  calculateMetricAggregations(name, metric) {
    const history = this.metricHistory.get(name) || [];
    
    for (const window of this.config.metrics.aggregationWindows) {
      const windowStart = Date.now() - (window * 1000);
      const windowData = history.filter(h => h.timestamp >= windowStart);
      
      if (windowData.length === 0) continue;

      const values = windowData.map(h => h.value);
      const aggregation = {
        count: values.length,
        sum: values.reduce((sum, val) => sum + val, 0),
        avg: values.reduce((sum, val) => sum + val, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        p50: this.calculatePercentile(values, 0.5),
        p95: this.calculatePercentile(values, 0.95),
        p99: this.calculatePercentile(values, 0.99),
      };

      metric.aggregations.set(`${window}s`, aggregation);
    }
  }

  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(percentile * (sorted.length - 1));
    return sorted[index];
  }

  evaluateAlerts() {
    const now = Date.now();
    
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        const shouldAlert = this.evaluateAlertRule(rule, now);
        
        if (shouldAlert) {
          this.triggerAlert(rule);
        }
        
        rule.lastEvaluated = now;
      } catch (error) {
        this.logger.error(`Alert rule evaluation failed for ${rule.name}:`, error);
      }
    }
  }

  evaluateAlertRule(rule, now) {
    const metricValue = this.getMetricValue(rule.metric);
    if (metricValue === null) return false;

    let conditionMet = false;

    switch (rule.condition) {
      case 'gt':
        conditionMet = metricValue > rule.threshold;
        break;
      case 'lt':
        conditionMet = metricValue < rule.threshold;
        break;
      case 'eq':
        conditionMet = metricValue === rule.threshold;
        break;
      case 'rate_gt':
        const rate = this.calculateMetricRate(rule.metric, 60000); // 1 minute rate
        conditionMet = rate > rule.threshold;
        break;
      default:
        this.logger.warn(`Unknown alert condition: ${rule.condition}`);
        return false;
    }

    // Check duration requirement
    if (conditionMet && rule.duration > 0) {
      const durationStart = now - rule.duration;
      const historyInWindow = this.getMetricHistory(rule.metric, rule.duration);
      
      // All values in the duration window must meet the condition
      return historyInWindow.every(value => {
        switch (rule.condition) {
          case 'gt': return value > rule.threshold;
          case 'lt': return value < rule.threshold;
          case 'eq': return value === rule.threshold;
          default: return false;
        }
      });
    }

    return conditionMet;
  }

  triggerAlert(rule) {
    const alertId = `${rule.name}_${Date.now()}`;
    const alert = {
      id: alertId,
      ruleId: rule.id,
      name: rule.name,
      metric: rule.metric,
      severity: rule.severity,
      description: rule.description,
      threshold: rule.threshold,
      currentValue: this.getMetricValue(rule.metric),
      timestamp: Date.now(),
      status: 'active',
    };

    // Check suppression
    const lastAlert = this.alertHistory
      .filter(a => a.name === rule.name)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (lastAlert && (Date.now() - lastAlert.timestamp) < this.config.alerting.suppressionTime) {
      this.logger.debug(`Alert suppressed: ${rule.name}`);
      return;
    }

    this.activeAlerts.set(alertId, alert);
    this.alertHistory.push(alert);
    this.performanceMetrics.alertsTriggered++;

    // Send notifications
    this.sendAlertNotifications(alert);

    this.emit('alertTriggered', alert);
    this.logger.warn(`Alert triggered: ${rule.name}`, {
      current: alert.currentValue,
      threshold: rule.threshold,
    });
  }

  sendAlertNotifications(alert) {
    // Send to Slack
    if (this.slackNotifier) {
      this.slackNotifier.sendAlert(alert);
    }

    // Send to PagerDuty for critical/emergency alerts
    if (this.pagerDutyNotifier && ['critical', 'emergency'].includes(alert.severity)) {
      this.pagerDutyNotifier.createIncident(alert);
    }
  }

  detectAnomalies() {
    if (!this.config.anomalyDetection.enabled) return;

    for (const [metricName, metric] of this.metrics) {
      try {
        const history = this.metricHistory.get(metricName) || [];
        if (history.length < 20) continue; // Need sufficient data

        const values = history.map(h => h.value);
        
        for (const [detectorName, detector] of this.anomalyDetectors) {
          const anomalies = detector.detect(values, this.config.anomalyDetection.sensitivity);
          
          if (anomalies.length > 0) {
            this.handleAnomalies(metricName, detectorName, anomalies);
          }
        }
      } catch (error) {
        this.logger.error(`Anomaly detection failed for ${metricName}:`, error);
      }
    }
  }

  handleAnomalies(metricName, detectorName, anomalies) {
    this.performanceMetrics.anomaliesDetected += anomalies.length;

    const anomalyAlert = {
      type: 'anomaly',
      metric: metricName,
      detector: detectorName,
      anomalies: anomalies.length,
      severity: 'warning',
      timestamp: Date.now(),
    };

    this.emit('anomalyDetected', anomalyAlert);
    this.logger.info(`Anomalies detected in ${metricName}`, {
      detector: detectorName,
      count: anomalies.length,
    });
  }

  calculateSLOs() {
    for (const [sloName, sloConfig] of this.sloCalculators) {
      try {
        const currentValue = sloConfig.calculator();
        const previousStatus = sloConfig.status;
        
        sloConfig.currentValue = currentValue;
        sloConfig.status = currentValue >= sloConfig.target ? 'met' : 'violated';
        
        // Record history
        sloConfig.history.push({
          timestamp: Date.now(),
          value: currentValue,
          target: sloConfig.target,
          status: sloConfig.status,
        });

        // Limit history
        if (sloConfig.history.length > 288) { // 24 hours at 5-minute intervals
          sloConfig.history.shift();
        }

        // Alert on SLO violation
        if (sloConfig.status === 'violated' && previousStatus !== 'violated') {
          this.performanceMetrics.sloViolations++;
          this.triggerSLOViolationAlert(sloName, sloConfig);
        }

        this.emit('sloCalculated', {
          name: sloName,
          current: currentValue,
          target: sloConfig.target,
          status: sloConfig.status,
        });
      } catch (error) {
        this.logger.error(`SLO calculation failed for ${sloName}:`, error);
      }
    }
  }

  triggerSLOViolationAlert(sloName, sloConfig) {
    const alert = {
      id: `slo_violation_${sloName}_${Date.now()}`,
      type: 'slo_violation',
      name: `SLO Violation: ${sloName}`,
      metric: sloName,
      severity: 'critical',
      description: `SLO ${sloName} violated: ${sloConfig.currentValue.toFixed(2)} < ${sloConfig.target}`,
      currentValue: sloConfig.currentValue,
      target: sloConfig.target,
      timestamp: Date.now(),
    };

    this.sendAlertNotifications(alert);
    this.emit('sloViolation', alert);
  }

  performHealthCheck() {
    const now = Date.now();
    let healthScore = 1.0;
    const issues = [];

    // Check metric collection health
    const lastMetricUpdate = Math.max(...Array.from(this.metrics.values()).map(m => m.lastUpdated));
    if (now - lastMetricUpdate > this.config.metrics.collectionInterval * 2) {
      healthScore -= 0.2;
      issues.push('Metric collection delayed');
    }

    // Check active alerts
    const criticalAlerts = Array.from(this.activeAlerts.values())
      .filter(a => a.severity === 'critical' || a.severity === 'emergency');
    if (criticalAlerts.length > 0) {
      healthScore -= Math.min(0.5, criticalAlerts.length * 0.1);
      issues.push(`${criticalAlerts.length} critical alerts active`);
    }

    // Check SLO violations
    const violatedSLOs = Array.from(this.sloCalculators.values())
      .filter(slo => slo.status === 'violated');
    if (violatedSLOs.length > 0) {
      healthScore -= Math.min(0.3, violatedSLOs.length * 0.1);
      issues.push(`${violatedSLOs.length} SLO violations`);
    }

    this.performanceMetrics.systemHealth = Math.max(0, healthScore);
    
    this.emit('healthCheck', {
      score: this.performanceMetrics.systemHealth,
      issues,
      timestamp: now,
    });
  }

  getMetricValue(name, labels = '') {
    const metric = this.metrics.get(name);
    return metric ? (metric.values.get(labels) || null) : null;
  }

  getMetricHistory(name, duration = 3600000) { // Default 1 hour
    const history = this.metricHistory.get(name) || [];
    const cutoff = Date.now() - duration;
    return history
      .filter(h => h.timestamp >= cutoff)
      .map(h => h.value);
  }

  calculateMetricRate(name, duration = 60000) { // Default 1 minute
    const history = this.getMetricHistory(name, duration);
    if (history.length < 2) return 0;
    
    const latest = history[history.length - 1];
    const earliest = history[0];
    const timeDiff = duration / 1000; // Convert to seconds
    
    return (latest - earliest) / timeDiff;
  }

  getSlackColor(severity) {
    const colors = {
      info: '#36a64f',
      warning: '#ff9500',
      critical: '#ff0000',
      emergency: '#8b0000',
    };
    return colors[severity] || '#808080';
  }

  getMonitoringMetrics() {
    return {
      ...this.performanceMetrics,
      activeMetrics: this.metrics.size,
      activeAlerts: this.activeAlerts.size,
      alertRules: this.alertRules.size,
      sloCalculators: this.sloCalculators.size,
      anomalyDetectors: this.anomalyDetectors.size,
      uptime: Date.now() - this.performanceMetrics.lastHealthCheck,
      timestamp: Date.now(),
    };
  }

  async shutdown() {
    this.logger.info('Shutting down Advanced Monitoring Orchestrator...');

    // Clear all intervals
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();

    // Clear data structures
    this.metrics.clear();
    this.metricHistory.clear();
    this.alertRules.clear();
    this.activeAlerts.clear();
    this.anomalyDetectors.clear();
    this.sloCalculators.clear();

    this.removeAllListeners();
    this.logger.info('Advanced Monitoring Orchestrator shutdown complete');
  }
}

module.exports = { AdvancedMonitoringOrchestrator };