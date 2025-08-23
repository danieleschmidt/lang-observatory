/**
 * Quantum Task Planner Error Handler
 * Comprehensive error handling and recovery for quantum planning operations
 */

const { Logger } = require('../utils/logger');

class QuantumErrorHandler {
  constructor(config = {}) {
    this.logger = new Logger({ component: 'QuantumErrorHandler' });
    this.config = config;

    // Error classification and recovery strategies
    this.errorClasses = new Map([
      [
        'QUANTUM_COHERENCE_LOSS',
        { severity: 'high', recovery: 'reinitialize', retryable: true },
      ],
      [
        'SUPERPOSITION_COLLAPSE',
        { severity: 'medium', recovery: 'recalculate', retryable: true },
      ],
      [
        'ENTANGLEMENT_BROKEN',
        { severity: 'medium', recovery: 'redistribute', retryable: true },
      ],
      [
        'RESOURCE_EXHAUSTION',
        { severity: 'high', recovery: 'throttle', retryable: false },
      ],
      [
        'TASK_VALIDATION_FAILED',
        { severity: 'low', recovery: 'sanitize', retryable: true },
      ],
      [
        'SCHEDULING_CONFLICT',
        { severity: 'medium', recovery: 'replan', retryable: true },
      ],
      [
        'PREDICTION_ACCURACY_LOW',
        { severity: 'low', recovery: 'fallback', retryable: true },
      ],
      [
        'SYSTEM_OVERLOAD',
        { severity: 'high', recovery: 'circuit_break', retryable: false },
      ],
    ]);

    // Circuit breaker state
    this.circuitBreaker = {
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      failures: 0,
      threshold: config.circuitBreakerThreshold || 5,
      timeout: config.circuitBreakerTimeout || 30000,
      lastFailure: null,
    };

    // Recovery metrics
    this.recoveryMetrics = {
      totalErrors: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      circuitBreakerActivations: 0,
    };
  }

  /**
   * Handle quantum planning errors with intelligent recovery
   */
  async handleQuantumError(error, context = {}) {
    try {
      this.recoveryMetrics.totalErrors++;

      // Classify error type
      const errorClass = this.classifyError(error, context);
      const errorInfo = this.errorClasses.get(errorClass) || {
        severity: 'unknown',
        recovery: 'fallback',
        retryable: false,
      };

      this.logger.error(`Quantum error classified as ${errorClass}:`, {
        error: error.message,
        severity: errorInfo.severity,
        context,
        stackTrace: error.stack,
      });

      // Check circuit breaker state
      if (this.circuitBreaker.state === 'OPEN') {
        if (this.shouldTryHalfOpen()) {
          this.circuitBreaker.state = 'HALF_OPEN';
          this.logger.info('Circuit breaker attempting half-open state');
        } else {
          throw new Error(
            'Circuit breaker is OPEN - quantum operations temporarily disabled'
          );
        }
      }

      // Apply recovery strategy
      const recoveryResult = await this.applyRecoveryStrategy(
        errorClass,
        errorInfo,
        error,
        context
      );

      // Update circuit breaker based on recovery result
      this.updateCircuitBreaker(recoveryResult.success);

      if (recoveryResult.success) {
        this.recoveryMetrics.successfulRecoveries++;
        this.logger.info(
          `Successfully recovered from ${errorClass} using ${errorInfo.recovery}`
        );
        return recoveryResult.result;
      } else {
        this.recoveryMetrics.failedRecoveries++;
        throw new Error(
          `Recovery failed for ${errorClass}: ${recoveryResult.error}`
        );
      }
    } catch (recoveryError) {
      this.logger.error('Error recovery failed:', recoveryError);
      throw recoveryError;
    }
  }

  /**
   * Classify error based on type and context
   */
  classifyError(error, context) {
    const message = error.message.toLowerCase();
    const stack = error.stack || '';

    // Pattern matching for error classification
    if (message.includes('coherence') || message.includes('quantum state')) {
      return 'QUANTUM_COHERENCE_LOSS';
    } else if (
      message.includes('superposition') ||
      message.includes('collapse')
    ) {
      return 'SUPERPOSITION_COLLAPSE';
    } else if (
      message.includes('entanglement') ||
      message.includes('dependency')
    ) {
      return 'ENTANGLEMENT_BROKEN';
    } else if (message.includes('resource') && message.includes('exhausted')) {
      return 'RESOURCE_EXHAUSTION';
    } else if (message.includes('validation') || message.includes('invalid')) {
      return 'TASK_VALIDATION_FAILED';
    } else if (message.includes('schedule') || message.includes('conflict')) {
      return 'SCHEDULING_CONFLICT';
    } else if (message.includes('prediction') || message.includes('accuracy')) {
      return 'PREDICTION_ACCURACY_LOW';
    } else if (context.systemLoad > 0.9 || message.includes('overload')) {
      return 'SYSTEM_OVERLOAD';
    }

    // Check context for additional clues
    if (context.quantumState && context.quantumState.coherence < 0.5) {
      return 'QUANTUM_COHERENCE_LOSS';
    }

    if (context.resourceUtilization) {
      const avgUtil =
        Object.values(context.resourceUtilization).reduce((a, b) => a + b, 0) /
        Object.keys(context.resourceUtilization).length;
      if (avgUtil > 0.95) {
        return 'RESOURCE_EXHAUSTION';
      }
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Apply recovery strategy based on error classification
   */
  async applyRecoveryStrategy(errorClass, errorInfo, originalError, context) {
    const strategy = errorInfo.recovery;

    try {
      switch (strategy) {
        case 'reinitialize':
          return await this.reinitializeQuantumState(context);

        case 'recalculate':
          return await this.recalculateSuperposition(context);

        case 'redistribute':
          return await this.redistributeEntanglement(context);

        case 'throttle':
          return await this.throttleOperations(context);

        case 'sanitize':
          return await this.sanitizeTaskData(context);

        case 'replan':
          return await this.replanTasks(context);

        case 'fallback':
          return await this.fallbackToClassical(context);

        case 'circuit_break':
          return await this.activateCircuitBreaker(context);

        default:
          return await this.fallbackToClassical(context);
      }
    } catch (recoveryError) {
      return { success: false, error: recoveryError.message };
    }
  }

  /**
   * Recovery strategy implementations
   */
  async reinitializeQuantumState(context) {
    this.logger.info('Reinitializing quantum state...');

    try {
      // Reset quantum state to baseline
      const newState = {
        superposition: new Map(),
        entanglement: new Map(),
        coherence: 1.0,
        initialized: true,
      };

      // Validate new state
      if (this.validateQuantumState(newState)) {
        return {
          success: true,
          result: { quantumState: newState, action: 'reinitialized' },
        };
      } else {
        return {
          success: false,
          error: 'Failed to validate reinitialized state',
        };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async recalculateSuperposition(context) {
    this.logger.info('Recalculating quantum superposition...');

    try {
      // Simplified recalculation with reduced complexity
      const simplifiedTasks = this.simplifyTasks(context.tasks || []);
      const newSuperposition = this.createBasicSuperposition(simplifiedTasks);

      return {
        success: true,
        result: { superposition: newSuperposition, action: 'recalculated' },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async redistributeEntanglement(context) {
    this.logger.info('Redistributing quantum entanglement...');

    try {
      // Break existing entanglements and create new ones with lower thresholds
      const reducedThreshold = (context.threshold || 0.7) * 0.8;
      const newEntanglements = this.createLooseEntanglements(
        context.tasks || [],
        reducedThreshold
      );

      return {
        success: true,
        result: { entanglements: newEntanglements, action: 'redistributed' },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async throttleOperations(context) {
    this.logger.info('Throttling quantum operations...');

    try {
      // Reduce operation complexity and frequency
      const throttledConfig = {
        maxConcurrency: Math.max(
          1,
          Math.floor((context.maxConcurrency || 4) / 2)
        ),
        batchSize: Math.max(1, Math.floor((context.batchSize || 10) / 2)),
        throttleDelay: (context.throttleDelay || 100) * 2,
      };

      // Wait before proceeding
      await new Promise(resolve =>
        setTimeout(resolve, throttledConfig.throttleDelay)
      );

      return {
        success: true,
        result: { throttledConfig, action: 'throttled' },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sanitizeTaskData(context) {
    this.logger.info('Sanitizing task data...');

    try {
      const sanitizedTasks = (context.tasks || []).map(task => ({
        id: this.sanitizeId(task.id),
        priority: Math.max(0, Math.min(1, task.priority || 0.5)),
        estimatedDuration: Math.max(1, task.estimatedDuration || 60),
        requiredResources: this.sanitizeResources(task.requiredResources || []),
        type: this.sanitizeString(task.type || 'unknown'),
        complexity: this.sanitizeComplexity(task.complexity),
      }));

      return {
        success: true,
        result: { sanitizedTasks, action: 'sanitized' },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async replanTasks(context) {
    this.logger.info('Replanning tasks with simplified approach...');

    try {
      // Use classical planning as fallback
      const classicalPlan = this.createClassicalPlan(context.tasks || []);

      return {
        success: true,
        result: { plan: classicalPlan, action: 'replanned' },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async fallbackToClassical(context) {
    this.logger.info('Falling back to classical planning...');

    try {
      // Simple sequential planning
      const tasks = context.tasks || [];
      const classicalPlan = {
        phases: tasks.map((task, index) => ({
          tasks: [{ id: task.id, task }],
          duration: task.estimatedDuration || 60,
          resources: new Map(),
        })),
        totalDuration: tasks.reduce(
          (sum, task) => sum + (task.estimatedDuration || 60),
          0
        ),
        efficiency: 0.5, // Lower efficiency but reliable
        parallelism: 0,
      };

      return {
        success: true,
        result: { plan: classicalPlan, action: 'classical_fallback' },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async activateCircuitBreaker(context) {
    this.logger.warn('Activating circuit breaker - quantum operations halted');

    this.circuitBreaker.state = 'OPEN';
    this.circuitBreaker.lastFailure = Date.now();
    this.recoveryMetrics.circuitBreakerActivations++;

    return {
      success: false,
      error: 'Circuit breaker activated - system protection mode enabled',
    };
  }

  /**
   * Circuit breaker management
   */
  updateCircuitBreaker(wasSuccessful) {
    if (wasSuccessful) {
      this.circuitBreaker.failures = 0;
      if (this.circuitBreaker.state === 'HALF_OPEN') {
        this.circuitBreaker.state = 'CLOSED';
        this.logger.info('Circuit breaker closed - normal operations resumed');
      }
    } else {
      this.circuitBreaker.failures++;
      if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
        this.circuitBreaker.state = 'OPEN';
        this.circuitBreaker.lastFailure = Date.now();
        this.recoveryMetrics.circuitBreakerActivations++;
        this.logger.warn('Circuit breaker opened due to repeated failures');
      }
    }
  }

  shouldTryHalfOpen() {
    return (
      this.circuitBreaker.state === 'OPEN' &&
      this.circuitBreaker.lastFailure &&
      Date.now() - this.circuitBreaker.lastFailure > this.circuitBreaker.timeout
    );
  }

  /**
   * Validation and sanitization helpers
   */
  validateQuantumState(state) {
    return (
      state &&
      state.superposition instanceof Map &&
      state.entanglement instanceof Map &&
      typeof state.coherence === 'number' &&
      state.coherence >= 0 &&
      state.coherence <= 1
    );
  }

  simplifyTasks(tasks) {
    return tasks.slice(0, Math.min(tasks.length, 20)).map(task => ({
      ...task,
      complexity: 'low',
      requiredResources: (task.requiredResources || []).slice(0, 2),
    }));
  }

  createBasicSuperposition(tasks) {
    const superposition = new Map();

    tasks.forEach((task, index) => {
      superposition.set(task.id, {
        task,
        amplitude: 0.5, // Simplified amplitude
        phase: (index * Math.PI) / tasks.length,
        probability: 0.25,
        possibleStates: [
          { executionTime: task.estimatedDuration || 60, probability: 1.0 },
        ],
      });
    });

    return superposition;
  }

  createLooseEntanglements(tasks, threshold) {
    const entanglements = new Map();

    for (let i = 0; i < tasks.length - 1; i++) {
      const pairKey = `${tasks[i].id}-${tasks[i + 1].id}`;
      entanglements.set(pairKey, {
        taskA: tasks[i].id,
        taskB: tasks[i + 1].id,
        strength: threshold,
        type: 'sequential',
      });
    }

    return entanglements;
  }

  createClassicalPlan(tasks) {
    // Sort by priority
    const sortedTasks = [...tasks].sort(
      (a, b) => (b.priority || 0.5) - (a.priority || 0.5)
    );

    return {
      phases: [
        {
          tasks: sortedTasks.map(task => ({ id: task.id, task })),
          duration: Math.max(
            ...sortedTasks.map(t => t.estimatedDuration || 60)
          ),
          resources: new Map(),
        },
      ],
      totalDuration: sortedTasks.reduce(
        (sum, task) => sum + (task.estimatedDuration || 60),
        0
      ),
      efficiency: 0.6,
      parallelism: 0,
    };
  }

  sanitizeId(id) {
    return String(id || 'unknown')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .substring(0, 100);
  }

  sanitizeString(str) {
    return String(str || '')
      .replace(/[<>"'&]/g, '')
      .substring(0, 50);
  }

  sanitizeResources(resources) {
    return (Array.isArray(resources) ? resources : [])
      .filter(r => typeof r === 'string')
      .map(r => this.sanitizeString(r))
      .slice(0, 10);
  }

  sanitizeComplexity(complexity) {
    const validComplexities = ['low', 'medium', 'high'];
    return validComplexities.includes(complexity) ? complexity : 'medium';
  }

  /**
   * Get error handling metrics
   */
  getErrorMetrics() {
    return {
      ...this.recoveryMetrics,
      circuitBreakerState: this.circuitBreaker.state,
      circuitBreakerFailures: this.circuitBreaker.failures,
      errorClasses: this.errorClasses.size,
      recoverySuccessRate:
        this.recoveryMetrics.totalErrors > 0
          ? this.recoveryMetrics.successfulRecoveries /
            this.recoveryMetrics.totalErrors
          : 0,
    };
  }

  /**
   * Reset error handler state
   */
  reset() {
    this.circuitBreaker.state = 'CLOSED';
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.lastFailure = null;

    this.recoveryMetrics = {
      totalErrors: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      circuitBreakerActivations: 0,
    };

    this.logger.info('Error handler state reset');
  }
}

module.exports = { QuantumErrorHandler };
