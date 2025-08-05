/**
 * Quantum Performance Optimizer
 * Advanced performance optimization and caching for quantum task planning
 */

const { Logger } = require('../utils/logger');
const { ConfigManager } = require('../utils/config');

class QuantumPerformanceOptimizer {
    constructor(config = {}) {
        this.logger = new Logger({ component: 'QuantumPerformanceOptimizer' });
        this.config = new ConfigManager(config);
        
        // Caching configuration
        this.cacheConfig = {
            maxEntries: config.maxCacheEntries || 10000,
            ttl: config.cacheTTL || 3600000, // 1 hour
            compressionThreshold: config.compressionThreshold || 1024,
            enableCompression: config.enableCompression !== false
        };
        
        // Multi-level cache system
        this.l1Cache = new Map(); // In-memory fast access
        this.l2Cache = new Map(); // Compressed storage
        this.cacheStats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            compressions: 0,
            decompressions: 0
        };
        
        // Performance monitoring
        this.performanceMetrics = {
            avgPlanningTime: 0,
            peakMemoryUsage: 0,
            totalOperations: 0,
            optimizationsSaved: 0,
            cacheHitRate: 0
        };
        
        // Batch processing
        this.batchProcessor = {
            queue: [],
            processing: false,
            batchSize: config.batchSize || 50,
            maxWaitTime: config.maxBatchWait || 1000
        };
        
        // Resource pooling
        this.workerPool = [];
        this.maxWorkers = config.maxWorkers || 4;
        this.activeWorkers = 0;
        
        // Performance optimization strategies
        this.optimizationStrategies = new Map([
            ['MEMORY_PRESSURE', this.handleMemoryPressure.bind(this)],
            ['HIGH_LATENCY', this.handleHighLatency.bind(this)],
            ['CACHE_MISS_SPIKE', this.handleCacheMissSpike.bind(this)],
            ['BATCH_OVERFLOW', this.handleBatchOverflow.bind(this)],
            ['WORKER_EXHAUSTION', this.handleWorkerExhaustion.bind(this)]
        ]);
        
        // Auto-scaling triggers
        this.scalingTriggers = {
            cpuThreshold: config.cpuScalingThreshold || 0.8,
            memoryThreshold: config.memoryScalingThreshold || 0.85,
            latencyThreshold: config.latencyScalingThreshold || 5000,
            queueSizeThreshold: config.queueScalingThreshold || 100
        };
        
        this.initialized = false;
        
        // Start periodic cleanup
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 60000); // Every minute
    }

    async initialize() {
        try {
            this.logger.info('Initializing Quantum Performance Optimizer...');
            
            // Initialize worker pool
            await this.initializeWorkerPool();
            
            // Start performance monitoring
            this.startPerformanceMonitoring();
            
            this.initialized = true;
            this.logger.info('Quantum Performance Optimizer initialized successfully');
            
            return this;
        } catch (error) {
            this.logger.error('Failed to initialize Performance Optimizer:', error);
            throw error;
        }
    }

    /**
     * Optimize quantum planning with caching and batching
     */
    async optimizePlanTasks(planningFunction, tasks, constraints = {}, options = {}) {
        if (!this.initialized) {
            throw new Error('Performance Optimizer not initialized');
        }

        const startTime = Date.now();
        const requestId = this.generateRequestId();
        
        try {
            // Check cache first
            const cacheResult = await this.checkCache(tasks, constraints, options);
            if (cacheResult.hit) {
                this.cacheStats.hits++;
                this.performanceMetrics.optimizationsSaved++;
                this.logger.debug(`Cache hit for request ${requestId}`);
                return cacheResult.data;
            }
            
            this.cacheStats.misses++;
            
            // Apply performance optimizations
            const optimizedParams = await this.applyOptimizations(tasks, constraints, options);
            
            // Use batch processing if beneficial
            if (this.shouldUseBatchProcessing(optimizedParams)) {
                return await this.processBatch(planningFunction, optimizedParams, requestId);
            }
            
            // Use worker pool if available
            if (this.shouldUseWorkerPool(optimizedParams)) {
                return await this.processWithWorker(planningFunction, optimizedParams, requestId);
            }
            
            // Execute planning with monitoring
            const result = await this.executeWithMonitoring(
                planningFunction, 
                optimizedParams.tasks, 
                optimizedParams.constraints, 
                requestId
            );
            
            // Cache successful result
            await this.cacheResult(tasks, constraints, options, result);
            
            const duration = Date.now() - startTime;
            this.updatePerformanceMetrics(duration, result);
            
            return result;
            
        } catch (error) {
            this.logger.error(`Optimization failed for request ${requestId}:`, error);
            throw error;
        }
    }

    /**
     * Multi-level caching system
     */
    async checkCache(tasks, constraints, options) {
        const cacheKey = this.generateCacheKey(tasks, constraints, options);
        
        // Check L1 cache (fastest)
        if (this.l1Cache.has(cacheKey)) {
            const entry = this.l1Cache.get(cacheKey);
            if (this.isCacheEntryValid(entry)) {
                this.logger.debug('L1 cache hit');
                return { hit: true, data: entry.data, level: 'L1' };
            } else {
                this.l1Cache.delete(cacheKey);
            }
        }
        
        // Check L2 cache (compressed)
        if (this.l2Cache.has(cacheKey)) {
            const entry = this.l2Cache.get(cacheKey);
            if (this.isCacheEntryValid(entry)) {
                this.logger.debug('L2 cache hit - decompressing');
                const decompressedData = await this.decompressData(entry.compressedData);
                
                // Promote to L1 cache
                this.l1Cache.set(cacheKey, {
                    data: decompressedData,
                    timestamp: entry.timestamp,
                    accessCount: entry.accessCount + 1
                });
                
                this.cacheStats.decompressions++;
                return { hit: true, data: decompressedData, level: 'L2' };
            } else {
                this.l2Cache.delete(cacheKey);
            }
        }
        
        return { hit: false };
    }

    async cacheResult(tasks, constraints, options, result) {
        const cacheKey = this.generateCacheKey(tasks, constraints, options);
        const dataSize = this.estimateDataSize(result);
        
        // Create cache entry
        const cacheEntry = {
            data: result,
            timestamp: Date.now(),
            accessCount: 1,
            size: dataSize
        };
        
        // Decide on cache level based on size
        if (dataSize > this.cacheConfig.compressionThreshold && this.cacheConfig.enableCompression) {
            // Store in L2 cache with compression
            const compressedData = await this.compressData(result);
            this.l2Cache.set(cacheKey, {
                compressedData,
                timestamp: cacheEntry.timestamp,
                accessCount: cacheEntry.accessCount,
                originalSize: dataSize
            });
            this.cacheStats.compressions++;
        } else {
            // Store in L1 cache
            this.l1Cache.set(cacheKey, cacheEntry);
        }
        
        // Evict old entries if necessary
        await this.evictIfNecessary();
    }

    /**
     * Apply performance optimizations
     */
    async applyOptimizations(tasks, constraints, options) {
        const optimized = {
            tasks: [...tasks],
            constraints: { ...constraints },
            options: { ...options }
        };
        
        // Task pruning for large datasets
        if (tasks.length > 1000) {
            optimized.tasks = this.pruneTasksIntelligently(tasks);
            this.logger.info(`Pruned tasks from ${tasks.length} to ${optimized.tasks.length}`);
        }
        
        // Constraint simplification
        if (this.isConstraintComplexityHigh(constraints)) {
            optimized.constraints = this.simplifyConstraints(constraints);
        }
        
        // Memory-aware processing
        const memoryUsage = process.memoryUsage();
        if (memoryUsage.heapUsed > this.scalingTriggers.memoryThreshold * memoryUsage.heapTotal) {
            optimized.options.lowMemoryMode = true;
            this.logger.warn('Enabling low memory mode due to high memory usage');
        }
        
        return optimized;
    }

    /**
     * Intelligent task pruning
     */
    pruneTasksIntelligently(tasks) {
        // Sort by importance/priority
        const sortedTasks = [...tasks].sort((a, b) => {
            const priorityA = a.priority || 0.5;
            const priorityB = b.priority || 0.5;
            const urgencyA = this.calculateUrgency(a);
            const urgencyB = this.calculateUrgency(b);
            
            return (priorityB + urgencyB) - (priorityA + urgencyA);
        });
        
        // Keep top 80% by importance
        const keepCount = Math.floor(sortedTasks.length * 0.8);
        const prunedTasks = sortedTasks.slice(0, keepCount);
        
        // Ensure dependencies are maintained
        return this.maintainDependencies(prunedTasks, tasks);
    }

    calculateUrgency(task) {
        if (!task.deadline) return 0;
        
        const deadline = new Date(task.deadline);
        const now = new Date();
        const timeLeft = deadline.getTime() - now.getTime();
        const estimatedTime = (task.estimatedDuration || 60) * 60000;
        
        return Math.max(0, 1 - (timeLeft / estimatedTime));
    }

    maintainDependencies(prunedTasks, originalTasks) {
        const prunedIds = new Set(prunedTasks.map(t => t.id));
        const dependencyMap = new Map();
        
        // Build dependency map
        originalTasks.forEach(task => {
            if (task.dependencies) {
                dependencyMap.set(task.id, task.dependencies);
            }
        });
        
        // Add missing dependencies
        const toAdd = new Set();
        prunedTasks.forEach(task => {
            if (task.dependencies) {
                task.dependencies.forEach(depId => {
                    if (!prunedIds.has(depId)) {
                        const depTask = originalTasks.find(t => t.id === depId);
                        if (depTask) {
                            toAdd.add(depTask);
                        }
                    }
                });
            }
        });
        
        return [...prunedTasks, ...Array.from(toAdd)];
    }

    /**
     * Batch processing for high-throughput scenarios
     */
    async processBatch(planningFunction, params, requestId) {
        return new Promise((resolve, reject) => {
            const batchItem = {
                planningFunction,
                params,
                requestId,
                resolve,
                reject,
                timestamp: Date.now()
            };
            
            this.batchProcessor.queue.push(batchItem);
            
            if (!this.batchProcessor.processing) {
                this.processBatchQueue();
            }
        });
    }

    async processBatchQueue() {
        if (this.batchProcessor.processing || this.batchProcessor.queue.length === 0) {
            return;
        }
        
        this.batchProcessor.processing = true;
        
        try {
            while (this.batchProcessor.queue.length > 0) {
                const batchSize = Math.min(
                    this.batchProcessor.batchSize, 
                    this.batchProcessor.queue.length
                );
                
                const batch = this.batchProcessor.queue.splice(0, batchSize);
                
                // Process batch concurrently
                const promises = batch.map(async (item) => {
                    try {
                        const result = await this.executeWithMonitoring(
                            item.planningFunction,
                            item.params.tasks,
                            item.params.constraints,
                            item.requestId
                        );
                        item.resolve(result);
                    } catch (error) {
                        item.reject(error);
                    }
                });
                
                await Promise.allSettled(promises);
            }
        } finally {
            this.batchProcessor.processing = false;
        }
    }

    shouldUseBatchProcessing(params) {
        return this.batchProcessor.queue.length > 10 || 
               params.tasks.length < 50; // Small tasks benefit from batching
    }

    /**
     * Worker pool management
     */
    async initializeWorkerPool() {
        // Initialize conceptual worker pool
        // In a real implementation, this would spawn actual worker threads
        for (let i = 0; i < this.maxWorkers; i++) {
            this.workerPool.push({
                id: i,
                busy: false,
                totalTasks: 0,
                avgProcessingTime: 0
            });
        }
        
        this.logger.info(`Initialized worker pool with ${this.maxWorkers} workers`);
    }

    async processWithWorker(planningFunction, params, requestId) {
        const worker = this.getAvailableWorker();
        if (!worker) {
            // Fallback to direct processing
            return await this.executeWithMonitoring(
                planningFunction, 
                params.tasks, 
                params.constraints, 
                requestId
            );
        }
        
        worker.busy = true;
        this.activeWorkers++;
        
        try {
            const startTime = Date.now();
            const result = await this.executeWithMonitoring(
                planningFunction, 
                params.tasks, 
                params.constraints, 
                requestId
            );
            
            // Update worker stats
            const duration = Date.now() - startTime;
            worker.totalTasks++;
            worker.avgProcessingTime = (worker.avgProcessingTime * (worker.totalTasks - 1) + duration) / worker.totalTasks;
            
            return result;
        } finally {
            worker.busy = false;
            this.activeWorkers--;
        }
    }

    getAvailableWorker() {
        return this.workerPool.find(worker => !worker.busy);
    }

    shouldUseWorkerPool(params) {
        return params.tasks.length > 100 && this.getAvailableWorker() !== null;
    }

    /**
     * Execute with performance monitoring
     */
    async executeWithMonitoring(planningFunction, tasks, constraints, requestId) {
        const startTime = Date.now();
        const startMemory = process.memoryUsage().heapUsed;
        
        try {
            this.performanceMetrics.totalOperations++;
            
            const result = await planningFunction(tasks, constraints);
            
            const duration = Date.now() - startTime;
            const memoryUsed = process.memoryUsage().heapUsed - startMemory;
            
            // Update performance metrics
            this.performanceMetrics.avgPlanningTime = 
                (this.performanceMetrics.avgPlanningTime * (this.performanceMetrics.totalOperations - 1) + duration) / 
                this.performanceMetrics.totalOperations;
            
            this.performanceMetrics.peakMemoryUsage = Math.max(
                this.performanceMetrics.peakMemoryUsage, 
                memoryUsed
            );
            
            // Check for performance issues
            await this.checkPerformanceThresholds(duration, memoryUsed);
            
            this.logger.debug(`Request ${requestId} completed in ${duration}ms using ${Math.round(memoryUsed / 1024)}KB`);
            
            return result;
            
        } catch (error) {
            this.logger.error(`Request ${requestId} failed:`, error);
            throw error;
        }
    }

    /**
     * Performance threshold monitoring and auto-scaling
     */
    async checkPerformanceThresholds(duration, memoryUsed) {
        const triggers = [];
        
        if (duration > this.scalingTriggers.latencyThreshold) {
            triggers.push('HIGH_LATENCY');
        }
        
        const memoryUsage = process.memoryUsage();
        if (memoryUsage.heapUsed > this.scalingTriggers.memoryThreshold * memoryUsage.heapTotal) {
            triggers.push('MEMORY_PRESSURE');
        }
        
        if (this.cacheStats.misses > this.cacheStats.hits * 2) {
            triggers.push('CACHE_MISS_SPIKE');
        }
        
        if (this.batchProcessor.queue.length > this.scalingTriggers.queueSizeThreshold) {
            triggers.push('BATCH_OVERFLOW');
        }
        
        if (this.activeWorkers >= this.maxWorkers) {
            triggers.push('WORKER_EXHAUSTION');
        }
        
        // Apply optimization strategies
        for (const trigger of triggers) {
            const strategy = this.optimizationStrategies.get(trigger);
            if (strategy) {
                await strategy({ duration, memoryUsed });
            }
        }
    }

    /**
     * Optimization strategy implementations
     */
    async handleMemoryPressure({ memoryUsed }) {
        this.logger.warn('Memory pressure detected - applying optimizations');
        
        // Aggressive cache cleanup
        const evicted = this.evictOldestEntries(Math.floor(this.l1Cache.size * 0.3));
        this.logger.info(`Evicted ${evicted} cache entries to free memory`);
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
    }

    async handleHighLatency({ duration }) {
        this.logger.warn(`High latency detected: ${duration}ms`);
        
        // Reduce batch size temporarily
        this.batchProcessor.batchSize = Math.max(10, Math.floor(this.batchProcessor.batchSize * 0.8));
        
        // Enable more aggressive caching
        this.cacheConfig.ttl = Math.min(this.cacheConfig.ttl * 1.5, 7200000); // Max 2 hours
    }

    async handleCacheMissSpike() {
        this.logger.warn('Cache miss spike detected');
        
        // Increase cache size temporarily
        this.cacheConfig.maxEntries = Math.min(this.cacheConfig.maxEntries * 1.2, 50000);
        
        // Reduce eviction aggressiveness
        this.cacheConfig.ttl = Math.min(this.cacheConfig.ttl * 1.2, 7200000);
    }

    async handleBatchOverflow() {
        this.logger.warn('Batch queue overflow detected');
        
        // Increase batch processing rate
        this.batchProcessor.batchSize = Math.min(this.batchProcessor.batchSize * 1.5, 200);
        this.batchProcessor.maxWaitTime = Math.max(this.batchProcessor.maxWaitTime * 0.8, 100);
    }

    async handleWorkerExhaustion() {
        this.logger.warn('Worker pool exhaustion detected');
        
        // In a real implementation, this would spawn more workers
        // For now, we'll just log and let the system queue requests
        this.logger.info('Consider increasing worker pool size');
    }

    /**
     * Cache management utilities
     */
    generateCacheKey(tasks, constraints, options) {
        const keyData = {
            taskHash: this.hashTasks(tasks),
            constraintHash: this.hashObject(constraints),
            optionHash: this.hashObject(options)
        };
        
        return Buffer.from(JSON.stringify(keyData)).toString('base64');
    }

    hashTasks(tasks) {
        const taskSummary = tasks.map(task => ({
            id: task.id,
            priority: task.priority,
            duration: task.estimatedDuration,
            resources: task.requiredResources?.sort(),
            deps: task.dependencies?.sort()
        }));
        
        return this.hashObject(taskSummary);
    }

    hashObject(obj) {
        return require('crypto')
            .createHash('md5')
            .update(JSON.stringify(obj))
            .digest('hex');
    }

    isCacheEntryValid(entry) {
        return Date.now() - entry.timestamp < this.cacheConfig.ttl;
    }

    async evictIfNecessary() {
        const totalEntries = this.l1Cache.size + this.l2Cache.size;
        
        if (totalEntries > this.cacheConfig.maxEntries) {
            const evictCount = Math.floor(totalEntries * 0.1); // Evict 10%
            this.evictOldestEntries(evictCount);
        }
    }

    evictOldestEntries(count) {
        let evicted = 0;
        
        // Evict from L1 first (larger entries)
        const l1Entries = Array.from(this.l1Cache.entries())
            .sort(([,a], [,b]) => a.timestamp - b.timestamp);
        
        for (const [key] of l1Entries.slice(0, Math.min(count, l1Entries.length))) {
            this.l1Cache.delete(key);
            evicted++;
        }
        
        // Evict from L2 if needed
        if (evicted < count) {
            const l2Entries = Array.from(this.l2Cache.entries())
                .sort(([,a], [,b]) => a.timestamp - b.timestamp);
            
            for (const [key] of l2Entries.slice(0, count - evicted)) {
                this.l2Cache.delete(key);
                evicted++;
            }
        }
        
        this.cacheStats.evictions += evicted;
        return evicted;
    }

    /**
     * Data compression utilities
     */
    async compressData(data) {
        try {
            const zlib = require('zlib');
            const jsonString = JSON.stringify(data);
            return zlib.gzipSync(jsonString);
        } catch (error) {
            this.logger.error('Data compression failed:', error);
            return data;
        }
    }

    async decompressData(compressedData) {
        try {
            const zlib = require('zlib');
            const decompressed = zlib.gunzipSync(compressedData);
            return JSON.parse(decompressed.toString());
        } catch (error) {
            this.logger.error('Data decompression failed:', error);
            throw error;
        }
    }

    estimateDataSize(data) {
        return Buffer.byteLength(JSON.stringify(data), 'utf8');
    }

    /**
     * Constraint optimization
     */
    isConstraintComplexityHigh(constraints) {
        const complexity = Object.keys(constraints).length + 
                          (constraints.maxStates || 0) + 
                          (constraints.maxConcurrency || 0);
        return complexity > 20;
    }

    simplifyConstraints(constraints) {
        const simplified = { ...constraints };
        
        // Reduce quantum state complexity
        if (simplified.maxStates > 16) {
            simplified.maxStates = 16;
        }
        
        // Limit concurrency for better resource management
        if (simplified.maxConcurrency > 8) {
            simplified.maxConcurrency = 8;
        }
        
        return simplified;
    }

    /**
     * Utility methods
     */
    generateRequestId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    updatePerformanceMetrics(duration, result) {
        this.performanceMetrics.cacheHitRate = this.cacheStats.hits / 
            (this.cacheStats.hits + this.cacheStats.misses);
    }

    performCleanup() {
        // Clean expired cache entries
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, entry] of this.l1Cache.entries()) {
            if (now - entry.timestamp > this.cacheConfig.ttl) {
                this.l1Cache.delete(key);
                cleaned++;
            }
        }
        
        for (const [key, entry] of this.l2Cache.entries()) {
            if (now - entry.timestamp > this.cacheConfig.ttl) {
                this.l2Cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            this.logger.debug(`Cleaned ${cleaned} expired cache entries`);
        }
    }

    startPerformanceMonitoring() {
        setInterval(() => {
            const memUsage = process.memoryUsage();
            
            this.logger.debug('Performance metrics:', {
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
                cacheSize: this.l1Cache.size + this.l2Cache.size,
                cacheHitRate: this.performanceMetrics.cacheHitRate,
                avgPlanningTime: Math.round(this.performanceMetrics.avgPlanningTime) + 'ms',
                activeWorkers: this.activeWorkers,
                queueSize: this.batchProcessor.queue.length
            });
        }, 30000); // Every 30 seconds
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            cacheStats: this.cacheStats,
            cacheSize: {
                l1: this.l1Cache.size,
                l2: this.l2Cache.size,
                total: this.l1Cache.size + this.l2Cache.size
            },
            workerPool: {
                total: this.workerPool.length,
                active: this.activeWorkers,
                utilization: this.activeWorkers / this.workerPool.length
            },
            batchProcessor: {
                queueSize: this.batchProcessor.queue.length,
                processing: this.batchProcessor.processing,
                batchSize: this.batchProcessor.batchSize
            },
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Shutdown performance optimizer
     */
    async shutdown() {
        this.logger.info('Shutting down Quantum Performance Optimizer...');
        
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        // Clear caches
        this.l1Cache.clear();
        this.l2Cache.clear();
        
        // Clear batch queue
        this.batchProcessor.queue = [];
        
        this.initialized = false;
        this.logger.info('Quantum Performance Optimizer shutdown complete');
    }
}

module.exports = { QuantumPerformanceOptimizer };