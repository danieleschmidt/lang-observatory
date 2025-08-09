/**
 * Auto-scaling Manager
 * Intelligent horizontal and vertical scaling based on workload patterns
 */

const { Logger } = require('../utils/logger');
const { EventEmitter } = require('events');
const cluster = require('cluster');
const os = require('os');

class AutoScalingManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.logger = new Logger({ component: 'AutoScalingManager' });
        this.config = config;
        
        // Scaling configuration
        this.scaling = {
            horizontal: {
                enabled: config.horizontal?.enabled || false,
                minInstances: config.horizontal?.minInstances || 1,
                maxInstances: config.horizontal?.maxInstances || Math.max(os.cpus().length, 4),
                scaleUpThreshold: config.horizontal?.scaleUpThreshold || 0.8,
                scaleDownThreshold: config.horizontal?.scaleDownThreshold || 0.3,
                cooldownPeriod: config.horizontal?.cooldownPeriod || 300000, // 5 minutes
                lastAction: 0
            },
            vertical: {
                enabled: config.vertical?.enabled || false,
                memoryIncrementMB: config.vertical?.memoryIncrementMB || 256,
                maxMemoryMB: config.vertical?.maxMemoryMB || 4096,
                cpuIncrementRatio: config.vertical?.cpuIncrementRatio || 0.25,
                maxCpuRatio: config.vertical?.maxCpuRatio || 2.0
            },
            predictive: {
                enabled: config.predictive?.enabled || false,
                lookAheadMinutes: config.predictive?.lookAheadMinutes || 30,
                confidenceThreshold: config.predictive?.confidenceThreshold || 0.7,
                historicalDataPoints: config.predictive?.historicalDataPoints || 1000
            }
        };
        
        // Current cluster state
        this.clusterState = {
            workers: new Map(),
            targetWorkers: this.scaling.horizontal.minInstances,
            actualWorkers: 0,
            pendingWorkers: 0
        };
        
        // Metrics collection
        this.metrics = {
            workload: [],
            responseTime: [],
            memoryUsage: [],
            cpuUsage: [],
            errorRate: [],
            throughput: [],
            predictions: []
        };
        
        // Machine learning components for prediction
        this.predictor = new WorkloadPredictor(config.prediction || {});
        
        this.initialized = false;
    }

    async initialize() {
        if (cluster.isMaster) {
            this.logger.info('Initializing Auto-scaling Manager (Master)...');
            await this.initializeMaster();
        } else {
            this.logger.info('Initializing Auto-scaling Manager (Worker)...');
            await this.initializeWorker();
        }
        
        this.initialized = true;
        return this;
    }

    async initializeMaster() {
        // Setup cluster management
        this.setupClusterEvents();
        
        // Start initial workers
        await this.scaleToTarget(this.scaling.horizontal.minInstances);
        
        // Setup monitoring
        this.setupMonitoring();
        
        // Setup predictive scaling if enabled
        if (this.scaling.predictive.enabled) {
            await this.predictor.initialize();
            this.setupPredictiveScaling();
        }
        
        this.logger.info(`Auto-scaling Manager initialized with ${this.clusterState.actualWorkers} workers`);
    }

    async initializeWorker() {
        // Worker-specific initialization
        this.setupWorkerReporting();
        
        this.logger.info(`Worker ${process.pid} initialized for auto-scaling`);
    }

    setupClusterEvents() {
        cluster.on('fork', (worker) => {
            this.logger.info(`Worker ${worker.process.pid} forked`);
            this.clusterState.workers.set(worker.id, {
                id: worker.id,
                pid: worker.process.pid,
                status: 'starting',
                startTime: Date.now(),
                metrics: {
                    requests: 0,
                    errors: 0,
                    avgResponseTime: 0,
                    memoryUsage: 0,
                    cpuUsage: 0
                }
            });
        });

        cluster.on('online', (worker) => {
            this.logger.info(`Worker ${worker.process.pid} is online`);
            const workerInfo = this.clusterState.workers.get(worker.id);
            if (workerInfo) {
                workerInfo.status = 'online';
                workerInfo.onlineTime = Date.now();
            }
            this.clusterState.actualWorkers++;
            this.emit('workerOnline', { workerId: worker.id, pid: worker.process.pid });
        });

        cluster.on('disconnect', (worker) => {
            this.logger.info(`Worker ${worker.process.pid} disconnected`);
            const workerInfo = this.clusterState.workers.get(worker.id);
            if (workerInfo) {
                workerInfo.status = 'disconnecting';
            }
        });

        cluster.on('exit', (worker, code, signal) => {
            this.logger.warn(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
            this.clusterState.workers.delete(worker.id);
            this.clusterState.actualWorkers--;
            
            this.emit('workerDied', { workerId: worker.id, pid: worker.process.pid, code, signal });
            
            // Automatic restart if not intentional shutdown
            if (!worker.isDead() && code !== 0) {
                this.logger.info('Restarting failed worker...');
                cluster.fork();
            }
        });
    }

    setupMonitoring() {
        // Collect metrics every 30 seconds
        setInterval(async () => {
            await this.collectClusterMetrics();
        }, 30000);

        // Evaluate scaling decisions every minute
        setInterval(async () => {
            await this.evaluateScaling();
        }, 60000);

        // Health check workers every 2 minutes
        setInterval(async () => {
            await this.healthCheckWorkers();
        }, 120000);
    }

    setupPredictiveScaling() {
        // Run prediction analysis every 5 minutes
        setInterval(async () => {
            await this.runPredictiveAnalysis();
        }, 300000);

        this.logger.info('Predictive scaling enabled');
    }

    setupWorkerReporting() {
        // Workers report their metrics to master
        setInterval(() => {
            if (process.send) {
                const metrics = this.collectWorkerMetrics();
                process.send({
                    type: 'worker-metrics',
                    workerId: cluster.worker.id,
                    pid: process.pid,
                    metrics
                });
            }
        }, 10000); // Every 10 seconds
    }

    async collectClusterMetrics() {
        const clusterMetrics = {
            timestamp: Date.now(),
            totalWorkers: this.clusterState.actualWorkers,
            targetWorkers: this.clusterState.targetWorkers,
            pendingWorkers: this.clusterState.pendingWorkers,
            workload: 0,
            avgResponseTime: 0,
            totalRequests: 0,
            totalErrors: 0,
            memoryUsage: 0,
            cpuUsage: 0
        };

        // Aggregate metrics from all workers
        let activeWorkers = 0;
        for (const [workerId, worker] of this.clusterState.workers) {
            if (worker.status === 'online') {
                activeWorkers++;
                clusterMetrics.workload += worker.metrics.requests;
                clusterMetrics.avgResponseTime += worker.metrics.avgResponseTime;
                clusterMetrics.totalRequests += worker.metrics.requests;
                clusterMetrics.totalErrors += worker.metrics.errors;
                clusterMetrics.memoryUsage += worker.metrics.memoryUsage;
                clusterMetrics.cpuUsage += worker.metrics.cpuUsage;
            }
        }

        if (activeWorkers > 0) {
            clusterMetrics.avgResponseTime /= activeWorkers;
            clusterMetrics.memoryUsage /= activeWorkers;
            clusterMetrics.cpuUsage /= activeWorkers;
        }

        clusterMetrics.errorRate = clusterMetrics.totalRequests > 0 
            ? clusterMetrics.totalErrors / clusterMetrics.totalRequests 
            : 0;

        // Store metrics
        this.metrics.workload.push(clusterMetrics.workload);
        this.metrics.responseTime.push(clusterMetrics.avgResponseTime);
        this.metrics.memoryUsage.push(clusterMetrics.memoryUsage);
        this.metrics.cpuUsage.push(clusterMetrics.cpuUsage);
        this.metrics.errorRate.push(clusterMetrics.errorRate);
        this.metrics.throughput.push(clusterMetrics.totalRequests);

        // Keep only recent metrics
        const maxHistorySize = 1000;
        Object.keys(this.metrics).forEach(key => {
            if (Array.isArray(this.metrics[key]) && this.metrics[key].length > maxHistorySize) {
                this.metrics[key] = this.metrics[key].slice(-maxHistorySize);
            }
        });

        this.emit('metricsCollected', clusterMetrics);
        return clusterMetrics;
    }

    collectWorkerMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        return {
            memoryUsage: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
            cpuUser: cpuUsage.user,
            cpuSystem: cpuUsage.system,
            uptime: process.uptime(),
            pid: process.pid
        };
    }

    async evaluateScaling() {
        if (!this.scaling.horizontal.enabled) return;

        const currentMetrics = await this.collectClusterMetrics();
        const scalingDecision = this.calculateScalingDecision(currentMetrics);

        if (scalingDecision.action === 'scale-up') {
            await this.scaleUp(scalingDecision.reason);
        } else if (scalingDecision.action === 'scale-down') {
            await this.scaleDown(scalingDecision.reason);
        }
    }

    calculateScalingDecision(metrics) {
        // Check cooldown period
        const now = Date.now();
        if (now - this.scaling.horizontal.lastAction < this.scaling.horizontal.cooldownPeriod) {
            return { action: 'wait', reason: 'cooling down' };
        }

        // Calculate composite load score
        const loads = {
            cpu: Math.min(metrics.cpuUsage, 1.0),
            memory: Math.min(metrics.memoryUsage / (1024 * 1024 * 1024), 1.0), // Normalize to GB
            responseTime: Math.min(metrics.avgResponseTime / 5000, 1.0), // 5 seconds = 100% load
            errorRate: Math.min(metrics.errorRate * 10, 1.0), // 10% error rate = 100% load
            throughput: this.calculateThroughputLoad(metrics.totalRequests)
        };

        // Weighted composite score
        const weights = { cpu: 0.3, memory: 0.25, responseTime: 0.25, errorRate: 0.15, throughput: 0.05 };
        const compositeLoad = Object.keys(loads).reduce((sum, key) => {
            return sum + (loads[key] * weights[key]);
        }, 0);

        // Scaling decisions
        if (compositeLoad > this.scaling.horizontal.scaleUpThreshold) {
            if (this.clusterState.actualWorkers < this.scaling.horizontal.maxInstances) {
                return {
                    action: 'scale-up',
                    reason: `Composite load ${Math.round(compositeLoad * 100)}% exceeds threshold`,
                    metrics: loads,
                    compositeLoad
                };
            }
        } else if (compositeLoad < this.scaling.horizontal.scaleDownThreshold) {
            if (this.clusterState.actualWorkers > this.scaling.horizontal.minInstances) {
                return {
                    action: 'scale-down',
                    reason: `Composite load ${Math.round(compositeLoad * 100)}% below threshold`,
                    metrics: loads,
                    compositeLoad
                };
            }
        }

        return { action: 'maintain', reason: 'Load within acceptable range', compositeLoad };
    }

    calculateThroughputLoad(requests) {
        // Calculate throughput load based on recent trend
        if (this.metrics.throughput.length < 2) return 0;
        
        const recent = this.metrics.throughput.slice(-10);
        const trend = this.calculateTrend(recent);
        
        return Math.max(0, Math.min(1, trend / 100)); // Normalize trend
    }

    calculateTrend(values) {
        if (values.length < 2) return 0;
        
        let sum = 0;
        for (let i = 1; i < values.length; i++) {
            sum += values[i] - values[i - 1];
        }
        
        return sum / (values.length - 1);
    }

    async scaleUp(reason) {
        const targetWorkers = Math.min(
            this.clusterState.actualWorkers + 1,
            this.scaling.horizontal.maxInstances
        );

        this.logger.info(`Scaling up: ${reason} (${this.clusterState.actualWorkers} → ${targetWorkers})`);
        
        await this.scaleToTarget(targetWorkers);
        this.scaling.horizontal.lastAction = Date.now();
        
        this.emit('scaledUp', {
            reason,
            previousWorkers: this.clusterState.actualWorkers,
            targetWorkers,
            timestamp: new Date().toISOString()
        });
    }

    async scaleDown(reason) {
        const targetWorkers = Math.max(
            this.clusterState.actualWorkers - 1,
            this.scaling.horizontal.minInstances
        );

        this.logger.info(`Scaling down: ${reason} (${this.clusterState.actualWorkers} → ${targetWorkers})`);
        
        await this.scaleToTarget(targetWorkers);
        this.scaling.horizontal.lastAction = Date.now();
        
        this.emit('scaledDown', {
            reason,
            previousWorkers: this.clusterState.actualWorkers,
            targetWorkers,
            timestamp: new Date().toISOString()
        });
    }

    async scaleToTarget(targetWorkers) {
        this.clusterState.targetWorkers = targetWorkers;
        
        const currentWorkers = this.clusterState.actualWorkers;
        if (targetWorkers > currentWorkers) {
            // Scale up
            for (let i = 0; i < targetWorkers - currentWorkers; i++) {
                this.clusterState.pendingWorkers++;
                cluster.fork();
            }
        } else if (targetWorkers < currentWorkers) {
            // Scale down - gracefully shutdown excess workers
            const workersToShutdown = currentWorkers - targetWorkers;
            const workerIds = Array.from(this.clusterState.workers.keys())
                .filter(id => this.clusterState.workers.get(id).status === 'online')
                .slice(-workersToShutdown);
            
            for (const workerId of workerIds) {
                const worker = cluster.workers[workerId];
                if (worker) {
                    this.logger.info(`Gracefully shutting down worker ${worker.process.pid}`);
                    worker.disconnect();
                    
                    // Force kill after 30 seconds if not graceful
                    setTimeout(() => {
                        if (!worker.isDead()) {
                            this.logger.warn(`Force killing worker ${worker.process.pid}`);
                            worker.kill();
                        }
                    }, 30000);
                }
            }
        }
    }

    async runPredictiveAnalysis() {
        if (!this.scaling.predictive.enabled) return;

        try {
            const prediction = await this.predictor.predictWorkload(
                this.metrics,
                this.scaling.predictive.lookAheadMinutes
            );

            if (prediction.confidence > this.scaling.predictive.confidenceThreshold) {
                this.metrics.predictions.push({
                    timestamp: Date.now(),
                    prediction: prediction.workload,
                    confidence: prediction.confidence,
                    lookAhead: this.scaling.predictive.lookAheadMinutes
                });

                // Proactive scaling based on prediction
                if (prediction.workload > this.scaling.horizontal.scaleUpThreshold) {
                    this.logger.info(`Predictive scaling: High workload predicted (${Math.round(prediction.workload * 100)}%, confidence: ${Math.round(prediction.confidence * 100)}%)`);
                    await this.scaleUp(`Predictive analysis: High workload expected`);
                }
            }

            this.emit('predictionComplete', prediction);
        } catch (error) {
            this.logger.error('Predictive analysis failed:', error);
        }
    }

    async healthCheckWorkers() {
        const unhealthyWorkers = [];
        const now = Date.now();

        for (const [workerId, worker] of this.clusterState.workers) {
            if (worker.status === 'online') {
                // Check if worker has been unresponsive
                const lastMetricsAge = now - (worker.lastMetricsUpdate || worker.onlineTime);
                if (lastMetricsAge > 180000) { // 3 minutes
                    unhealthyWorkers.push(workerId);
                    this.logger.warn(`Worker ${worker.pid} appears unresponsive (last metrics: ${Math.round(lastMetricsAge / 1000)}s ago)`);
                }

                // Check for memory leaks
                if (worker.metrics.memoryUsage > 1024 * 1024 * 1024 * 2) { // 2GB
                    unhealthyWorkers.push(workerId);
                    this.logger.warn(`Worker ${worker.pid} has high memory usage: ${Math.round(worker.metrics.memoryUsage / 1024 / 1024)}MB`);
                }
            }
        }

        // Restart unhealthy workers
        for (const workerId of unhealthyWorkers) {
            const worker = cluster.workers[workerId];
            if (worker) {
                this.logger.info(`Restarting unhealthy worker ${worker.process.pid}`);
                worker.kill();
                // New worker will be forked automatically by cluster exit event
            }
        }

        this.emit('healthCheckComplete', {
            totalWorkers: this.clusterState.workers.size,
            unhealthyWorkers: unhealthyWorkers.length
        });
    }

    getScalingStatus() {
        return {
            enabled: this.scaling.horizontal.enabled,
            currentWorkers: this.clusterState.actualWorkers,
            targetWorkers: this.clusterState.targetWorkers,
            pendingWorkers: this.clusterState.pendingWorkers,
            minInstances: this.scaling.horizontal.minInstances,
            maxInstances: this.scaling.horizontal.maxInstances,
            lastScalingAction: this.scaling.horizontal.lastAction,
            workers: Array.from(this.clusterState.workers.values()),
            predictive: {
                enabled: this.scaling.predictive.enabled,
                recentPredictions: this.metrics.predictions.slice(-10)
            },
            timestamp: new Date().toISOString()
        };
    }

    async shutdown() {
        this.logger.info('Shutting down Auto-scaling Manager...');
        
        if (cluster.isMaster) {
            // Shutdown all workers gracefully
            for (const worker of Object.values(cluster.workers)) {
                worker.disconnect();
            }
        }
        
        if (this.predictor) {
            await this.predictor.shutdown();
        }
        
        this.removeAllListeners();
        this.logger.info('Auto-scaling Manager shutdown complete');
    }
}

// Simple workload predictor using linear regression
class WorkloadPredictor {
    constructor(config = {}) {
        this.config = config;
        this.model = {
            weights: [],
            bias: 0,
            trained: false
        };
    }

    async initialize() {
        // Initialize the prediction model
        return this;
    }

    async predictWorkload(metrics, lookAheadMinutes) {
        // Simple prediction based on recent trends
        const recentWorkload = metrics.workload.slice(-20);
        const recentResponseTime = metrics.responseTime.slice(-20);
        
        if (recentWorkload.length < 5) {
            return { workload: 0.5, confidence: 0.1 };
        }

        // Calculate trend
        const workloadTrend = this.calculateLinearTrend(recentWorkload);
        const responseTrend = this.calculateLinearTrend(recentResponseTime);
        
        // Simple prediction: current + trend * lookAhead
        const currentLoad = recentWorkload[recentWorkload.length - 1] || 0;
        const predictedLoad = Math.max(0, Math.min(1, currentLoad + (workloadTrend * lookAheadMinutes / 60)));
        
        // Confidence based on trend consistency
        const confidence = this.calculateTrendConfidence(recentWorkload);

        return {
            workload: predictedLoad,
            confidence: Math.max(0.1, confidence),
            trend: workloadTrend,
            currentLoad
        };
    }

    calculateLinearTrend(values) {
        if (values.length < 2) return 0;
        
        const n = values.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
        const sumX2 = values.reduce((sum, _, x) => sum + x * x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return isFinite(slope) ? slope : 0;
    }

    calculateTrendConfidence(values) {
        if (values.length < 3) return 0.1;
        
        // Calculate coefficient of determination (R²)
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const totalSumSquares = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0);
        
        if (totalSumSquares === 0) return 0.1;
        
        const trend = this.calculateLinearTrend(values);
        const residualSumSquares = values.reduce((sum, value, index) => {
            const predicted = values[0] + trend * index;
            return sum + Math.pow(value - predicted, 2);
        }, 0);
        
        const rSquared = 1 - (residualSumSquares / totalSumSquares);
        return Math.max(0.1, Math.min(0.9, rSquared));
    }

    async shutdown() {
        // Cleanup predictor resources
    }
}

module.exports = { AutoScalingManager };