/**
 * Metrics Management Service
 * Handles aggregation and analysis of LLM metrics
 */

const { Logger } = require('../utils/logger');

class MetricsManager {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      retentionDays: config.retentionDays || 30,
      aggregationInterval: config.aggregationInterval || 60000, // 1 minute
      alertThresholds: {
        errorRate: 0.05, // 5%
        avgLatency: 5000, // 5 seconds
        costPerHour: 100, // $100/hour
        ...config.alertThresholds,
      },
      ...config,
    };

    this.logger = new Logger({ service: 'MetricsManager' });
    this.operationMetrics = new Map();
    this.llmUsageMetrics = new Map();
    this.customMetrics = new Map();
    this.alertHistory = [];
    this.aggregationTimer = null;
    this.initialized = false;
  }

  async initialize() {
    if (!this.config.enabled) {
      this.logger.info('Metrics management disabled');
      this.initialized = true;
      return;
    }

    try {
      // Initialize metrics storage
      await this._initializeStorage();

      // Start periodic aggregation
      this._startAggregationTimer();

      this.initialized = true;
      this.logger.info('Metrics manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize metrics manager:', error);
      throw error;
    }
  }

  startOperation(operation, traceId) {
    if (!this.config.enabled) return;

    const key = `${operation}:${traceId}`;
    this.operationMetrics.set(key, {
      operation,
      traceId,
      startTime: Date.now(),
      status: 'active',
    });
  }

  recordSuccess(operation, duration, traceId) {
    if (!this.config.enabled) return;

    const key = `${operation}:${traceId}`;
    const metric = this.operationMetrics.get(key);

    if (metric) {
      metric.endTime = Date.now();
      metric.duration = duration;
      metric.status = 'success';

      this._updateAggregatedMetrics(operation, { success: true, duration });
      this.operationMetrics.delete(key);
    }

    this.logger.debug(`Recorded success for ${operation}: ${duration}ms`);
  }

  recordError(operation, duration, error, traceId) {
    if (!this.config.enabled) return;

    const key = `${operation}:${traceId}`;
    const metric = this.operationMetrics.get(key);

    if (metric) {
      metric.endTime = Date.now();
      metric.duration = duration;
      metric.status = 'error';
      metric.error = error.message;

      this._updateAggregatedMetrics(operation, {
        success: false,
        duration,
        error,
      });
      this.operationMetrics.delete(key);
    }

    this.logger.debug(`Recorded error for ${operation}: ${error.message}`);
    this._checkAlertThresholds(operation);
  }

  async recordLLMUsage(callData) {
    if (!this.config.enabled) return;

    const key = `${callData.provider}:${callData.model}`;
    const timestamp = Date.now();

    if (!this.llmUsageMetrics.has(key)) {
      this.llmUsageMetrics.set(key, {
        provider: callData.provider,
        model: callData.model,
        calls: [],
        totalCost: 0,
        totalTokens: 0,
        errorCount: 0,
        lastUpdated: timestamp,
      });
    }

    const metrics = this.llmUsageMetrics.get(key);

    // Add call record
    metrics.calls.push({
      timestamp,
      tokens: callData.tokens || { total: 0 },
      cost: callData.cost || { total: 0 },
      duration: callData.duration || 0,
      success: callData.success !== false,
    });

    // Update aggregated values
    metrics.totalCost += callData.cost?.total || 0;
    metrics.totalTokens += callData.tokens?.total || 0;
    if (callData.success === false) {
      metrics.errorCount++;
    }
    metrics.lastUpdated = timestamp;

    // Clean old records (keep last 1000 calls)
    if (metrics.calls.length > 1000) {
      metrics.calls = metrics.calls.slice(-1000);
    }

    this.logger.debug(
      `Recorded LLM usage for ${key}: $${callData.cost?.total || 0}`
    );
  }

  recordCustomMetric(name, value, type = 'gauge', labels = {}) {
    if (!this.config.enabled) return;

    const timestamp = Date.now();
    const key = `custom:${name}`;

    if (!this.customMetrics.has(key)) {
      this.customMetrics.set(key, {
        name,
        type,
        records: [],
        lastUpdated: timestamp,
      });
    }

    const metric = this.customMetrics.get(key);

    // Add metric record
    metric.records.push({
      timestamp,
      value,
      labels,
    });

    // Keep last 1000 records
    if (metric.records.length > 1000) {
      metric.records = metric.records.slice(-1000);
    }

    metric.lastUpdated = timestamp;

    this.logger.debug(`Recorded custom metric ${name}: ${JSON.stringify(value)}`);
  }

  getOperationMetrics(operation) {
    const aggregated = this._getAggregatedMetrics(operation);
    const active = Array.from(this.operationMetrics.values()).filter(
      m => m.operation === operation && m.status === 'active'
    );

    return {
      operation,
      aggregated,
      active: active.length,
      timestamp: Date.now(),
    };
  }

  getLLMUsageMetrics(provider = null, model = null) {
    let metrics = Array.from(this.llmUsageMetrics.values());

    if (provider) {
      metrics = metrics.filter(m => m.provider === provider);
    }

    if (model) {
      metrics = metrics.filter(m => m.model === model);
    }

    return metrics.map(m => ({
      provider: m.provider,
      model: m.model,
      totalCalls: m.calls.length,
      totalCost: m.totalCost,
      totalTokens: m.totalTokens,
      errorCount: m.errorCount,
      errorRate: m.calls.length > 0 ? m.errorCount / m.calls.length : 0,
      avgCostPerCall: m.calls.length > 0 ? m.totalCost / m.calls.length : 0,
      lastUpdated: m.lastUpdated,
    }));
  }

  getCostAnalysis(timeRangeHours = 24) {
    const cutoff = Date.now() - timeRangeHours * 60 * 60 * 1000;
    let totalCost = 0;
    const providerCosts = {};
    const modelCosts = {};

    for (const metrics of this.llmUsageMetrics.values()) {
      const recentCalls = metrics.calls.filter(call => call.timestamp > cutoff);
      const recentCost = recentCalls.reduce(
        (sum, call) => sum + call.cost.total,
        0
      );

      totalCost += recentCost;

      if (!providerCosts[metrics.provider]) {
        providerCosts[metrics.provider] = 0;
      }
      providerCosts[metrics.provider] += recentCost;

      const modelKey = `${metrics.provider}/${metrics.model}`;
      if (!modelCosts[modelKey]) {
        modelCosts[modelKey] = 0;
      }
      modelCosts[modelKey] += recentCost;
    }

    return {
      timeRangeHours,
      totalCost,
      costPerHour: totalCost / timeRangeHours,
      byProvider: providerCosts,
      byModel: modelCosts,
      timestamp: Date.now(),
    };
  }

  getAlerts(limit = 50) {
    return this.alertHistory
      .slice(-limit)
      .reverse()
      .map(alert => ({
        ...alert,
        age: Date.now() - alert.timestamp,
      }));
  }

  getCustomMetrics(name = null) {
    let metrics = Array.from(this.customMetrics.values());

    if (name) {
      metrics = metrics.filter(m => m.name === name);
    }

    return metrics.map(m => ({
      name: m.name,
      type: m.type,
      recordCount: m.records.length,
      lastValue: m.records.length > 0 ? m.records[m.records.length - 1].value : null,
      lastUpdated: m.lastUpdated,
      records: m.records.slice(-100), // Return last 100 records
    }));
  }

  async getHealth() {
    if (!this.config.enabled) {
      return { healthy: true, status: 'disabled' };
    }

    return {
      healthy: true,
      status: 'active',
      activeOperations: this.operationMetrics.size,
      trackedLLMModels: this.llmUsageMetrics.size,
      customMetrics: this.customMetrics.size,
      alertCount: this.alertHistory.length,
    };
  }

  async shutdown() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    // Perform final aggregation
    await this._performAggregation();

    this.initialized = false;
    this.logger.info('Metrics manager shutdown complete');
  }

  // Private methods
  async _initializeStorage() {
    // Initialize in-memory storage - in production, use Redis or database
    this.aggregatedMetrics = new Map();
    this.logger.debug('Initialized metrics storage');
  }

  _startAggregationTimer() {
    this.aggregationTimer = setInterval(() => {
      this._performAggregation();
    }, this.config.aggregationInterval);
  }

  async _performAggregation() {
    // Clean up old data
    this._cleanupOldData();

    // Generate aggregated metrics
    this._generateHourlyAggregates();

    this.logger.debug('Performed metrics aggregation');
  }

  _updateAggregatedMetrics(operation, data) {
    const key = `${operation}:${this._getHourKey()}`;

    if (!this.aggregatedMetrics.has(key)) {
      this.aggregatedMetrics.set(key, {
        operation,
        hour: this._getHourKey(),
        totalCalls: 0,
        successCalls: 0,
        errorCalls: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
      });
    }

    const metrics = this.aggregatedMetrics.get(key);
    metrics.totalCalls++;

    if (data.success) {
      metrics.successCalls++;
    } else {
      metrics.errorCalls++;
    }

    metrics.totalDuration += data.duration;
    metrics.minDuration = Math.min(metrics.minDuration, data.duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, data.duration);
  }

  _getAggregatedMetrics(operation) {
    const operationMetrics = Array.from(this.aggregatedMetrics.values()).filter(
      m => m.operation === operation
    );

    if (operationMetrics.length === 0) {
      return null;
    }

    const totals = operationMetrics.reduce(
      (acc, m) => ({
        totalCalls: acc.totalCalls + m.totalCalls,
        successCalls: acc.successCalls + m.successCalls,
        errorCalls: acc.errorCalls + m.errorCalls,
        totalDuration: acc.totalDuration + m.totalDuration,
      }),
      { totalCalls: 0, successCalls: 0, errorCalls: 0, totalDuration: 0 }
    );

    return {
      ...totals,
      successRate:
        totals.totalCalls > 0 ? totals.successCalls / totals.totalCalls : 0,
      errorRate:
        totals.totalCalls > 0 ? totals.errorCalls / totals.totalCalls : 0,
      avgDuration:
        totals.totalCalls > 0 ? totals.totalDuration / totals.totalCalls : 0,
    };
  }

  _checkAlertThresholds(operation) {
    const metrics = this._getAggregatedMetrics(operation);
    if (!metrics) return;

    const alerts = [];

    // Check error rate
    if (metrics.errorRate > this.config.alertThresholds.errorRate) {
      alerts.push({
        type: 'error_rate',
        operation,
        value: metrics.errorRate,
        threshold: this.config.alertThresholds.errorRate,
        message: `High error rate for ${operation}: ${(metrics.errorRate * 100).toFixed(2)}%`,
      });
    }

    // Check average latency
    if (metrics.avgDuration > this.config.alertThresholds.avgLatency) {
      alerts.push({
        type: 'high_latency',
        operation,
        value: metrics.avgDuration,
        threshold: this.config.alertThresholds.avgLatency,
        message: `High latency for ${operation}: ${metrics.avgDuration.toFixed(0)}ms`,
      });
    }

    // Record alerts
    alerts.forEach(alert => {
      alert.timestamp = Date.now();
      this.alertHistory.push(alert);
      this.logger.warn(`ALERT: ${alert.message}`);
    });

    // Keep alert history manageable
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }
  }

  _cleanupOldData() {
    const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;

    // Clean aggregated metrics
    for (const [key, metrics] of this.aggregatedMetrics.entries()) {
      if (metrics.hour < this._getHourKey(cutoff)) {
        this.aggregatedMetrics.delete(key);
      }
    }

    // Clean LLM usage data
    for (const metrics of this.llmUsageMetrics.values()) {
      metrics.calls = metrics.calls.filter(call => call.timestamp > cutoff);
    }

    // Clean custom metrics data
    for (const metrics of this.customMetrics.values()) {
      metrics.records = metrics.records.filter(record => record.timestamp > cutoff);
    }
  }

  _generateHourlyAggregates() {
    // Generate summary metrics for the current hour
    const currentHour = this._getHourKey();
    const hourlyMetrics = Array.from(this.aggregatedMetrics.values()).filter(
      m => m.hour === currentHour
    );

    if (hourlyMetrics.length > 0) {
      this.logger.debug(
        `Generated aggregates for ${hourlyMetrics.length} operations in hour ${currentHour}`
      );
    }
  }

  _getHourKey(timestamp = Date.now()) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
  }
}

module.exports = { MetricsManager };
