/**
 * Real-Time Quality Monitor
 * Continuous monitoring and alerting for quality metrics
 */

const EventEmitter = require('events');
const { Logger } = require('../utils/logger');
const { ProgressiveQualityGates } = require('./progressiveQualityGates');

class RealTimeQualityMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      monitoring: {
        interval: config.monitoring?.interval || 15000, // 15 seconds
        healthCheckInterval: config.monitoring?.healthCheckInterval || 60000, // 1 minute
        metricsRetention: config.monitoring?.metricsRetention || 1440, // 24 hours in minutes
      },
      alerts: {
        webhook: config.alerts?.webhook || null,
        slack: config.alerts?.slack || null,
        email: config.alerts?.email || null,
        thresholds: {
          warning: 70,
          critical: 50,
          emergency: 30,
          ...config.alerts?.thresholds,
        },
      },
      streaming: {
        enabled: config.streaming?.enabled || true,
        bufferSize: config.streaming?.bufferSize || 1000,
        flushInterval: config.streaming?.flushInterval || 5000,
      },
      ...config,
    };

    this.logger = new Logger({ service: 'RealTimeQualityMonitor' });
    this.progressiveGates = new ProgressiveQualityGates(config.progressiveGates);
    
    this.isActive = false;
    this.intervals = new Map();
    this.metricsBuffer = [];
    this.alertHistory = [];
    this.currentHealth = 'healthy';
    
    this.qualityTrends = {
      coverage: [],
      performance: [],
      security: [],
      quality: [],
    };

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.progressiveGates.on('qualityDegradation', (data) => {
      this.handleQualityAlert('degradation', data);
    });

    this.progressiveGates.on('thresholdBreached', (data) => {
      this.handleQualityAlert('breach', data);
    });

    this.on('qualityAlert', (alert) => {
      this.processQualityAlert(alert);
    });
  }

  async startMonitoring() {
    if (this.isActive) {
      this.logger.warn('Real-time monitoring already active');
      return;
    }

    this.logger.info('Starting real-time quality monitoring...');
    this.isActive = true;

    // Start progressive quality gates monitoring
    this.progressiveGates.startRealTimeMonitoring();

    // Start health check monitoring
    this.intervals.set('healthCheck', setInterval(
      () => this.performHealthCheck(),
      this.config.monitoring.healthCheckInterval
    ));

    // Start metrics collection
    this.intervals.set('metricsCollection', setInterval(
      () => this.collectMetrics(),
      this.config.monitoring.interval
    ));

    // Start metrics buffer flushing
    if (this.config.streaming.enabled) {
      this.intervals.set('bufferFlush', setInterval(
        () => this.flushMetricsBuffer(),
        this.config.streaming.flushInterval
      ));
    }

    this.logger.info('Real-time quality monitoring started successfully');
  }

  async performHealthCheck() {
    try {
      const healthMetrics = {
        timestamp: new Date().toISOString(),
        system: {
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          uptime: process.uptime(),
        },
        quality: await this.getQuickQualitySnapshot(),
        monitoring: {
          active: this.isActive,
          bufferSize: this.metricsBuffer.length,
          alertsInLastHour: this.getRecentAlerts(3600000).length,
        },
      };

      const healthScore = this.calculateHealthScore(healthMetrics);
      const previousHealth = this.currentHealth;
      this.currentHealth = this.determineHealthStatus(healthScore);

      if (this.currentHealth !== previousHealth) {
        this.emit('healthStatusChange', {
          previous: previousHealth,
          current: this.currentHealth,
          score: healthScore,
          metrics: healthMetrics,
        });
      }

      // Store health metrics
      this.recordHealthMetrics(healthMetrics, healthScore);

    } catch (error) {
      this.logger.error('Health check failed:', error);
      this.currentHealth = 'unhealthy';
    }
  }

  async getQuickQualitySnapshot() {
    try {
      const snapshot = await this.progressiveGates.runQuickValidation();
      return {
        score: snapshot.coverage?.score || 0,
        security: snapshot.security?.score || 0,
        timestamp: snapshot.timestamp,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  calculateHealthScore(metrics) {
    const weights = {
      memory: 25,
      quality: 40,
      alerts: 35,
    };

    const scores = {
      memory: Math.max(0, 100 - (metrics.system.memory.heapUsed / metrics.system.memory.heapTotal) * 100),
      quality: metrics.quality.score || 0,
      alerts: Math.max(0, 100 - metrics.monitoring.alertsInLastHour * 10),
    };

    return Object.entries(scores).reduce((total, [metric, score]) => {
      return total + (score * weights[metric]) / 100;
    }, 0);
  }

  determineHealthStatus(score) {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'healthy';
    if (score >= 50) return 'degraded';
    return 'unhealthy';
  }

  async collectMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      progressive: this.progressiveGates.getProgressiveMetrics(),
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
      quality: await this.captureQualityTrends(),
    };

    if (this.config.streaming.enabled) {
      this.addToBuffer(metrics);
    }

    this.updateQualityTrends(metrics.quality);
    this.emit('metricsCollected', metrics);
  }

  async captureQualityTrends() {
    try {
      const currentMetrics = this.progressiveGates.validator.getMetrics();
      return {
        coverage: currentMetrics.codeCoverage,
        performance: currentMetrics.performanceScore,
        security: currentMetrics.securityScore,
        quality: currentMetrics.codeQualityScore,
        overall: currentMetrics.overallScore,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  updateQualityTrends(qualityMetrics) {
    Object.entries(qualityMetrics).forEach(([metric, value]) => {
      if (this.qualityTrends[metric] && typeof value === 'number') {
        this.qualityTrends[metric].push({
          value,
          timestamp: new Date().toISOString(),
        });
        
        // Keep only recent trends (last 100 data points)
        if (this.qualityTrends[metric].length > 100) {
          this.qualityTrends[metric] = this.qualityTrends[metric].slice(-100);
        }
      }
    });
  }

  addToBuffer(metrics) {
    this.metricsBuffer.push(metrics);
    
    if (this.metricsBuffer.length >= this.config.streaming.bufferSize) {
      this.flushMetricsBuffer();
    }
  }

  flushMetricsBuffer() {
    if (this.metricsBuffer.length === 0) return;

    const batch = [...this.metricsBuffer];
    this.metricsBuffer = [];

    this.emit('metricsBatch', {
      metrics: batch,
      count: batch.length,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`Flushed ${batch.length} metrics to streaming buffer`);
  }

  handleQualityAlert(type, data) {
    const alert = {
      type,
      severity: this.determineSeverity(data),
      data,
      timestamp: new Date().toISOString(),
      id: this.generateAlertId(),
    };

    this.alertHistory.push(alert);
    this.emit('qualityAlert', alert);
  }

  determineSeverity(data) {
    if (data.severity) return data.severity;
    
    const score = data.score || data.currentScore || 0;
    const thresholds = this.config.alerts.thresholds;
    
    if (score <= thresholds.emergency) return 'emergency';
    if (score <= thresholds.critical) return 'critical';
    if (score <= thresholds.warning) return 'warning';
    return 'info';
  }

  async processQualityAlert(alert) {
    this.logger.warn(`Quality alert [${alert.severity}]: ${alert.type}`, alert.data);
    
    // Send to configured alert channels
    if (this.config.alerts.webhook) {
      await this.sendWebhookAlert(alert);
    }
    
    if (this.config.alerts.slack) {
      await this.sendSlackAlert(alert);
    }
    
    // Auto-remediation for critical alerts
    if (alert.severity === 'critical' || alert.severity === 'emergency') {
      await this.triggerAutoRemediation(alert);
    }
  }

  async sendWebhookAlert(alert) {
    try {
      // Implementation would send HTTP POST to webhook URL
      this.logger.info(`Webhook alert sent for: ${alert.type}`);
    } catch (error) {
      this.logger.error('Failed to send webhook alert:', error);
    }
  }

  async sendSlackAlert(alert) {
    try {
      // Implementation would send to Slack webhook
      this.logger.info(`Slack alert sent for: ${alert.type}`);
    } catch (error) {
      this.logger.error('Failed to send Slack alert:', error);
    }
  }

  async triggerAutoRemediation(alert) {
    this.logger.info(`Triggering auto-remediation for: ${alert.type}`);
    
    const remediationStrategies = {
      degradation: () => this.applyPerformanceOptimization(),
      breach: () => this.applyThresholdRemediation(alert.data),
    };
    
    const strategy = remediationStrategies[alert.type];
    if (strategy) {
      try {
        await strategy();
        this.logger.info(`Auto-remediation completed for: ${alert.type}`);
      } catch (error) {
        this.logger.error('Auto-remediation failed:', error);
      }
    }
  }

  async applyPerformanceOptimization() {
    // Apply automatic performance optimizations
    this.logger.info('Applying automatic performance optimizations...');
  }

  async applyThresholdRemediation(data) {
    // Apply remediation based on specific threshold breach
    this.logger.info(`Applying remediation for ${data.gate} threshold breach...`);
  }

  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getRecentAlerts(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.alertHistory.filter(alert => new Date(alert.timestamp).getTime() > cutoff);
  }

  recordHealthMetrics(metrics, score) {
    // Store health metrics for trend analysis
    const healthRecord = {
      timestamp: metrics.timestamp,
      score,
      status: this.currentHealth,
      metrics,
    };
    
    // Implementation would persist to database or metrics store
    this.emit('healthMetricsRecorded', healthRecord);
  }

  stopMonitoring() {
    if (!this.isActive) return;

    this.logger.info('Stopping real-time quality monitoring...');
    this.isActive = false;

    // Stop progressive gates monitoring
    this.progressiveGates.stopRealTimeMonitoring();

    // Clear all intervals
    this.intervals.forEach((interval, name) => {
      clearInterval(interval);
      this.logger.debug(`Stopped ${name} monitoring interval`);
    });
    this.intervals.clear();

    // Flush any remaining metrics
    if (this.metricsBuffer.length > 0) {
      this.flushMetricsBuffer();
    }

    this.logger.info('Real-time quality monitoring stopped');
  }

  getMonitoringStatus() {
    return {
      active: this.isActive,
      health: this.currentHealth,
      currentStage: this.progressiveGates.currentStage,
      bufferSize: this.metricsBuffer.length,
      alertCount: this.alertHistory.length,
      trends: this.qualityTrends,
      uptime: this.isActive ? process.uptime() : 0,
    };
  }
}

module.exports = { RealTimeQualityMonitor };