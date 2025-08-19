/**
 * Production Scale Manager - Generation 3 Enhancement
 * Advanced auto-scaling and performance optimization for production workloads
 */

const { Logger } = require('../utils/logger');
const { AutoScalingManager } = require('./autoScalingManager');
const { PerformanceManager } = require('./performanceManager');

class ProductionScaleManager {
  constructor(config = {}) {
    this.config = {
      maxConcurrentRequests: config.maxConcurrentRequests || 10000,
      requestsPerSecond: config.requestsPerSecond || 5000,
      autoScaleThreshold: config.autoScaleThreshold || 0.8,
      scaleUpCooldown: config.scaleUpCooldown || 30000,
      scaleDownCooldown: config.scaleDownCooldown || 300000,
      maxReplicas: config.maxReplicas || 20,
      minReplicas: config.minReplicas || 2,
      memoryThreshold: config.memoryThreshold || 0.85,
      cpuThreshold: config.cpuThreshold || 0.75,
      ...config,
    };

    this.logger = new Logger({ service: 'ProductionScaleManager' });
    this.autoScaler = new AutoScalingManager(this.config);
    this.performanceManager = new PerformanceManager(this.config);

    this.metrics = {
      currentLoad: 0,
      currentReplicas: this.config.minReplicas,
      lastScaleAction: null,
      scaleHistory: [],
      performanceProfile: {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        throughput: 0,
      },
    };

    this.initialized = false;
  }

  async initialize() {
    try {
      this.logger.info('Initializing Production Scale Manager...');

      await this.performanceManager.initialize();
      await this.autoScaler.initialize();

      // Start monitoring and scaling loops
      this.startMonitoring();
      this.startAutoScaling();

      this.initialized = true;
      this.logger.info('Production Scale Manager initialized successfully');
      return this;
    } catch (error) {
      this.logger.error(
        'Failed to initialize Production Scale Manager:',
        error
      );
      throw error;
    }
  }

  startMonitoring() {
    // Monitor every 10 seconds
    setInterval(async () => {
      await this.collectMetrics();
      await this.updatePerformanceProfile();
    }, 10000);
  }

  startAutoScaling() {
    // Evaluate scaling decisions every 30 seconds
    setInterval(async () => {
      await this.evaluateScaling();
    }, 30000);
  }

  async collectMetrics() {
    try {
      const performanceMetrics =
        this.performanceManager.getPerformanceMetrics();
      const systemMetrics = await this.getSystemMetrics();

      this.metrics.currentLoad = Math.max(
        performanceMetrics.currentLoad,
        systemMetrics.cpuUsage,
        systemMetrics.memoryUsage
      );

      this.metrics.performanceProfile = {
        avgResponseTime: performanceMetrics.avgResponseTime,
        p95ResponseTime: performanceMetrics.p95ResponseTime,
        p99ResponseTime: performanceMetrics.p99ResponseTime,
        errorRate: performanceMetrics.errorRate,
        throughput: performanceMetrics.requestsPerSecond,
      };
    } catch (error) {
      this.logger.error('Failed to collect metrics:', error);
    }
  }

  async updatePerformanceProfile() {
    const profile = this.metrics.performanceProfile;

    // Update auto-scaling thresholds based on performance
    if (profile.p99ResponseTime > 5000) {
      // High latency - be more aggressive with scaling up
      this.config.autoScaleThreshold = 0.6;
    } else if (profile.p99ResponseTime < 1000) {
      // Low latency - can handle more load
      this.config.autoScaleThreshold = 0.85;
    }

    // Adjust based on error rate
    if (profile.errorRate > 0.05) {
      // High error rate - scale up immediately
      this.config.autoScaleThreshold = 0.5;
    }
  }

  async evaluateScaling() {
    if (!this.initialized) return;

    const shouldScaleUp = await this.shouldScaleUp();
    const shouldScaleDown = await this.shouldScaleDown();

    if (shouldScaleUp && this.canScaleUp()) {
      await this.scaleUp();
    } else if (shouldScaleDown && this.canScaleDown()) {
      await this.scaleDown();
    }
  }

  async shouldScaleUp() {
    const load = this.metrics.currentLoad;
    const threshold = this.config.autoScaleThreshold;
    const profile = this.metrics.performanceProfile;

    return (
      load > threshold ||
      profile.p95ResponseTime > 3000 ||
      profile.errorRate > 0.02 ||
      profile.throughput > this.config.requestsPerSecond * 0.8
    );
  }

  async shouldScaleDown() {
    const load = this.metrics.currentLoad;
    const threshold = this.config.autoScaleThreshold * 0.3; // Scale down at 30% of scale-up threshold
    const profile = this.metrics.performanceProfile;

    return (
      load < threshold &&
      profile.p95ResponseTime < 1000 &&
      profile.errorRate < 0.005 &&
      this.metrics.currentReplicas > this.config.minReplicas
    );
  }

  canScaleUp() {
    const now = Date.now();
    const lastScaleUp =
      this.metrics.lastScaleAction?.type === 'scale_up'
        ? this.metrics.lastScaleAction.timestamp
        : 0;

    return (
      this.metrics.currentReplicas < this.config.maxReplicas &&
      now - lastScaleUp > this.config.scaleUpCooldown
    );
  }

  canScaleDown() {
    const now = Date.now();
    const lastScaleDown =
      this.metrics.lastScaleAction?.type === 'scale_down'
        ? this.metrics.lastScaleAction.timestamp
        : 0;

    return (
      this.metrics.currentReplicas > this.config.minReplicas &&
      now - lastScaleDown > this.config.scaleDownCooldown
    );
  }

  async scaleUp() {
    const targetReplicas = Math.min(
      this.config.maxReplicas,
      Math.ceil(this.metrics.currentReplicas * 1.5)
    );

    this.logger.info(
      `Scaling up from ${this.metrics.currentReplicas} to ${targetReplicas} replicas`
    );

    await this.performScale('scale_up', targetReplicas);
  }

  async scaleDown() {
    const targetReplicas = Math.max(
      this.config.minReplicas,
      Math.floor(this.metrics.currentReplicas * 0.7)
    );

    this.logger.info(
      `Scaling down from ${this.metrics.currentReplicas} to ${targetReplicas} replicas`
    );

    await this.performScale('scale_down', targetReplicas);
  }

  async performScale(type, targetReplicas) {
    try {
      // Record scaling action
      const scaleAction = {
        type,
        from: this.metrics.currentReplicas,
        to: targetReplicas,
        timestamp: Date.now(),
        reason: {
          load: this.metrics.currentLoad,
          performance: this.metrics.performanceProfile,
        },
      };

      // Update internal state
      this.metrics.currentReplicas = targetReplicas;
      this.metrics.lastScaleAction = scaleAction;
      this.metrics.scaleHistory.push(scaleAction);

      // Keep only last 100 scale actions
      if (this.metrics.scaleHistory.length > 100) {
        this.metrics.scaleHistory.shift();
      }

      // Notify auto-scaler
      await this.autoScaler.handleScaleEvent(scaleAction);

      this.logger.info(`Scaling ${type} completed successfully`, scaleAction);
    } catch (error) {
      this.logger.error(`Failed to perform ${type}:`, error);
    }
  }

  async getSystemMetrics() {
    // Simulate system metrics - in production, use actual system monitoring
    return {
      cpuUsage: Math.random() * 0.9,
      memoryUsage: Math.random() * 0.8,
      diskUsage: Math.random() * 0.6,
      networkIO: Math.random() * 100, // MB/s
    };
  }

  // Global Performance Optimization Methods
  async optimizeForRegion(region) {
    const regionalConfig = await this.getRegionalOptimizations(region);

    return {
      caching: {
        ttl: regionalConfig.cacheTTL || 300,
        strategy: regionalConfig.cacheStrategy || 'lru',
        maxSize: regionalConfig.maxCacheSize || '1GB',
      },
      networking: {
        compression: regionalConfig.compression || 'gzip',
        keepAlive: regionalConfig.keepAlive || true,
        connectionPool: regionalConfig.connectionPool || 100,
      },
      processing: {
        concurrency: regionalConfig.maxConcurrency || 1000,
        queueSize: regionalConfig.queueSize || 10000,
        timeout: regionalConfig.timeout || 30000,
      },
    };
  }

  async getRegionalOptimizations(region) {
    // Regional optimization profiles
    const profiles = {
      'us-east-1': {
        cacheTTL: 600,
        maxConcurrency: 2000,
        compression: 'brotli',
      },
      'eu-west-1': {
        cacheTTL: 300,
        maxConcurrency: 1500,
        compression: 'gzip',
      },
      'ap-southeast-1': {
        cacheTTL: 900,
        maxConcurrency: 1000,
        compression: 'gzip',
      },
    };

    return profiles[region] || profiles['us-east-1'];
  }

  // Multi-language support optimization
  async optimizeForLocale(locale) {
    const localeOptimizations = {
      en: { modelPriority: ['gpt-4', 'claude-3'], cacheStrategy: 'aggressive' },
      es: { modelPriority: ['claude-3', 'gpt-4'], cacheStrategy: 'moderate' },
      fr: { modelPriority: ['claude-3', 'gpt-4'], cacheStrategy: 'moderate' },
      de: {
        modelPriority: ['gpt-4', 'claude-3'],
        cacheStrategy: 'conservative',
      },
      ja: { modelPriority: ['claude-3', 'gpt-4'], cacheStrategy: 'aggressive' },
      zh: { modelPriority: ['claude-3', 'gpt-4'], cacheStrategy: 'aggressive' },
    };

    return localeOptimizations[locale] || localeOptimizations['en'];
  }

  getScalingMetrics() {
    return {
      current: {
        replicas: this.metrics.currentReplicas,
        load: this.metrics.currentLoad,
        performance: this.metrics.performanceProfile,
      },
      scaling: {
        lastAction: this.metrics.lastScaleAction,
        history: this.metrics.scaleHistory.slice(-10), // Last 10 actions
        thresholds: {
          scaleUp: this.config.autoScaleThreshold,
          scaleDown: this.config.autoScaleThreshold * 0.3,
        },
      },
      limits: {
        maxReplicas: this.config.maxReplicas,
        minReplicas: this.config.minReplicas,
        maxConcurrency: this.config.maxConcurrentRequests,
      },
    };
  }

  async getHealthStatus() {
    const systemMetrics = await this.getSystemMetrics();

    return {
      healthy: this.initialized && this.metrics.currentLoad < 0.95,
      metrics: {
        load: this.metrics.currentLoad,
        replicas: this.metrics.currentReplicas,
        performance: this.metrics.performanceProfile,
        system: systemMetrics,
      },
      scaling: {
        canScaleUp: this.canScaleUp(),
        canScaleDown: this.canScaleDown(),
        nextScaleEvaluation: this.getNextScaleEvaluation(),
      },
    };
  }

  getNextScaleEvaluation() {
    const lastAction = this.metrics.lastScaleAction;
    if (!lastAction) return Date.now() + 30000;

    const cooldown =
      lastAction.type === 'scale_up'
        ? this.config.scaleUpCooldown
        : this.config.scaleDownCooldown;

    return lastAction.timestamp + cooldown;
  }

  async shutdown() {
    if (!this.initialized) return;

    this.logger.info('Shutting down Production Scale Manager...');

    await this.autoScaler.shutdown();
    await this.performanceManager.shutdown();

    this.initialized = false;
    this.logger.info('Production Scale Manager shutdown complete');
  }
}

module.exports = { ProductionScaleManager };
