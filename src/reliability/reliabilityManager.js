/**
 * Reliability Manager
 * Orchestrates circuit breakers, retry logic, timeouts, and fallback strategies
 */

const { CircuitBreaker } = require('./circuitBreaker');
const { Logger } = require('../utils/logger');
const { EventEmitter } = require('events');

class ReliabilityManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.logger = new Logger({ component: 'ReliabilityManager' });
        this.config = config;
        
        // Circuit breakers for different components
        this.circuitBreakers = new Map();
        
        // Retry configurations
        this.retryConfigs = new Map();
        
        // Timeout configurations
        this.timeoutConfigs = new Map();
        
        // Fallback strategies
        this.fallbackStrategies = new Map();
        
        // Health check functions
        this.healthChecks = new Map();
        
        // Global reliability metrics
        this.metrics = {
            totalOperations: 0,
            totalFailures: 0,
            totalRetries: 0,
            totalTimeouts: 0,
            totalFallbacks: 0,
            circuitBreakerTrips: 0,
            averageResponseTime: 0,
            startTime: new Date().toISOString()
        };
        
        this.initialized = false;
    }

    async initialize() {
        this.logger.info('Initializing Reliability Manager...');
        
        // Initialize default circuit breakers for key components
        this.setupDefaultCircuitBreakers();
        
        // Setup default retry policies
        this.setupDefaultRetryPolicies();
        
        // Setup default timeouts
        this.setupDefaultTimeouts();
        
        // Setup health monitoring
        this.setupHealthMonitoring();
        
        this.initialized = true;
        this.logger.info('Reliability Manager initialized successfully');
        
        return this;
    }

    setupDefaultCircuitBreakers() {
        const defaultConfigs = [
            {
                name: 'quantum-planner',
                failureThreshold: 5,
                recoveryTimeout: 30000,
                volumeThreshold: 10,
                adaptive: true,
                fallback: async (context) => ({
                    action: 'classical_fallback',
                    plan: this.createSimpleFallbackPlan(context.tasks || [])
                })
            },
            {
                name: 'database',
                failureThreshold: 3,
                recoveryTimeout: 60000,
                volumeThreshold: 5,
                bulkhead: true,
                maxConcurrentRequests: 50
            },
            {
                name: 'langfuse',
                failureThreshold: 5,
                recoveryTimeout: 45000,
                volumeThreshold: 8,
                fallback: async () => ({ success: true, message: 'Trace recorded locally' })
            },
            {
                name: 'openlit',
                failureThreshold: 4,
                recoveryTimeout: 30000,
                volumeThreshold: 6,
                fallback: async () => ({ success: true, message: 'Metrics cached locally' })
            }
        ];

        defaultConfigs.forEach(config => {
            this.createCircuitBreaker(config.name, config);
        });
    }

    setupDefaultRetryPolicies() {
        const retryPolicies = [
            {
                name: 'database',
                maxRetries: 3,
                initialDelay: 100,
                maxDelay: 5000,
                backoffMultiplier: 2,
                jitter: true
            },
            {
                name: 'external-api',
                maxRetries: 2,
                initialDelay: 200,
                maxDelay: 2000,
                backoffMultiplier: 1.5,
                jitter: true
            },
            {
                name: 'quantum-operation',
                maxRetries: 2,
                initialDelay: 50,
                maxDelay: 1000,
                backoffMultiplier: 2,
                jitter: false
            }
        ];

        retryPolicies.forEach(policy => {
            this.retryConfigs.set(policy.name, policy);
        });
    }

    setupDefaultTimeouts() {
        const timeouts = [
            { name: 'database', timeout: 5000 },
            { name: 'quantum-planner', timeout: 30000 },
            { name: 'langfuse', timeout: 10000 },
            { name: 'openlit', timeout: 8000 },
            { name: 'default', timeout: 15000 }
        ];

        timeouts.forEach(config => {
            this.timeoutConfigs.set(config.name, config.timeout);
        });
    }

    setupHealthMonitoring() {
        // Monitor circuit breakers
        this.circuitBreakers.forEach(cb => {
            cb.on('stateChange', (event) => {
                this.emit('circuitBreakerStateChange', event);
                if (event.state === 'OPEN') {
                    this.metrics.circuitBreakerTrips++;
                }
            });

            cb.on('fallbackExecuted', (event) => {
                this.metrics.totalFallbacks++;
                this.emit('fallbackExecuted', event);
            });
        });

        // Periodic health checks
        setInterval(async () => {
            await this.performHealthChecks();
        }, 30000); // Every 30 seconds
    }

    createCircuitBreaker(name, config = {}) {
        if (this.circuitBreakers.has(name)) {
            this.logger.warn(`Circuit breaker "${name}" already exists, updating configuration`);
            this.circuitBreakers.get(name).shutdown();
        }

        const circuitBreaker = new CircuitBreaker({
            name,
            ...config
        });

        this.circuitBreakers.set(name, circuitBreaker);
        
        // Forward circuit breaker events
        circuitBreaker.on('stateChange', (event) => {
            this.emit('circuitBreakerStateChange', event);
        });

        this.logger.info(`Circuit breaker "${name}" created`);
        return circuitBreaker;
    }

    async executeWithReliability(operation, context = {}) {
        const {
            name = 'default',
            timeout,
            retryPolicy,
            circuitBreaker = true,
            fallback
        } = context;

        this.metrics.totalOperations++;
        const startTime = Date.now();

        try {
            // Wrap with circuit breaker if enabled
            if (circuitBreaker && this.circuitBreakers.has(name)) {
                const cb = this.circuitBreakers.get(name);
                return await cb.execute(async () => {
                    return await this.executeWithRetryAndTimeout(operation, context);
                }, context);
            } else {
                return await this.executeWithRetryAndTimeout(operation, context);
            }
        } catch (error) {
            this.metrics.totalFailures++;
            
            // Try fallback if available
            if (fallback) {
                try {
                    this.logger.info(`Executing fallback for operation "${name}"`);
                    this.metrics.totalFallbacks++;
                    return await fallback(error, context);
                } catch (fallbackError) {
                    this.logger.error(`Fallback failed for operation "${name}":`, fallbackError);
                    throw fallbackError;
                }
            }
            
            throw error;
        } finally {
            const duration = Date.now() - startTime;
            this.updateAverageResponseTime(duration);
        }
    }

    async executeWithRetryAndTimeout(operation, context = {}) {
        const { name = 'default', timeout, retryPolicy } = context;
        
        // Apply timeout if specified
        const timeoutMs = timeout || this.timeoutConfigs.get(name) || this.timeoutConfigs.get('default');
        const wrappedOperation = this.withTimeout(operation, timeoutMs);
        
        // Apply retry policy if specified
        const retryConfig = typeof retryPolicy === 'string' 
            ? this.retryConfigs.get(retryPolicy)
            : retryPolicy;
        
        if (retryConfig) {
            return await this.executeWithRetry(wrappedOperation, retryConfig, context);
        } else {
            return await wrappedOperation();
        }
    }

    async executeWithRetry(operation, retryConfig, context = {}) {
        const {
            maxRetries = 3,
            initialDelay = 100,
            maxDelay = 5000,
            backoffMultiplier = 2,
            jitter = true
        } = retryConfig;

        let lastError;
        let delay = initialDelay;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await operation();
                
                if (attempt > 0) {
                    this.metrics.totalRetries += attempt;
                    this.logger.info(`Operation succeeded on attempt ${attempt + 1}`);
                }
                
                return result;
            } catch (error) {
                lastError = error;
                
                if (attempt === maxRetries) {
                    this.logger.error(`Operation failed after ${maxRetries + 1} attempts:`, error);
                    break;
                }

                // Calculate next delay with backoff and optional jitter
                let nextDelay = Math.min(delay * backoffMultiplier, maxDelay);
                if (jitter) {
                    nextDelay = nextDelay * (0.5 + Math.random() * 0.5);
                }

                this.logger.warn(`Operation failed on attempt ${attempt + 1}, retrying in ${Math.round(nextDelay)}ms:`, error.message);
                
                await this.sleep(nextDelay);
                delay = nextDelay;
            }
        }

        throw lastError;
    }

    withTimeout(operation, timeoutMs) {
        return async () => {
            return new Promise(async (resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    this.metrics.totalTimeouts++;
                    const error = new Error(`Operation timed out after ${timeoutMs}ms`);
                    error.code = 'TIMEOUT';
                    reject(error);
                }, timeoutMs);

                try {
                    const result = await operation();
                    clearTimeout(timeoutId);
                    resolve(result);
                } catch (error) {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });
        };
    }

    createSimpleFallbackPlan(tasks = []) {
        return {
            phases: tasks.map((task, index) => ({
                tasks: [{ id: task.id || `fallback-task-${index}`, task }],
                duration: task.estimatedDuration || 60,
                resources: {}
            })),
            totalDuration: tasks.reduce((sum, task) => sum + (task.estimatedDuration || 60), 0),
            efficiency: 0.5,
            parallelism: 0,
            fallback: true
        };
    }

    async performHealthChecks() {
        const healthResults = new Map();
        
        // Check circuit breakers
        for (const [name, cb] of this.circuitBreakers) {
            try {
                const health = await cb.healthCheck();
                healthResults.set(`circuitBreaker-${name}`, health);
            } catch (error) {
                healthResults.set(`circuitBreaker-${name}`, { 
                    healthy: false, 
                    error: error.message 
                });
            }
        }
        
        // Check custom health checks
        for (const [name, healthCheckFn] of this.healthChecks) {
            try {
                const health = await healthCheckFn();
                healthResults.set(`custom-${name}`, health);
            } catch (error) {
                healthResults.set(`custom-${name}`, { 
                    healthy: false, 
                    error: error.message 
                });
            }
        }
        
        this.emit('healthCheckComplete', { results: healthResults });
        return healthResults;
    }

    registerHealthCheck(name, healthCheckFn) {
        this.healthChecks.set(name, healthCheckFn);
        this.logger.info(`Health check "${name}" registered`);
    }

    getCircuitBreakerStatus(name) {
        const cb = this.circuitBreakers.get(name);
        return cb ? cb.getStatus() : null;
    }

    getAllCircuitBreakerStatus() {
        const status = {};
        for (const [name, cb] of this.circuitBreakers) {
            status[name] = cb.getStatus();
        }
        return status;
    }

    getMetrics() {
        const circuitBreakerMetrics = {};
        for (const [name, cb] of this.circuitBreakers) {
            circuitBreakerMetrics[name] = cb.getMetrics();
        }

        return {
            ...this.metrics,
            circuitBreakers: circuitBreakerMetrics,
            timestamp: new Date().toISOString()
        };
    }

    updateAverageResponseTime(duration) {
        const alpha = 0.1;
        this.metrics.averageResponseTime = 
            this.metrics.averageResponseTime === 0 
                ? duration 
                : (alpha * duration) + ((1 - alpha) * this.metrics.averageResponseTime);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async shutdown() {
        this.logger.info('Shutting down Reliability Manager...');
        
        // Shutdown all circuit breakers
        for (const [name, cb] of this.circuitBreakers) {
            cb.shutdown();
        }
        
        this.circuitBreakers.clear();
        this.retryConfigs.clear();
        this.timeoutConfigs.clear();
        this.fallbackStrategies.clear();
        this.healthChecks.clear();
        
        this.removeAllListeners();
        this.logger.info('Reliability Manager shutdown complete');
    }
}

module.exports = { ReliabilityManager };