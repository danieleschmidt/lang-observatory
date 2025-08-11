/**
 * Advanced Workload Balancer
 * Intelligent request distribution with adaptive load balancing and circuit breaking
 */

const { EventEmitter } = require('events');
const { Logger } = require('../utils/logger');
const { CircuitBreaker } = require('../reliability/circuitBreaker');

class WorkloadBalancer extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            algorithm: 'adaptive', // round-robin, least-connections, adaptive, weighted
            healthCheckInterval: 30000,
            maxConcurrentRequests: 1000,
            requestTimeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            enableCircuitBreaker: true,
            enableMetrics: true,
            enableStickySessions: false,
            sessionAffinityTTL: 3600000, // 1 hour
            ...config
        };
        
        this.logger = new Logger({ service: 'workload-balancer' });
        
        // Worker pool management
        this.workers = new Map();
        this.workerMetrics = new Map();
        this.sessionAffinity = new Map();
        this.requestQueue = [];
        
        // Load balancing state
        this.roundRobinIndex = 0;
        this.activeRequests = 0;
        this.totalRequests = 0;
        
        // Circuit breakers per worker
        this.circuitBreakers = new Map();
        
        // Performance tracking
        this.stats = {
            requestsProcessed: 0,
            requestsFailed: 0,
            averageResponseTime: 0,
            totalResponseTime: 0,
            queueLength: 0,
            activeWorkers: 0,
            failedWorkers: 0
        };
        
        // Background tasks
        this.healthCheckTimer = null;
        this.metricsTimer = null;
        this.queueProcessorTimer = null;
        
        this.initialized = false;
    }

    async initialize() {
        try {
            // Start background tasks
            this.startHealthChecks();
            this.startMetricsCollection();
            this.startQueueProcessor();
            
            this.initialized = true;
            this.logger.info(`Workload Balancer initialized with ${this.config.algorithm} algorithm`);
            
            return this;
        } catch (error) {
            this.logger.error('Failed to initialize Workload Balancer:', error);
            throw error;
        }
    }

    // Worker Management
    async addWorker(workerId, workerConfig = {}) {
        if (this.workers.has(workerId)) {
            throw new Error(`Worker ${workerId} already exists`);
        }

        const worker = {
            id: workerId,
            status: 'healthy',
            weight: workerConfig.weight || 1,
            maxConcurrent: workerConfig.maxConcurrent || 100,
            currentLoad: 0,
            totalRequests: 0,
            totalErrors: 0,
            averageResponseTime: 0,
            lastHealthCheck: Date.now(),
            config: workerConfig,
            endpoint: workerConfig.endpoint,
            handler: workerConfig.handler
        };

        this.workers.set(workerId, worker);
        
        // Initialize metrics
        this.workerMetrics.set(workerId, {
            responseTimeSamples: [],
            requestCounts: new Array(60).fill(0), // Last 60 seconds
            errorCounts: new Array(60).fill(0),
            lastMetricsUpdate: Date.now()
        });

        // Initialize circuit breaker
        if (this.config.enableCircuitBreaker) {
            this.circuitBreakers.set(workerId, new CircuitBreaker({
                name: `worker-${workerId}`,
                errorThreshold: 5,
                resetTimeout: 60000,
                monitoringPeriod: 30000
            }));
            
            await this.circuitBreakers.get(workerId).initialize();
        }

        this.logger.info(`Added worker: ${workerId}`);
        this.emit('workerAdded', { workerId, worker });
        
        return worker;
    }

    async removeWorker(workerId) {
        const worker = this.workers.get(workerId);
        if (!worker) {
            throw new Error(`Worker ${workerId} not found`);
        }

        // Gracefully drain existing requests
        await this.drainWorker(workerId);
        
        // Cleanup
        this.workers.delete(workerId);
        this.workerMetrics.delete(workerId);
        
        if (this.circuitBreakers.has(workerId)) {
            await this.circuitBreakers.get(workerId).shutdown();
            this.circuitBreakers.delete(workerId);
        }

        this.logger.info(`Removed worker: ${workerId}`);
        this.emit('workerRemoved', { workerId });
    }

    async drainWorker(workerId, timeout = 30000) {
        const worker = this.workers.get(workerId);
        if (!worker) return;

        worker.status = 'draining';
        const startTime = Date.now();

        // Wait for current requests to complete
        while (worker.currentLoad > 0 && Date.now() - startTime < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (worker.currentLoad > 0) {
            this.logger.warn(`Worker ${workerId} still has ${worker.currentLoad} active requests after drain timeout`);
        }
    }

    // Request Processing
    async processRequest(request, options = {}) {
        if (!this.initialized) {
            throw new Error('Workload Balancer not initialized');
        }

        const requestId = options.requestId || this.generateRequestId();
        const startTime = Date.now();

        this.totalRequests++;
        this.activeRequests++;
        this.stats.queueLength = this.requestQueue.length;

        try {
            // Check rate limits
            if (this.activeRequests > this.config.maxConcurrentRequests) {
                throw new WorkloadError('Maximum concurrent requests exceeded', 'RATE_LIMIT');
            }

            // Select worker
            const worker = await this.selectWorker(request, options);
            if (!worker) {
                throw new WorkloadError('No healthy workers available', 'NO_WORKERS');
            }

            // Process request with circuit breaker protection
            const result = await this.executeRequest(worker, request, requestId, options);
            
            // Record success metrics
            const responseTime = Date.now() - startTime;
            this.recordRequestSuccess(worker.id, responseTime);
            
            this.stats.requestsProcessed++;
            this.stats.totalResponseTime += responseTime;
            this.stats.averageResponseTime = this.stats.totalResponseTime / this.stats.requestsProcessed;

            this.emit('requestCompleted', { requestId, workerId: worker.id, responseTime, success: true });
            
            return result;

        } catch (error) {
            // Record failure metrics
            const responseTime = Date.now() - startTime;
            this.recordRequestFailure(error.workerId, responseTime, error);
            
            this.stats.requestsFailed++;
            this.emit('requestCompleted', { requestId, workerId: error.workerId, responseTime, success: false, error });
            
            // Retry logic
            if (options.retryCount < this.config.retryAttempts && this.shouldRetry(error)) {
                await this.delay(this.config.retryDelay * Math.pow(2, options.retryCount)); // Exponential backoff
                return this.processRequest(request, { 
                    ...options, 
                    retryCount: (options.retryCount || 0) + 1 
                });
            }
            
            throw error;

        } finally {
            this.activeRequests--;
        }
    }

    async executeRequest(worker, request, requestId, options) {
        const circuitBreaker = this.circuitBreakers.get(worker.id);
        
        // Execute with circuit breaker if enabled
        const executeFunction = async () => {
            worker.currentLoad++;
            worker.totalRequests++;
            
            try {
                let result;
                
                if (worker.handler && typeof worker.handler === 'function') {
                    // Execute handler function
                    result = await Promise.race([
                        worker.handler(request, options),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Request timeout')), this.config.requestTimeout)
                        )
                    ]);
                } else if (worker.endpoint) {
                    // Make HTTP request (simulated)
                    result = await this.makeHttpRequest(worker.endpoint, request, options);
                } else {
                    throw new Error('Worker has no handler or endpoint configured');
                }
                
                return result;
                
            } finally {
                worker.currentLoad--;
            }
        };

        if (circuitBreaker && this.config.enableCircuitBreaker) {
            try {
                return await circuitBreaker.execute(executeFunction);
            } catch (error) {
                error.workerId = worker.id;
                throw error;
            }
        } else {
            try {
                return await executeFunction();
            } catch (error) {
                error.workerId = worker.id;
                throw error;
            }
        }
    }

    async makeHttpRequest(endpoint, request, options) {
        // Simulate HTTP request - in real implementation would use fetch/axios
        await this.delay(Math.random() * 100 + 50); // Simulate network latency
        
        // Simulate occasional failures
        if (Math.random() < 0.05) { // 5% failure rate
            throw new Error('Simulated network error');
        }
        
        return {
            status: 'success',
            data: request,
            endpoint,
            timestamp: new Date().toISOString()
        };
    }

    // Worker Selection Strategies
    async selectWorker(request, options = {}) {
        const availableWorkers = this.getHealthyWorkers();
        
        if (availableWorkers.length === 0) {
            return null;
        }

        // Check session affinity
        if (this.config.enableStickySessions && options.sessionId) {
            const affinityWorker = this.getSessionAffinityWorker(options.sessionId);
            if (affinityWorker && availableWorkers.includes(affinityWorker)) {
                return affinityWorker;
            }
        }

        let selectedWorker;

        switch (this.config.algorithm) {
            case 'round-robin':
                selectedWorker = this.selectRoundRobin(availableWorkers);
                break;
            case 'least-connections':
                selectedWorker = this.selectLeastConnections(availableWorkers);
                break;
            case 'weighted':
                selectedWorker = this.selectWeighted(availableWorkers);
                break;
            case 'adaptive':
                selectedWorker = this.selectAdaptive(availableWorkers);
                break;
            default:
                selectedWorker = this.selectRoundRobin(availableWorkers);
        }

        // Set session affinity
        if (this.config.enableStickySessions && options.sessionId && selectedWorker) {
            this.setSessionAffinity(options.sessionId, selectedWorker.id);
        }

        return selectedWorker;
    }

    selectRoundRobin(workers) {
        if (workers.length === 0) return null;
        
        const worker = workers[this.roundRobinIndex % workers.length];
        this.roundRobinIndex = (this.roundRobinIndex + 1) % workers.length;
        
        return worker;
    }

    selectLeastConnections(workers) {
        if (workers.length === 0) return null;
        
        return workers.reduce((best, current) => {
            return current.currentLoad < best.currentLoad ? current : best;
        });
    }

    selectWeighted(workers) {
        if (workers.length === 0) return null;
        
        const totalWeight = workers.reduce((sum, worker) => sum + worker.weight, 0);
        const random = Math.random() * totalWeight;
        let currentWeight = 0;
        
        for (const worker of workers) {
            currentWeight += worker.weight;
            if (random <= currentWeight) {
                return worker;
            }
        }
        
        return workers[workers.length - 1];
    }

    selectAdaptive(workers) {
        if (workers.length === 0) return null;
        
        // Calculate adaptive score based on multiple factors
        const scoredWorkers = workers.map(worker => {
            const metrics = this.workerMetrics.get(worker.id);
            
            // Load factor (lower is better)
            const loadFactor = worker.currentLoad / worker.maxConcurrent;
            
            // Response time factor (lower is better)
            const avgResponseTime = worker.averageResponseTime || 100;
            const responseTimeFactor = avgResponseTime / 1000; // Normalize to seconds
            
            // Error rate factor (lower is better)
            const errorRate = worker.totalErrors / Math.max(worker.totalRequests, 1);
            
            // Recent performance (based on last minute)
            const recentRequests = metrics ? metrics.requestCounts.slice(-10).reduce((sum, count) => sum + count, 0) : 0;
            const recentErrors = metrics ? metrics.errorCounts.slice(-10).reduce((sum, count) => sum + count, 0) : 0;
            const recentErrorRate = recentRequests > 0 ? recentErrors / recentRequests : 0;
            
            // Calculate composite score (lower is better)
            const score = (loadFactor * 0.4) + 
                         (responseTimeFactor * 0.3) + 
                         (errorRate * 0.2) + 
                         (recentErrorRate * 0.1);
            
            return { worker, score };
        });
        
        // Sort by score and select best
        scoredWorkers.sort((a, b) => a.score - b.score);
        
        return scoredWorkers[0].worker;
    }

    getHealthyWorkers() {
        return Array.from(this.workers.values()).filter(worker => 
            worker.status === 'healthy' && 
            (!this.config.enableCircuitBreaker || 
             !this.circuitBreakers.has(worker.id) || 
             this.circuitBreakers.get(worker.id).getState() !== 'open')
        );
    }

    // Session Affinity
    setSessionAffinity(sessionId, workerId) {
        this.sessionAffinity.set(sessionId, {
            workerId,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.config.sessionAffinityTTL
        });
    }

    getSessionAffinityWorker(sessionId) {
        const affinity = this.sessionAffinity.get(sessionId);
        
        if (!affinity || Date.now() > affinity.expiresAt) {
            this.sessionAffinity.delete(sessionId);
            return null;
        }
        
        return this.workers.get(affinity.workerId);
    }

    // Metrics and Monitoring
    recordRequestSuccess(workerId, responseTime) {
        const worker = this.workers.get(workerId);
        const metrics = this.workerMetrics.get(workerId);
        
        if (worker && metrics) {
            // Update worker stats
            worker.averageResponseTime = 
                (worker.averageResponseTime * (worker.totalRequests - 1) + responseTime) / worker.totalRequests;
            
            // Update detailed metrics
            metrics.responseTimeSamples.push(responseTime);
            if (metrics.responseTimeSamples.length > 100) {
                metrics.responseTimeSamples.shift();
            }
            
            // Update per-second counters
            const currentSecond = Math.floor(Date.now() / 1000) % 60;
            metrics.requestCounts[currentSecond]++;
        }
    }

    recordRequestFailure(workerId, responseTime, error) {
        const worker = this.workers.get(workerId);
        const metrics = this.workerMetrics.get(workerId);
        
        if (worker && metrics) {
            worker.totalErrors++;
            
            // Update per-second error counters
            const currentSecond = Math.floor(Date.now() / 1000) % 60;
            metrics.errorCounts[currentSecond]++;
            
            // Check if worker should be marked unhealthy
            const errorRate = worker.totalErrors / worker.totalRequests;
            if (errorRate > 0.5 && worker.totalRequests > 10) {
                worker.status = 'unhealthy';
                this.logger.warn(`Worker ${workerId} marked as unhealthy due to high error rate: ${errorRate}`);
                this.emit('workerUnhealthy', { workerId, errorRate });
            }
        }
    }

    // Background Tasks
    startHealthChecks() {
        this.healthCheckTimer = setInterval(async () => {
            await this.performHealthChecks();
        }, this.config.healthCheckInterval);
    }

    async performHealthChecks() {
        const healthCheckPromises = Array.from(this.workers.entries()).map(async ([workerId, worker]) => {
            try {
                // Simulate health check
                const isHealthy = await this.checkWorkerHealth(worker);
                
                const previousStatus = worker.status;
                worker.status = isHealthy ? 'healthy' : 'unhealthy';
                worker.lastHealthCheck = Date.now();
                
                if (previousStatus !== worker.status) {
                    this.logger.info(`Worker ${workerId} status changed: ${previousStatus} -> ${worker.status}`);
                    this.emit('workerStatusChanged', { workerId, previousStatus, currentStatus: worker.status });
                }
                
            } catch (error) {
                this.logger.error(`Health check failed for worker ${workerId}:`, error);
                worker.status = 'unhealthy';
            }
        });
        
        await Promise.allSettled(healthCheckPromises);
        
        // Update stats
        this.stats.activeWorkers = this.getHealthyWorkers().length;
        this.stats.failedWorkers = Array.from(this.workers.values()).filter(w => w.status === 'unhealthy').length;
    }

    async checkWorkerHealth(worker) {
        if (worker.endpoint) {
            // Simulate HTTP health check
            return Math.random() > 0.1; // 90% healthy
        } else if (worker.handler) {
            // Assume handler-based workers are healthy if they exist
            return true;
        }
        return false;
    }

    startMetricsCollection() {
        if (!this.config.enableMetrics) return;
        
        this.metricsTimer = setInterval(() => {
            this.updateMetrics();
        }, 1000); // Every second
    }

    updateMetrics() {
        const currentSecond = Math.floor(Date.now() / 1000) % 60;
        
        // Reset counters for current second
        for (const metrics of this.workerMetrics.values()) {
            metrics.requestCounts[currentSecond] = 0;
            metrics.errorCounts[currentSecond] = 0;
        }
        
        // Cleanup expired session affinity
        const now = Date.now();
        for (const [sessionId, affinity] of this.sessionAffinity.entries()) {
            if (now > affinity.expiresAt) {
                this.sessionAffinity.delete(sessionId);
            }
        }
        
        this.emit('metricsUpdated', this.getStats());
    }

    startQueueProcessor() {
        this.queueProcessorTimer = setInterval(() => {
            this.processQueue();
        }, 100); // Every 100ms
    }

    processQueue() {
        // Simple queue processing - could be enhanced with priority queues
        while (this.requestQueue.length > 0 && this.activeRequests < this.config.maxConcurrentRequests) {
            const queuedRequest = this.requestQueue.shift();
            this.processRequest(queuedRequest.request, queuedRequest.options)
                .then(queuedRequest.resolve)
                .catch(queuedRequest.reject);
        }
    }

    // Utility methods
    shouldRetry(error) {
        // Don't retry certain types of errors
        if (error.code === 'RATE_LIMIT' || error.code === 'AUTH_FAILED') {
            return false;
        }
        return true;
    }

    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public API
    getStats() {
        return {
            ...this.stats,
            totalWorkers: this.workers.size,
            algorithm: this.config.algorithm,
            activeRequests: this.activeRequests,
            queueLength: this.requestQueue.length,
            sessionAffinityEntries: this.sessionAffinity.size
        };
    }

    getWorkerStats() {
        const workerStats = {};
        
        for (const [workerId, worker] of this.workers.entries()) {
            const metrics = this.workerMetrics.get(workerId);
            const circuitBreaker = this.circuitBreakers.get(workerId);
            
            workerStats[workerId] = {
                status: worker.status,
                currentLoad: worker.currentLoad,
                totalRequests: worker.totalRequests,
                totalErrors: worker.totalErrors,
                averageResponseTime: worker.averageResponseTime,
                errorRate: worker.totalRequests > 0 ? worker.totalErrors / worker.totalRequests : 0,
                lastHealthCheck: worker.lastHealthCheck,
                circuitBreakerState: circuitBreaker ? circuitBreaker.getState() : 'disabled',
                recentRequestRate: metrics ? 
                    metrics.requestCounts.slice(-10).reduce((sum, count) => sum + count, 0) : 0
            };
        }
        
        return workerStats;
    }

    async shutdown() {
        this.logger.info('Shutting down Workload Balancer...');
        
        // Stop background tasks
        if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
        if (this.metricsTimer) clearInterval(this.metricsTimer);
        if (this.queueProcessorTimer) clearInterval(this.queueProcessorTimer);
        
        // Drain all workers
        const drainPromises = Array.from(this.workers.keys()).map(workerId => 
            this.drainWorker(workerId, 10000) // 10 second timeout
        );
        
        await Promise.allSettled(drainPromises);
        
        // Shutdown circuit breakers
        const shutdownPromises = Array.from(this.circuitBreakers.values()).map(cb => cb.shutdown());
        await Promise.allSettled(shutdownPromises);
        
        this.removeAllListeners();
        this.logger.info('Workload Balancer shutdown complete');
    }
}

class WorkloadError extends Error {
    constructor(message, code, workerId = null) {
        super(message);
        this.name = 'WorkloadError';
        this.code = code;
        this.workerId = workerId;
    }
}

module.exports = { WorkloadBalancer, WorkloadError };