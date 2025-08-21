/**
 * Resilience Orchestrator - Advanced reliability patterns
 * Generation 2: Enterprise-grade resilience with self-healing capabilities
 */

const { EventEmitter } = require('events');
const { Logger } = require('../utils/logger');

class ResilienceOrchestrator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.logger = new Logger({ service: 'ResilienceOrchestrator' });

    this.circuitBreakers = new Map();
    this.bulkheads = new Map();
    this.retryPolicies = new Map();
    this.healthChecks = new Map();

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      circuitBreakerTrips: 0,
      retryAttempts: 0,
      lastResetTime: Date.now(),
    };

    this.initializeDefaultPolicies();
    this.startHealthMonitoring();
  }

  // Initialize default resilience policies
  initializeDefaultPolicies() {
    // Default circuit breaker configurations
    this.addCircuitBreaker('default', {
      failureThreshold: 5,
      timeoutThreshold: 10000,
      resetTimeout: 60000,
      monitoringPeriod: 10000,
    });

    this.addCircuitBreaker('external-api', {
      failureThreshold: 3,
      timeoutThreshold: 5000,
      resetTimeout: 30000,
      monitoringPeriod: 5000,
    });

    this.addCircuitBreaker('database', {
      failureThreshold: 2,
      timeoutThreshold: 3000,
      resetTimeout: 20000,
      monitoringPeriod: 3000,
    });

    // Default retry policies
    this.addRetryPolicy('default', {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
    });

    this.addRetryPolicy('external-api', {
      maxAttempts: 3,
      baseDelay: 500,
      maxDelay: 5000,
      backoffMultiplier: 1.5,
      jitter: true,
    });

    this.addRetryPolicy('database', {
      maxAttempts: 5,
      baseDelay: 100,
      maxDelay: 2000,
      backoffMultiplier: 2,
      jitter: false,
    });

    // Default bulkheads
    this.addBulkhead('default', {
      maxConcurrent: 100,
      maxQueue: 200,
      timeout: 30000,
    });

    this.addBulkhead('database', {
      maxConcurrent: 20,
      maxQueue: 50,
      timeout: 10000,
    });
  }

  // Add circuit breaker
  addCircuitBreaker(name, config) {
    const circuitBreaker = new CircuitBreaker(name, config, this.logger);
    circuitBreaker.on('open', () => this.handleCircuitBreakerOpen(name));
    circuitBreaker.on('halfOpen', () =>
      this.handleCircuitBreakerHalfOpen(name)
    );
    circuitBreaker.on('closed', () => this.handleCircuitBreakerClosed(name));

    this.circuitBreakers.set(name, circuitBreaker);
    this.logger.info(`Added circuit breaker: ${name}`);
  }

  // Add retry policy
  addRetryPolicy(name, config) {
    this.retryPolicies.set(name, new RetryPolicy(name, config, this.logger));
    this.logger.info(`Added retry policy: ${name}`);
  }

  // Add bulkhead
  addBulkhead(name, config) {
    this.bulkheads.set(name, new Bulkhead(name, config, this.logger));
    this.logger.info(`Added bulkhead: ${name}`);
  }

  // Execute operation with resilience patterns
  async executeWithResilience(operation, options = {}) {
    const {
      name = 'default-operation',
      circuitBreakerName = 'default',
      retryPolicyName = 'default',
      bulkheadName = 'default',
      timeout = 30000,
    } = options;

    this.metrics.totalRequests++;

    try {
      // Get resilience components
      const circuitBreaker = this.circuitBreakers.get(circuitBreakerName);
      const retryPolicy = this.retryPolicies.get(retryPolicyName);
      const bulkhead = this.bulkheads.get(bulkheadName);

      if (!circuitBreaker || !retryPolicy || !bulkhead) {
        throw new Error('Resilience components not found');
      }

      // Execute with bulkhead isolation
      const result = await bulkhead.execute(async () => {
        // Execute with circuit breaker protection
        return await circuitBreaker.execute(async () => {
          // Execute with retry policy
          return await retryPolicy.execute(operation, { timeout });
        });
      });

      this.metrics.successfulRequests++;
      this.emit('operationSuccess', { name, result });
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.emit('operationFailure', { name, error: error.message });
      throw error;
    }
  }

  // Handle circuit breaker state changes
  handleCircuitBreakerOpen(name) {
    this.metrics.circuitBreakerTrips++;
    this.logger.warn(`Circuit breaker opened: ${name}`);
    this.emit('circuitBreakerOpen', { name });
  }

  handleCircuitBreakerHalfOpen(name) {
    this.logger.info(`Circuit breaker half-open: ${name}`);
    this.emit('circuitBreakerHalfOpen', { name });
  }

  handleCircuitBreakerClosed(name) {
    this.logger.info(`Circuit breaker closed: ${name}`);
    this.emit('circuitBreakerClosed', { name });
  }

  // Start health monitoring
  startHealthMonitoring() {
    const interval = this.config.healthCheckInterval || 30000;

    setInterval(() => {
      this.performHealthChecks();
    }, interval);
  }

  // Perform health checks on all components
  async performHealthChecks() {
    const healthResults = {};

    // Check circuit breakers
    for (const [name, circuitBreaker] of this.circuitBreakers) {
      healthResults[`circuitBreaker_${name}`] = {
        healthy: circuitBreaker.state !== 'open',
        state: circuitBreaker.state,
        failures: circuitBreaker.failures,
        lastFailureTime: circuitBreaker.lastFailureTime,
      };
    }

    // Check bulkheads
    for (const [name, bulkhead] of this.bulkheads) {
      healthResults[`bulkhead_${name}`] = {
        healthy: bulkhead.getCurrentLoad() < 0.9,
        currentLoad: bulkhead.getCurrentLoad(),
        activeRequests: bulkhead.activeRequests,
        queuedRequests: bulkhead.queuedRequests,
      };
    }

    this.emit('healthCheck', {
      results: healthResults,
      timestamp: new Date().toISOString(),
    });
  }

  // Get resilience metrics
  getMetrics() {
    const uptime = Date.now() - this.metrics.lastResetTime;
    const successRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
        : 100;

    return {
      ...this.metrics,
      successRate,
      uptime,
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(
        ([name, cb]) => ({
          name,
          state: cb.state,
          failures: cb.failures,
          healthy: cb.state !== 'open',
        })
      ),
      bulkheads: Array.from(this.bulkheads.entries()).map(([name, bh]) => ({
        name,
        load: bh.getCurrentLoad(),
        active: bh.activeRequests,
        queued: bh.queuedRequests,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  // Reset metrics
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      circuitBreakerTrips: 0,
      retryAttempts: 0,
      lastResetTime: Date.now(),
    };
  }
}

// Circuit Breaker implementation
class CircuitBreaker extends EventEmitter {
  constructor(name, config, logger) {
    super();
    this.name = name;
    this.config = config;
    this.logger = logger;

    this.state = 'closed'; // closed, open, half-open
    this.failures = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  async execute(operation) {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(`Circuit breaker ${this.name} is open`);
      }
      this.state = 'half-open';
      this.emit('halfOpen');
    }

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  async executeWithTimeout(operation) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(`Operation timeout after ${this.config.timeoutThreshold}ms`)
        );
      }, this.config.timeoutThreshold);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  onSuccess() {
    this.failures = 0;
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.emit('closed');
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      this.nextAttemptTime = Date.now() + this.config.resetTimeout;
      this.emit('open');
    }
  }
}

// Retry Policy implementation
class RetryPolicy {
  constructor(name, config, logger) {
    this.name = name;
    this.config = config;
    this.logger = logger;
  }

  async execute(operation) {
    let lastError;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === this.config.maxAttempts) {
          break;
        }

        const delay = this.calculateDelay(attempt);
        this.logger.debug(
          `Retry attempt ${attempt} for ${this.name} after ${delay}ms`
        );

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  calculateDelay(attempt) {
    let delay =
      this.config.baseDelay *
      Math.pow(this.config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, this.config.maxDelay);

    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Bulkhead implementation
class Bulkhead {
  constructor(name, config, logger) {
    this.name = name;
    this.config = config;
    this.logger = logger;

    this.activeRequests = 0;
    this.queuedRequests = 0;
    this.queue = [];
  }

  async execute(operation) {
    return new Promise((resolve, reject) => {
      const request = { operation, resolve, reject, timestamp: Date.now() };

      if (this.activeRequests < this.config.maxConcurrent) {
        this.executeRequest(request);
      } else if (this.queuedRequests < this.config.maxQueue) {
        this.queue.push(request);
        this.queuedRequests++;
      } else {
        reject(new Error(`Bulkhead ${this.name} is full`));
      }
    });
  }

  async executeRequest(request) {
    this.activeRequests++;

    const timeout = setTimeout(() => {
      request.reject(
        new Error(`Bulkhead timeout after ${this.config.timeout}ms`)
      );
    }, this.config.timeout);

    try {
      const result = await request.operation();
      clearTimeout(timeout);
      request.resolve(result);
    } catch (error) {
      clearTimeout(timeout);
      request.reject(error);
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  processQueue() {
    if (
      this.queue.length > 0 &&
      this.activeRequests < this.config.maxConcurrent
    ) {
      const request = this.queue.shift();
      this.queuedRequests--;
      this.executeRequest(request);
    }
  }

  getCurrentLoad() {
    return (
      (this.activeRequests + this.queuedRequests) /
      (this.config.maxConcurrent + this.config.maxQueue)
    );
  }
}

module.exports = {
  ResilienceOrchestrator,
  CircuitBreaker,
  RetryPolicy,
  Bulkhead,
};
