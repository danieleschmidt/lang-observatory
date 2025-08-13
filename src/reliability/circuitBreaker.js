/**
 * Enhanced Circuit Breaker Implementation
 * Provides advanced fault tolerance and recovery mechanisms
 */

const { Logger } = require('../utils/logger');
const { EventEmitter } = require('events');

class CircuitBreaker extends EventEmitter {
  constructor(config = {}) {
    super();
    this.name = config.name || 'default';
    this.logger = new Logger({ component: `CircuitBreaker-${this.name}` });

    // Configuration
    this.failureThreshold = config.failureThreshold || 5;
    this.recoveryTimeout = config.recoveryTimeout || 60000; // 1 minute
    this.monitoringWindow = config.monitoringWindow || 120000; // 2 minutes
    this.volumeThreshold = config.volumeThreshold || 10; // Minimum requests to trip
    this.successThreshold = config.successThreshold || 3; // Successes to close

    // State tracking
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;

    // Metrics
    this.metrics = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      totalTimeouts: 0,
      totalRejections: 0,
      averageResponseTime: 0,
      requestsInWindow: [],
      stateTransitions: [],
      lastReset: new Date().toISOString(),
    };

    // Advanced features
    this.fallbackFunction = config.fallback || null;
    this.healthCheckFunction = config.healthCheck || null;
    this.adaptiveThreshold = config.adaptive || false;
    this.bulkheadEnabled = config.bulkhead || false;
    this.maxConcurrentRequests = config.maxConcurrentRequests || 100;
    this.currentRequests = 0;

    // Cleanup old metrics periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupMetrics();
    }, this.monitoringWindow / 4);

    this.initialized = true;
    this.logger.info(`Circuit breaker "${this.name}" initialized`);
  }

  async execute(operation, context = {}) {
    this.metrics.totalRequests++;
    this.trackRequest();

    // Check if we should reject due to bulkhead
    if (
      this.bulkheadEnabled &&
      this.currentRequests >= this.maxConcurrentRequests
    ) {
      this.metrics.totalRejections++;
      const error = new Error(
        `Circuit breaker "${this.name}": Too many concurrent requests`
      );
      error.code = 'CIRCUIT_BREAKER_BULKHEAD';
      this.emit('bulkheadRejection', { name: this.name, error });
      throw error;
    }

    // Check circuit state
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.trackStateTransition('HALF_OPEN', 'Attempting reset');
        this.logger.info(
          `Circuit breaker "${this.name}" attempting reset (HALF_OPEN)`
        );
        this.emit('stateChange', { name: this.name, state: 'HALF_OPEN' });
      } else {
        this.metrics.totalRejections++;
        const error = new Error(
          `Circuit breaker "${this.name}": Circuit is OPEN`
        );
        error.code = 'CIRCUIT_BREAKER_OPEN';

        // Try fallback if available
        if (this.fallbackFunction) {
          try {
            this.logger.debug(`Executing fallback for "${this.name}"`);
            const fallbackResult = await this.fallbackFunction(context);
            this.emit('fallbackExecuted', {
              name: this.name,
              result: fallbackResult,
            });
            return fallbackResult;
          } catch (fallbackError) {
            this.logger.error(
              `Fallback failed for "${this.name}":`,
              fallbackError
            );
            this.emit('fallbackFailed', {
              name: this.name,
              error: fallbackError,
            });
          }
        }

        this.emit('rejection', { name: this.name, error });
        throw error;
      }
    }

    // Execute the operation
    this.currentRequests++;
    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      this.onSuccess(duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.onFailure(error, duration);
      throw error;
    } finally {
      this.currentRequests--;
    }
  }

  onSuccess(duration) {
    this.metrics.totalSuccesses++;
    this.successes++;
    this.updateAverageResponseTime(duration);

    this.emit('success', {
      name: this.name,
      duration,
      state: this.state,
      successes: this.successes,
    });

    if (this.state === 'HALF_OPEN') {
      if (this.successes >= this.successThreshold) {
        this.reset();
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  onFailure(error, duration) {
    this.metrics.totalFailures++;
    this.failures++;
    this.lastFailureTime = Date.now();
    this.updateAverageResponseTime(duration);

    this.emit('failure', {
      name: this.name,
      error,
      duration,
      state: this.state,
      failures: this.failures,
    });

    // Check if we should trip the circuit
    if (this.shouldTrip()) {
      this.trip(error);
    }
  }

  shouldTrip() {
    // Must have minimum volume
    if (this.getRequestsInWindow() < this.volumeThreshold) {
      return false;
    }

    // Adaptive threshold based on recent performance
    let threshold = this.failureThreshold;
    if (this.adaptiveThreshold) {
      const recentFailureRate = this.getRecentFailureRate();
      threshold = Math.max(
        2,
        Math.floor(this.failureThreshold * (1 - recentFailureRate))
      );
    }

    return this.failures >= threshold;
  }

  trip(error) {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.recoveryTimeout;
    this.trackStateTransition(
      'OPEN',
      error.message || 'Failure threshold exceeded'
    );

    this.logger.warn(`Circuit breaker "${this.name}" tripped to OPEN state`);
    this.emit('stateChange', { name: this.name, state: 'OPEN', error });
    this.emit('circuitOpened', {
      name: this.name,
      error,
      failures: this.failures,
    });
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    this.trackStateTransition('CLOSED', 'Successfully reset');

    this.logger.info(`Circuit breaker "${this.name}" reset to CLOSED state`);
    this.emit('stateChange', { name: this.name, state: 'CLOSED' });
    this.emit('circuitClosed', { name: this.name });
  }

  forceOpen(reason = 'Manually forced open') {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.recoveryTimeout;
    this.trackStateTransition('OPEN', reason);

    this.logger.warn(
      `Circuit breaker "${this.name}" forced to OPEN state: ${reason}`
    );
    this.emit('stateChange', { name: this.name, state: 'OPEN', reason });
  }

  forceClose(reason = 'Manually forced close') {
    this.reset();
    this.trackStateTransition('CLOSED', reason);
    this.logger.info(
      `Circuit breaker "${this.name}" forced to CLOSED state: ${reason}`
    );
  }

  shouldAttemptReset() {
    return this.nextAttempt && Date.now() >= this.nextAttempt;
  }

  getRequestsInWindow() {
    const now = Date.now();
    return this.metrics.requestsInWindow.filter(
      timestamp => now - timestamp <= this.monitoringWindow
    ).length;
  }

  getRecentFailureRate() {
    const recentRequests = this.getRequestsInWindow();
    if (recentRequests === 0) return 0;

    const recentFailures = Math.min(this.failures, recentRequests);
    return recentFailures / recentRequests;
  }

  trackRequest() {
    this.metrics.requestsInWindow.push(Date.now());
  }

  trackStateTransition(state, reason) {
    this.metrics.stateTransitions.push({
      state,
      reason,
      timestamp: new Date().toISOString(),
      failures: this.failures,
      successes: this.successes,
    });

    // Keep only recent transitions
    if (this.metrics.stateTransitions.length > 100) {
      this.metrics.stateTransitions = this.metrics.stateTransitions.slice(-50);
    }
  }

  updateAverageResponseTime(duration) {
    const alpha = 0.1; // Exponential moving average factor
    this.metrics.averageResponseTime =
      this.metrics.averageResponseTime === 0
        ? duration
        : alpha * duration + (1 - alpha) * this.metrics.averageResponseTime;
  }

  cleanupMetrics() {
    const cutoff = Date.now() - this.monitoringWindow;
    this.metrics.requestsInWindow = this.metrics.requestsInWindow.filter(
      timestamp => timestamp > cutoff
    );
  }

  async healthCheck() {
    if (this.healthCheckFunction) {
      try {
        const healthResult = await this.healthCheckFunction();
        this.emit('healthCheck', { name: this.name, result: healthResult });
        return healthResult;
      } catch (error) {
        this.emit('healthCheckFailed', { name: this.name, error });
        return { healthy: false, error: error.message };
      }
    }

    return {
      healthy: this.state !== 'OPEN',
      state: this.state,
      failures: this.failures,
      successes: this.successes,
    };
  }

  getMetrics() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      currentRequests: this.currentRequests,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
      requestsInWindow: this.getRequestsInWindow(),
      recentFailureRate: this.getRecentFailureRate(),
      ...this.metrics,
    };
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      healthy: this.state !== 'OPEN',
      failures: this.failures,
      successes: this.successes,
      currentRequests: this.currentRequests,
      averageResponseTime: Math.round(this.metrics.averageResponseTime),
      requestsInWindow: this.getRequestsInWindow(),
      lastTransition:
        this.metrics.stateTransitions[this.metrics.stateTransitions.length - 1],
      nextAttempt: this.nextAttempt,
    };
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.removeAllListeners();
    this.logger.info(`Circuit breaker "${this.name}" shut down`);
  }
}

module.exports = { CircuitBreaker };
