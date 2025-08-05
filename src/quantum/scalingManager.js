/**
 * Quantum Scaling Manager
 * Auto-scaling and load balancing for quantum task planning operations
 */

const { Logger } = require('../utils/logger');
const { ConfigManager } = require('../utils/config');

class QuantumScalingManager {
    constructor(config = {}) {
        this.logger = new Logger({ component: 'QuantumScalingManager' });
        this.config = new ConfigManager(config);
        
        // Scaling configuration
        this.scalingConfig = {
            minInstances: config.minInstances || 1,
            maxInstances: config.maxInstances || 10,
            targetCpuUtilization: config.targetCpuUtilization || 0.7,
            targetMemoryUtilization: config.targetMemoryUtilization || 0.8,
            scaleUpThreshold: config.scaleUpThreshold || 5,  // seconds of high load
            scaleDownThreshold: config.scaleDownThreshold || 300, // seconds of low load
            cooldownPeriod: config.cooldownPeriod || 60 // seconds between scaling actions
        };
        
        // Instance management
        this.instances = new Map();
        this.instanceCounter = 0;
        this.targetInstanceCount = this.scalingConfig.minInstances;
        
        // Load balancing
        this.loadBalancer = {
            algorithm: config.loadBalancingAlgorithm || 'round_robin', // round_robin, least_connections, weighted
            connections: new Map(),
            weights: new Map(),
            healthChecks: new Map()
        };
        
        // Metrics collection
        this.metrics = {
            totalRequests: 0,
            activeRequests: 0,
            avgResponseTime: 0,
            errorRate: 0,
            throughput: 0,
            resourceUtilization: {
                cpu: 0,
                memory: 0,
                network: 0,
                disk: 0
            }
        };
        
        // Scaling history and predictions
        this.scalingHistory = [];
        this.loadPredictions = [];
        this.lastScalingAction = 0;
        
        // Auto-scaling triggers
        this.scalingTriggers = new Map([
            ['HIGH_CPU', this.handleHighCpu.bind(this)],
            ['HIGH_MEMORY', this.handleHighMemory.bind(this)],
            ['HIGH_LATENCY', this.handleHighLatency.bind(this)],
            ['HIGH_ERROR_RATE', this.handleHighErrorRate.bind(this)],
            ['LOW_UTILIZATION', this.handleLowUtilization.bind(this)],
            ['INSTANCE_FAILURE', this.handleInstanceFailure.bind(this)]
        ]);
        
        // Health monitoring
        this.healthCheckInterval = config.healthCheckInterval || 30000; // 30 seconds
        this.healthThresholds = {
            maxResponseTime: config.maxResponseTime || 10000,
            maxErrorRate: config.maxErrorRate || 0.05,
            minSuccessRate: config.minSuccessRate || 0.95
        };
        
        this.initialized = false;
        
        // Start monitoring
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
            this.evaluateScalingNeeds();
        }, 10000); // Every 10 seconds
        
        this.healthCheckTimer = setInterval(() => {
            this.performHealthChecks();
        }, this.healthCheckInterval);
    }

    async initialize() {
        try {
            this.logger.info('Initializing Quantum Scaling Manager...');
            
            // Start with minimum instances
            for (let i = 0; i < this.scalingConfig.minInstances; i++) {
                await this.createInstance();
            }
            
            this.initialized = true;
            this.logger.info(`Quantum Scaling Manager initialized with ${this.instances.size} instances`);
            
            return this;
        } catch (error) {
            this.logger.error('Failed to initialize Scaling Manager:', error);
            throw error;
        }
    }

    /**
     * Route request to optimal instance using load balancing
     */
    async routeRequest(requestHandler, ...args) {
        if (!this.initialized) {
            throw new Error('Scaling Manager not initialized');
        }

        const startTime = Date.now();
        this.metrics.totalRequests++;
        this.metrics.activeRequests++;
        
        try {
            // Select instance using load balancing algorithm
            const instance = await this.selectInstance();
            if (!instance) {
                throw new Error('No healthy instances available');
            }
            
            // Track connection
            const currentConnections = this.loadBalancer.connections.get(instance.id) || 0;
            this.loadBalancer.connections.set(instance.id, currentConnections + 1);
            
            // Execute request
            const result = await this.executeOnInstance(instance, requestHandler, ...args);
            
            // Update metrics
            const duration = Date.now() - startTime;
            this.updateRequestMetrics(duration, true);
            
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.updateRequestMetrics(duration, false);
            throw error;
        } finally {
            this.metrics.activeRequests--;
        }
    }

    /**
     * Instance selection using load balancing algorithms
     */
    async selectInstance() {
        const healthyInstances = Array.from(this.instances.values())
            .filter(instance => instance.status === 'healthy');
        
        if (healthyInstances.length === 0) {
            this.logger.error('No healthy instances available');
            return null;
        }
        
        switch (this.loadBalancer.algorithm) {
            case 'round_robin':
                return this.selectRoundRobin(healthyInstances);
            case 'least_connections':
                return this.selectLeastConnections(healthyInstances);
            case 'weighted':
                return this.selectWeighted(healthyInstances);
            case 'response_time':
                return this.selectFastestResponse(healthyInstances);
            default:
                return this.selectRoundRobin(healthyInstances);
        }
    }

    selectRoundRobin(instances) {
        const sortedInstances = instances.sort((a, b) => a.id - b.id);
        const index = this.metrics.totalRequests % sortedInstances.length;
        return sortedInstances[index];
    }

    selectLeastConnections(instances) {
        return instances.reduce((best, instance) => {
            const connections = this.loadBalancer.connections.get(instance.id) || 0;
            const bestConnections = this.loadBalancer.connections.get(best.id) || 0;
            return connections < bestConnections ? instance : best;
        });
    }

    selectWeighted(instances) {
        const totalWeight = instances.reduce((sum, instance) => {
            return sum + (this.loadBalancer.weights.get(instance.id) || 1);
        }, 0);
        
        let random = Math.random() * totalWeight;
        
        for (const instance of instances) {
            const weight = this.loadBalancer.weights.get(instance.id) || 1;
            random -= weight;
            if (random <= 0) {
                return instance;
            }
        }
        
        return instances[0]; // Fallback
    }

    selectFastestResponse(instances) {
        return instances.reduce((fastest, instance) => {
            const fastestTime = fastest.avgResponseTime || Infinity;
            const instanceTime = instance.avgResponseTime || Infinity;
            return instanceTime < fastestTime ? instance : fastest;
        });
    }

    /**
     * Execute request on selected instance
     */
    async executeOnInstance(instance, requestHandler, ...args) {
        const startTime = Date.now();
        
        try {
            // Simulate instance execution
            const result = await requestHandler(...args);
            
            // Update instance metrics
            const duration = Date.now() - startTime;
            instance.totalRequests++;
            instance.successfulRequests++;
            instance.avgResponseTime = (instance.avgResponseTime * (instance.totalRequests - 1) + duration) / instance.totalRequests;
            instance.lastActivity = Date.now();
            
            return result;
            
        } catch (error) {
            // Update error metrics
            instance.totalRequests++;
            instance.failedRequests++;
            instance.errorRate = instance.failedRequests / instance.totalRequests;
            
            throw error;
        } finally {
            // Update connection count
            const connections = this.loadBalancer.connections.get(instance.id) || 1;
            this.loadBalancer.connections.set(instance.id, Math.max(0, connections - 1));
        }
    }

    /**
     * Instance lifecycle management
     */
    async createInstance() {
        const instanceId = ++this.instanceCounter;
        
        const instance = {
            id: instanceId,
            status: 'initializing',
            createdAt: Date.now(),
            lastActivity: Date.now(),
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            avgResponseTime: 0,
            errorRate: 0,
            resourceUsage: {
                cpu: 0,
                memory: 0,
                network: 0,
                disk: 0
            }
        };
        
        try {
            // Simulate instance initialization
            await this.initializeInstance(instance);
            
            instance.status = 'healthy';
            this.instances.set(instanceId, instance);
            this.loadBalancer.connections.set(instanceId, 0);
            this.loadBalancer.weights.set(instanceId, 1.0);
            
            this.logger.info(`Created instance ${instanceId}`);
            
            return instance;
            
        } catch (error) {
            this.logger.error(`Failed to create instance ${instanceId}:`, error);
            instance.status = 'failed';
            throw error;
        }
    }

    async initializeInstance(instance) {
        // Simulate instance initialization delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        // Initialize instance-specific resources
        instance.resourceUsage = {
            cpu: Math.random() * 0.2, // Start with low usage
            memory: Math.random() * 0.3,
            network: 0,
            disk: Math.random() * 0.1
        };
    }

    async destroyInstance(instanceId) {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            this.logger.warn(`Instance ${instanceId} not found for destruction`);
            return;
        }
        
        try {
            // Mark as terminating
            instance.status = 'terminating';
            
            // Wait for existing requests to complete (with timeout)
            const maxWaitTime = 30000; // 30 seconds
            const startWait = Date.now();
            
            while (this.loadBalancer.connections.get(instanceId) > 0 && 
                   Date.now() - startWait < maxWaitTime) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Cleanup resources
            this.instances.delete(instanceId);
            this.loadBalancer.connections.delete(instanceId);
            this.loadBalancer.weights.delete(instanceId);
            this.loadBalancer.healthChecks.delete(instanceId);
            
            this.logger.info(`Destroyed instance ${instanceId}`);
            
        } catch (error) {
            this.logger.error(`Failed to destroy instance ${instanceId}:`, error);
        }
    }

    /**
     * Metrics collection and analysis
     */
    collectMetrics() {
        const instances = Array.from(this.instances.values());
        
        if (instances.length === 0) return;
        
        // Aggregate instance metrics
        const totalRequests = instances.reduce((sum, i) => sum + i.totalRequests, 0);
        const totalSuccesses = instances.reduce((sum, i) => sum + i.successfulRequests, 0);
        const totalFailures = instances.reduce((sum, i) => sum + i.failedRequests, 0);
        
        this.metrics.errorRate = totalRequests > 0 ? totalFailures / totalRequests : 0;
        this.metrics.throughput = this.calculateThroughput();
        
        // Aggregate resource utilization
        this.metrics.resourceUtilization = {
            cpu: instances.reduce((sum, i) => sum + i.resourceUsage.cpu, 0) / instances.length,
            memory: instances.reduce((sum, i) => sum + i.resourceUsage.memory, 0) / instances.length,
            network: instances.reduce((sum, i) => sum + i.resourceUsage.network, 0) / instances.length,
            disk: instances.reduce((sum, i) => sum + i.resourceUsage.disk, 0) / instances.length
        };
        
        // Update response time
        const avgResponseTimes = instances
            .filter(i => i.avgResponseTime > 0)
            .map(i => i.avgResponseTime);
        
        if (avgResponseTimes.length > 0) {
            this.metrics.avgResponseTime = avgResponseTimes.reduce((a, b) => a + b, 0) / avgResponseTimes.length;
        }
    }

    calculateThroughput() {
        const windowSize = 60000; // 1 minute
        const now = Date.now();
        
        const recentRequests = this.scalingHistory
            .filter(event => now - event.timestamp < windowSize && event.type === 'request')
            .length;
        
        return recentRequests / (windowSize / 1000); // requests per second
    }

    /**
     * Auto-scaling decision engine
     */
    evaluateScalingNeeds() {
        const now = Date.now();
        
        // Check cooldown period
        if (now - this.lastScalingAction < this.scalingConfig.cooldownPeriod * 1000) {
            return;
        }
        
        const triggers = this.identifyScalingTriggers();
        
        for (const trigger of triggers) {
            const handler = this.scalingTriggers.get(trigger.type);
            if (handler) {
                handler(trigger.data);
            }
        }
    }

    identifyScalingTriggers() {
        const triggers = [];
        const metrics = this.metrics;
        
        // CPU utilization
        if (metrics.resourceUtilization.cpu > this.scalingConfig.targetCpuUtilization) {
            triggers.push({
                type: 'HIGH_CPU',
                data: { utilization: metrics.resourceUtilization.cpu }
            });
        }
        
        // Memory utilization
        if (metrics.resourceUtilization.memory > this.scalingConfig.targetMemoryUtilization) {
            triggers.push({
                type: 'HIGH_MEMORY',
                data: { utilization: metrics.resourceUtilization.memory }
            });
        }
        
        // Response time
        if (metrics.avgResponseTime > this.healthThresholds.maxResponseTime) {
            triggers.push({
                type: 'HIGH_LATENCY',
                data: { responseTime: metrics.avgResponseTime }
            });
        }
        
        // Error rate
        if (metrics.errorRate > this.healthThresholds.maxErrorRate) {
            triggers.push({
                type: 'HIGH_ERROR_RATE',
                data: { errorRate: metrics.errorRate }
            });
        }
        
        // Low utilization (scale down)
        const avgUtilization = (metrics.resourceUtilization.cpu + metrics.resourceUtilization.memory) / 2;
        if (avgUtilization < 0.3 && this.instances.size > this.scalingConfig.minInstances) {
            triggers.push({
                type: 'LOW_UTILIZATION',
                data: { utilization: avgUtilization }
            });
        }
        
        return triggers;
    }

    /**
     * Scaling trigger handlers
     */
    async handleHighCpu({ utilization }) {
        this.logger.warn(`High CPU utilization detected: ${Math.round(utilization * 100)}%`);
        await this.scaleUp('HIGH_CPU');
    }

    async handleHighMemory({ utilization }) {
        this.logger.warn(`High memory utilization detected: ${Math.round(utilization * 100)}%`);
        await this.scaleUp('HIGH_MEMORY');
    }

    async handleHighLatency({ responseTime }) {
        this.logger.warn(`High latency detected: ${responseTime}ms`);
        await this.scaleUp('HIGH_LATENCY');
    }

    async handleHighErrorRate({ errorRate }) {
        this.logger.warn(`High error rate detected: ${Math.round(errorRate * 100)}%`);
        await this.scaleUp('HIGH_ERROR_RATE');
    }

    async handleLowUtilization({ utilization }) {
        this.logger.info(`Low utilization detected: ${Math.round(utilization * 100)}%`);
        await this.scaleDown('LOW_UTILIZATION');
    }

    async handleInstanceFailure({ instanceId }) {
        this.logger.error(`Instance failure detected: ${instanceId}`);
        await this.destroyInstance(instanceId);
        await this.scaleUp('INSTANCE_FAILURE');
    }

    /**
     * Scaling operations
     */
    async scaleUp(reason) {
        if (this.instances.size >= this.scalingConfig.maxInstances) {
            this.logger.warn('Cannot scale up - maximum instances reached');
            return;
        }
        
        try {
            const newInstance = await this.createInstance();
            this.recordScalingEvent('SCALE_UP', { reason, instanceId: newInstance.id });
            this.lastScalingAction = Date.now();
            
        } catch (error) {
            this.logger.error('Scale up failed:', error);
        }
    }

    async scaleDown(reason) {
        if (this.instances.size <= this.scalingConfig.minInstances) {
            this.logger.info('Cannot scale down - minimum instances reached');
            return;
        }
        
        // Select instance to terminate (least utilized)
        const instances = Array.from(this.instances.values())
            .filter(i => i.status === 'healthy')
            .sort((a, b) => {
                const utilA = (a.resourceUsage.cpu + a.resourceUsage.memory) / 2;
                const utilB = (b.resourceUsage.cpu + b.resourceUsage.memory) / 2;
                return utilA - utilB;
            });
        
        if (instances.length > 0) {
            const instanceToTerminate = instances[0];
            await this.destroyInstance(instanceToTerminate.id);
            this.recordScalingEvent('SCALE_DOWN', { reason, instanceId: instanceToTerminate.id });
            this.lastScalingAction = Date.now();
        }
    }

    recordScalingEvent(action, data) {
        const event = {
            action,
            timestamp: Date.now(),
            instanceCount: this.instances.size,
            ...data
        };
        
        this.scalingHistory.push(event);
        
        // Maintain history size
        if (this.scalingHistory.length > 1000) {
            this.scalingHistory.shift();
        }
        
        this.logger.info(`Scaling event: ${action}`, data);
    }

    /**
     * Health monitoring
     */
    async performHealthChecks() {
        const healthPromises = Array.from(this.instances.values()).map(async (instance) => {
            try {
                const health = await this.checkInstanceHealth(instance);
                this.loadBalancer.healthChecks.set(instance.id, health);
                
                // Update instance status
                if (health.healthy && instance.status !== 'healthy') {
                    instance.status = 'healthy';
                    this.logger.info(`Instance ${instance.id} recovered`);
                } else if (!health.healthy && instance.status === 'healthy') {
                    instance.status = 'unhealthy';
                    this.logger.warn(`Instance ${instance.id} became unhealthy: ${health.reason}`);
                }
                
                // Update instance weight based on performance
                this.updateInstanceWeight(instance, health);
                
            } catch (error) {
                this.logger.error(`Health check failed for instance ${instance.id}:`, error);
                instance.status = 'unhealthy';
            }
        });
        
        await Promise.allSettled(healthPromises);
    }

    async checkInstanceHealth(instance) {
        const health = {
            healthy: true,
            reason: null,
            responseTime: 0,
            errorRate: instance.errorRate || 0
        };
        
        // Check response time
        if (instance.avgResponseTime > this.healthThresholds.maxResponseTime) {
            health.healthy = false;
            health.reason = 'High response time';
        }
        
        // Check error rate
        if (instance.errorRate > this.healthThresholds.maxErrorRate) {
            health.healthy = false;
            health.reason = 'High error rate';
        }
        
        // Check if instance is responsive
        const timeSinceLastActivity = Date.now() - instance.lastActivity;
        if (timeSinceLastActivity > 300000) { // 5 minutes
            health.healthy = false;
            health.reason = 'Instance not responsive';
        }
        
        // Simulate resource exhaustion
        if (instance.resourceUsage.cpu > 0.95 || instance.resourceUsage.memory > 0.95) {
            health.healthy = false;
            health.reason = 'Resource exhaustion';
        }
        
        return health;
    }

    updateInstanceWeight(instance, health) {
        let weight = 1.0;
        
        // Reduce weight for high latency
        if (instance.avgResponseTime > 1000) {
            weight *= 0.5;
        }
        
        // Reduce weight for high error rate
        if (instance.errorRate > 0.01) {
            weight *= (1 - instance.errorRate);
        }
        
        // Reduce weight for high resource usage
        const avgUtil = (instance.resourceUsage.cpu + instance.resourceUsage.memory) / 2;
        if (avgUtil > 0.8) {
            weight *= (1 - avgUtil);
        }
        
        this.loadBalancer.weights.set(instance.id, Math.max(0.1, weight));
    }

    updateRequestMetrics(duration, success) {
        // Update response time
        this.metrics.avgResponseTime = (this.metrics.avgResponseTime * (this.metrics.totalRequests - 1) + duration) / this.metrics.totalRequests;
        
        // Update throughput tracking
        this.scalingHistory.push({
            type: 'request',
            timestamp: Date.now(),
            duration,
            success
        });
    }

    /**
     * Get scaling metrics and status
     */
    getScalingMetrics() {
        const instances = Array.from(this.instances.values());
        
        return {
            instances: {
                total: instances.length,
                healthy: instances.filter(i => i.status === 'healthy').length,
                unhealthy: instances.filter(i => i.status === 'unhealthy').length,
                initializing: instances.filter(i => i.status === 'initializing').length
            },
            metrics: this.metrics,
            loadBalancer: {
                algorithm: this.loadBalancer.algorithm,
                totalConnections: Array.from(this.loadBalancer.connections.values()).reduce((a, b) => a + b, 0)
            },
            scaling: {
                targetInstances: this.targetInstanceCount,
                lastScalingAction: this.lastScalingAction,
                scalingHistory: this.scalingHistory.slice(-10) // Last 10 events
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Manual scaling operations
     */
    async setInstanceCount(count, reason = 'manual') {
        const targetCount = Math.max(
            this.scalingConfig.minInstances,
            Math.min(this.scalingConfig.maxInstances, count)
        );
        
        const currentCount = this.instances.size;
        
        if (targetCount > currentCount) {
            // Scale up
            for (let i = 0; i < targetCount - currentCount; i++) {
                await this.createInstance();
            }
            this.recordScalingEvent('MANUAL_SCALE_UP', { reason, targetCount });
        } else if (targetCount < currentCount) {
            // Scale down
            const instancesToRemove = currentCount - targetCount;
            const instances = Array.from(this.instances.values())
                .filter(i => i.status === 'healthy')
                .sort((a, b) => a.totalRequests - b.totalRequests); // Remove least used
            
            for (let i = 0; i < instancesToRemove && i < instances.length; i++) {
                await this.destroyInstance(instances[i].id);
            }
            this.recordScalingEvent('MANUAL_SCALE_DOWN', { reason, targetCount });
        }
        
        this.targetInstanceCount = targetCount;
    }

    /**
     * Shutdown scaling manager
     */
    async shutdown() {
        this.logger.info('Shutting down Quantum Scaling Manager...');
        
        // Clear monitoring intervals
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        
        // Shutdown all instances
        const shutdownPromises = Array.from(this.instances.keys()).map(async (instanceId) => {
            await this.destroyInstance(instanceId);
        });
        
        await Promise.allSettled(shutdownPromises);
        
        this.initialized = false;
        this.logger.info('Quantum Scaling Manager shutdown complete');
    }
}

module.exports = { QuantumScalingManager };