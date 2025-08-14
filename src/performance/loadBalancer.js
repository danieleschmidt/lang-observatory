/**
 * Intelligent Load Balancer
 * Distributes requests across multiple instances with health monitoring
 */

const { Logger } = require('../utils/logger');
const { MetricsManager } = require('../services/metricsService');

class LoadBalancer {
  constructor(config = {}) {
    this.config = {
      algorithm: config.algorithm || 'weighted_round_robin', // round_robin, weighted_round_robin, least_connections, health_based
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      healthCheckTimeout: config.healthCheckTimeout || 5000, // 5 seconds
      unhealthyThreshold: config.unhealthyThreshold || 3, // Failed health checks before marking unhealthy
      recoveryCheckInterval: config.recoveryCheckInterval || 60000, // 1 minute
      maxRetries: config.maxRetries || 2,
      retryDelay: config.retryDelay || 1000,
      circuitBreaker: {
        enabled: config.circuitBreaker?.enabled !== false,
        failureThreshold: config.circuitBreaker?.failureThreshold || 5,
        recoveryTimeout: config.circuitBreaker?.recoveryTimeout || 60000,
        ...config.circuitBreaker,
      },
      ...config,
    };

    this.logger = new Logger({ service: 'LoadBalancer' });
    this.metrics = new MetricsManager();

    this.instances = new Map(); // Instance registry
    this.roundRobinIndex = 0;
    this.healthCheckTimer = null;
    this.recoveryTimer = null;

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      avgResponseTime: 0,
    };

    this.initialized = false;
  }

  async initialize() {
    try {
      this._startHealthChecks();
      this._startRecoveryChecks();

      this.initialized = true;
      this.logger.info('Load balancer initialized successfully', {
        algorithm: this.config.algorithm,
        healthCheckInterval: this.config.healthCheckInterval,
      });
    } catch (error) {
      this.logger.error('Failed to initialize load balancer:', error);
      throw error;
    }
  }

  // Register a new instance
  registerInstance(id, endpoint, options = {}) {
    const instance = {
      id,
      endpoint,
      weight: options.weight || 1,
      maxConnections: options.maxConnections || 100,
      currentConnections: 0,
      healthy: true,
      lastHealthCheck: null,
      healthCheckFailures: 0,
      responseTime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      circuitBreakerState: 'closed', // closed, open, half-open
      circuitBreakerFailures: 0,
      circuitBreakerLastFailure: null,
      metadata: options.metadata || {},
      created: Date.now(),
    };

    this.instances.set(id, instance);
    this.logger.info(`Registered instance: ${id}`, {
      endpoint,
      weight: instance.weight,
    });

    return instance;
  }

  // Unregister an instance
  unregisterInstance(id) {
    const instance = this.instances.get(id);
    if (instance) {
      this.instances.delete(id);
      this.logger.info(`Unregistered instance: ${id}`);
      return true;
    }
    return false;
  }

  // Get next available instance based on load balancing algorithm
  getNextInstance(requestContext = {}) {
    const healthyInstances = Array.from(this.instances.values()).filter(
      instance => this._isInstanceAvailable(instance)
    );

    if (healthyInstances.length === 0) {
      throw new Error('No healthy instances available');
    }

    let selectedInstance;

    switch (this.config.algorithm) {
      case 'round_robin':
        selectedInstance = this._roundRobinSelection(healthyInstances);
        break;
      case 'weighted_round_robin':
        selectedInstance = this._weightedRoundRobinSelection(healthyInstances);
        break;
      case 'least_connections':
        selectedInstance = this._leastConnectionsSelection(healthyInstances);
        break;
      case 'health_based':
        selectedInstance = this._healthBasedSelection(healthyInstances);
        break;
      case 'response_time':
        selectedInstance = this._responseTimeSelection(healthyInstances);
        break;
      default:
        selectedInstance = this._roundRobinSelection(healthyInstances);
    }

    // Increment connection count
    selectedInstance.currentConnections++;

    return selectedInstance;
  }

  // Execute request with load balancing and retries
  async executeRequest(requestHandler, requestContext = {}) {
    if (!this.initialized) {
      throw new Error('Load balancer not initialized');
    }

    const startTime = Date.now();
    this.stats.totalRequests++;

    let lastError;
    let attempts = 0;
    const maxAttempts = this.config.maxRetries + 1;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const instance = this.getNextInstance(requestContext);
        const requestStart = Date.now();

        try {
          const result = await this._executeWithCircuitBreaker(
            instance,
            requestHandler,
            requestContext
          );

          const responseTime = Date.now() - requestStart;
          this._recordSuccess(instance, responseTime);
          this._updateStats(true, Date.now() - startTime);

          return result;
        } catch (error) {
          const responseTime = Date.now() - requestStart;
          this._recordFailure(instance, error, responseTime);

          if (attempts >= maxAttempts) {
            this._updateStats(false, Date.now() - startTime);
            throw error;
          }

          lastError = error;

          // Wait before retry
          if (this.config.retryDelay > 0) {
            await new Promise(resolve =>
              setTimeout(resolve, this.config.retryDelay)
            );
          }
        }
      } catch (error) {
        if (error.message === 'No healthy instances available') {
          this._updateStats(false, Date.now() - startTime);
          throw error;
        }
        lastError = error;
      }
    }

    this._updateStats(false, Date.now() - startTime);
    throw lastError || new Error('All retry attempts failed');
  }

  // Get load balancer statistics
  getStats() {
    const instanceStats = Array.from(this.instances.values()).map(instance => ({
      id: instance.id,
      endpoint: instance.endpoint,
      healthy: instance.healthy,
      weight: instance.weight,
      currentConnections: instance.currentConnections,
      totalRequests: instance.totalRequests,
      successfulRequests: instance.successfulRequests,
      failedRequests: instance.failedRequests,
      responseTime: instance.responseTime,
      circuitBreakerState: instance.circuitBreakerState,
      lastHealthCheck: instance.lastHealthCheck,
    }));

    return {
      algorithm: this.config.algorithm,
      totalInstances: this.instances.size,
      healthyInstances: instanceStats.filter(i => i.healthy).length,
      ...this.stats,
      instances: instanceStats,
    };
  }

  async getHealth() {
    const stats = this.getStats();
    const healthyRatio =
      stats.totalInstances > 0
        ? stats.healthyInstances / stats.totalInstances
        : 0;

    return {
      healthy: this.initialized && healthyRatio >= 0.5, // At least 50% instances healthy
      stats,
      healthyRatio,
      circuitBreakers: this._getCircuitBreakerStatus(),
    };
  }

  async shutdown() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
    }

    this.instances.clear();
    this.initialized = false;
    this.logger.info('Load balancer shutdown complete');
  }

  // Private methods

  _isInstanceAvailable(instance) {
    return (
      instance.healthy &&
      instance.circuitBreakerState !== 'open' &&
      instance.currentConnections < instance.maxConnections
    );
  }

  _roundRobinSelection(instances) {
    const instance = instances[this.roundRobinIndex % instances.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % instances.length;
    return instance;
  }

  _weightedRoundRobinSelection(instances) {
    const totalWeight = instances.reduce(
      (sum, instance) => sum + instance.weight,
      0
    );
    let random = Math.random() * totalWeight;

    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }

    return instances[0]; // Fallback
  }

  _leastConnectionsSelection(instances) {
    return instances.reduce((least, instance) =>
      instance.currentConnections < least.currentConnections ? instance : least
    );
  }

  _healthBasedSelection(instances) {
    // Score based on health metrics
    const scoredInstances = instances.map(instance => {
      let score = 1.0;

      // Penalize high connection count
      const connectionRatio =
        instance.currentConnections / instance.maxConnections;
      score *= 1 - connectionRatio * 0.5;

      // Penalize high response time
      if (instance.responseTime > 0) {
        const responseTimeScore = Math.max(0, 1 - instance.responseTime / 5000); // 5s baseline
        score *= responseTimeScore;
      }

      // Reward high success rate
      if (instance.totalRequests > 0) {
        const successRate =
          instance.successfulRequests / instance.totalRequests;
        score *= successRate;
      }

      return { instance, score };
    });

    // Select instance with highest score
    const best = scoredInstances.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    return best.instance;
  }

  _responseTimeSelection(instances) {
    // Select instance with lowest response time
    return instances.reduce((fastest, instance) => {
      if (instance.responseTime === 0) return fastest;
      if (fastest.responseTime === 0) return instance;
      return instance.responseTime < fastest.responseTime ? instance : fastest;
    });
  }

  async _executeWithCircuitBreaker(instance, requestHandler, requestContext) {
    // Check circuit breaker state
    if (instance.circuitBreakerState === 'open') {
      if (
        Date.now() - instance.circuitBreakerLastFailure <
        this.config.circuitBreaker.recoveryTimeout
      ) {
        throw new Error(`Circuit breaker open for instance ${instance.id}`);
      } else {
        // Try to recover
        instance.circuitBreakerState = 'half-open';
        this.logger.info(
          `Circuit breaker half-open for instance ${instance.id}`
        );
      }
    }

    try {
      const result = await requestHandler(instance, requestContext);

      // Reset circuit breaker on success
      if (instance.circuitBreakerState === 'half-open') {
        instance.circuitBreakerState = 'closed';
        instance.circuitBreakerFailures = 0;
        this.logger.info(`Circuit breaker closed for instance ${instance.id}`);
      }

      return result;
    } catch (error) {
      // Handle circuit breaker failure
      if (this.config.circuitBreaker.enabled) {
        instance.circuitBreakerFailures++;
        instance.circuitBreakerLastFailure = Date.now();

        if (
          instance.circuitBreakerFailures >=
          this.config.circuitBreaker.failureThreshold
        ) {
          instance.circuitBreakerState = 'open';
          this.logger.warn(
            `Circuit breaker opened for instance ${instance.id}`,
            {
              failures: instance.circuitBreakerFailures,
              threshold: this.config.circuitBreaker.failureThreshold,
            }
          );
        }
      }

      throw error;
    } finally {
      // Decrement connection count
      instance.currentConnections = Math.max(
        0,
        instance.currentConnections - 1
      );
    }
  }

  _recordSuccess(instance, responseTime) {
    instance.totalRequests++;
    instance.successfulRequests++;
    instance.responseTime = this._updateMovingAverage(
      instance.responseTime,
      responseTime,
      10
    );

    // Record metrics
    if (this.metrics.initialized) {
      this.metrics.recordCustomMetric('lb_instance_requests', 1, 'counter', {
        instance_id: instance.id,
        status: 'success',
      });
      this.metrics.recordCustomMetric(
        'lb_instance_response_time',
        responseTime,
        'gauge',
        {
          instance_id: instance.id,
        }
      );
    }
  }

  _recordFailure(instance, error, responseTime) {
    instance.totalRequests++;
    instance.failedRequests++;

    // Record metrics
    if (this.metrics.initialized) {
      this.metrics.recordCustomMetric('lb_instance_requests', 1, 'counter', {
        instance_id: instance.id,
        status: 'error',
      });
    }

    this.logger.warn(`Request failed for instance ${instance.id}:`, {
      error: error.message,
      responseTime,
      endpoint: instance.endpoint,
    });
  }

  _updateStats(success, responseTime) {
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    this.stats.totalResponseTime += responseTime;
    this.stats.avgResponseTime =
      this.stats.totalResponseTime / this.stats.totalRequests;
  }

  _updateMovingAverage(currentAvg, newValue, windowSize) {
    if (currentAvg === 0) return newValue;
    return (currentAvg * (windowSize - 1) + newValue) / windowSize;
  }

  _startHealthChecks() {
    this.healthCheckTimer = setInterval(async () => {
      await this._performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  _startRecoveryChecks() {
    this.recoveryTimer = setInterval(async () => {
      await this._performRecoveryChecks();
    }, this.config.recoveryCheckInterval);
  }

  async _performHealthChecks() {
    const promises = Array.from(this.instances.values()).map(instance =>
      this._checkInstanceHealth(instance)
    );

    await Promise.allSettled(promises);
  }

  async _checkInstanceHealth(instance) {
    try {
      const start = Date.now();

      // Simple HTTP health check
      const healthResponse = await fetch(`${instance.endpoint}/health`, {
        method: 'GET',
        timeout: this.config.healthCheckTimeout,
      });

      const responseTime = Date.now() - start;
      const isHealthy = healthResponse.ok;

      if (isHealthy) {
        instance.healthCheckFailures = 0;
        if (!instance.healthy) {
          instance.healthy = true;
          this.logger.info(`Instance ${instance.id} recovered`);
        }
      } else {
        instance.healthCheckFailures++;
        if (instance.healthCheckFailures >= this.config.unhealthyThreshold) {
          instance.healthy = false;
          this.logger.warn(`Instance ${instance.id} marked as unhealthy`, {
            failures: instance.healthCheckFailures,
            statusCode: healthResponse.status,
          });
        }
      }

      instance.lastHealthCheck = Date.now();
      instance.responseTime = this._updateMovingAverage(
        instance.responseTime,
        responseTime,
        5
      );
    } catch (error) {
      instance.healthCheckFailures++;
      if (instance.healthCheckFailures >= this.config.unhealthyThreshold) {
        instance.healthy = false;
        this.logger.warn(
          `Instance ${instance.id} health check failed:`,
          error.message
        );
      }
      instance.lastHealthCheck = Date.now();
    }
  }

  async _performRecoveryChecks() {
    // Check if circuit breakers can be recovered
    for (const instance of this.instances.values()) {
      if (instance.circuitBreakerState === 'open') {
        if (
          Date.now() - instance.circuitBreakerLastFailure >=
          this.config.circuitBreaker.recoveryTimeout
        ) {
          instance.circuitBreakerState = 'half-open';
          this.logger.info(
            `Circuit breaker recovery attempt for instance ${instance.id}`
          );
        }
      }
    }
  }

  _getCircuitBreakerStatus() {
    const status = {};
    for (const [id, instance] of this.instances.entries()) {
      status[id] = {
        state: instance.circuitBreakerState,
        failures: instance.circuitBreakerFailures,
        lastFailure: instance.circuitBreakerLastFailure,
      };
    }
    return status;
  }
}

module.exports = { LoadBalancer };
