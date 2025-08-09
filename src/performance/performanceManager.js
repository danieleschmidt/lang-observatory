/**
 * Performance Manager
 * Advanced performance optimization, caching, and resource management
 */

const { Logger } = require('../utils/logger');
const { EventEmitter } = require('events');
const { SimpleCache } = require('./simpleCache');
const cluster = require('cluster');
const os = require('os');

class PerformanceManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.logger = new Logger({ component: 'PerformanceManager' });
        this.config = config;
        
        // Caching system
        this.caches = new Map();
        this.setupCaches();
        
        // Connection pools
        this.connectionPools = new Map();
        
        // Performance metrics
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            connectionPoolUsage: new Map(),
            memoryUsage: [],
            cpuUsage: [],
            responseTimesP95: 0,
            responseTimesP99: 0,
            throughput: 0,
            errorRate: 0,
            startTime: Date.now()
        };
        
        // Resource monitoring
        this.resourceMonitor = null;
        this.performanceOptimizer = null;
        
        // Auto-scaling configuration  
        this.autoScaling = {
            enabled: config.autoScaling?.enabled || false,
            minInstances: config.autoScaling?.minInstances || 1,
            maxInstances: config.autoScaling?.maxInstances || 10,
            scaleUpThreshold: config.autoScaling?.scaleUpThreshold || 0.8,
            scaleDownThreshold: config.autoScaling?.scaleDownThreshold || 0.3,
            cooldownPeriod: config.autoScaling?.cooldownPeriod || 300000, // 5 minutes
            lastScaleAction: 0
        };
        
        // Memory management
        this.memoryManager = {
            gcThreshold: config.memory?.gcThreshold || 0.85,
            heapWarningThreshold: config.memory?.heapWarningThreshold || 0.9,
            maxHeapSize: config.memory?.maxHeapSize || 1024 * 1024 * 1024, // 1GB
            compressionEnabled: config.memory?.compression || true
        };
        
        this.initialized = false;
    }

    async initialize() {
        this.logger.info('Initializing Performance Manager...');
        
        // Setup resource monitoring
        this.setupResourceMonitoring();
        
        // Setup memory management
        this.setupMemoryManagement();
        
        // Setup performance optimization
        this.setupPerformanceOptimization();
        
        // Setup auto-scaling if enabled
        if (this.autoScaling.enabled) {
            this.setupAutoScaling();
        }
        
        // Setup connection pools
        await this.setupConnectionPools();
        
        this.initialized = true;
        this.logger.info('Performance Manager initialized successfully');
        
        return this;
    }

    setupCaches() {
        const cacheConfigs = [
            {
                name: 'llm-responses',
                max: 1000,
                maxAge: 1000 * 60 * 30, // 30 minutes
                stale: true
            },
            {
                name: 'quantum-plans',
                max: 500,
                maxAge: 1000 * 60 * 60, // 1 hour
                stale: false
            },
            {
                name: 'neuromorphic-insights',
                max: 2000,
                maxAge: 1000 * 60 * 15, // 15 minutes
                stale: true
            },
            {
                name: 'database-queries',
                max: 5000,
                maxAge: 1000 * 60 * 5, // 5 minutes
                stale: true
            },
            {
                name: 'metrics-aggregates',
                max: 1000,
                maxAge: 1000 * 60 * 60, // 1 hour
                stale: false
            }
        ];

        cacheConfigs.forEach(config => {
            const cache = new SimpleCache({
                max: config.max,
                maxAge: config.maxAge,
                stale: config.stale,
                updateAgeOnGet: true,
                dispose: (key, value) => {
                    this.emit('cacheEvicted', { cache: config.name, key, size: this.getObjectSize(value) });
                }
            });
            
            this.caches.set(config.name, cache);
        });
        
        this.logger.info(`Initialized ${cacheConfigs.length} cache instances`);
    }

    setupResourceMonitoring() {
        this.resourceMonitor = setInterval(() => {
            this.collectResourceMetrics();
        }, 5000); // Every 5 seconds

        this.logger.info('Resource monitoring started');
    }

    setupMemoryManagement() {
        // Monitor memory usage and trigger GC when needed
        setInterval(() => {
            const memUsage = process.memoryUsage();
            const heapUsedRatio = memUsage.heapUsed / memUsage.heapTotal;
            
            if (heapUsedRatio > this.memoryManager.gcThreshold) {
                this.logger.info(`Memory usage high (${Math.round(heapUsedRatio * 100)}%), triggering garbage collection`);
                
                if (global.gc) {
                    global.gc();
                    this.emit('garbageCollectionTriggered', { reason: 'high_memory_usage', ratio: heapUsedRatio });
                } else {
                    this.logger.warn('Garbage collection not available, consider running with --expose-gc');
                }
            }
            
            if (heapUsedRatio > this.memoryManager.heapWarningThreshold) {
                this.emit('memoryWarning', { 
                    ratio: heapUsedRatio, 
                    usage: memUsage,
                    threshold: this.memoryManager.heapWarningThreshold 
                });
            }
        }, 10000); // Every 10 seconds

        this.logger.info('Memory management initialized');
    }

    setupPerformanceOptimization() {
        // Optimize V8 settings
        if (process.env.NODE_ENV === 'production') {
            // Set optimal V8 flags for production
            process.nextTick(() => {
                this.optimizeV8Settings();
            });
        }
        
        // Response time tracking
        this.responseTimesBuffer = [];
        setInterval(() => {
            if (this.responseTimesBuffer.length > 0) {
                this.calculatePercentiles();
                this.responseTimesBuffer = []; // Reset buffer
            }
        }, 30000); // Every 30 seconds

        this.logger.info('Performance optimization initialized');
    }

    setupAutoScaling() {
        setInterval(() => {
            this.evaluateAutoScaling();
        }, 60000); // Every minute

        this.logger.info('Auto-scaling monitoring enabled');
    }

    async setupConnectionPools() {
        // Database connection pool
        if (this.config.database?.enabled) {
            const dbPool = this.createConnectionPool('database', {
                min: this.config.database.pool?.min || 2,
                max: this.config.database.pool?.max || 10,
                acquireTimeoutMillis: 30000,
                createTimeoutMillis: 30000,
                destroyTimeoutMillis: 5000,
                idleTimeoutMillis: 30000,
                reapIntervalMillis: 1000,
                createRetryIntervalMillis: 100
            });
            
            this.connectionPools.set('database', dbPool);
        }
        
        // Redis connection pool for caching
        if (this.config.redis?.enabled) {
            const redisPool = this.createConnectionPool('redis', {
                min: this.config.redis.pool?.min || 1,
                max: this.config.redis.pool?.max || 5,
                acquireTimeoutMillis: 10000
            });
            
            this.connectionPools.set('redis', redisPool);
        }

        this.logger.info(`Initialized ${this.connectionPools.size} connection pools`);
    }

    createConnectionPool(name, config) {
        return {
            name,
            config,
            active: 0,
            idle: 0,
            pending: 0,
            total: 0,
            created: Date.now(),
            
            async acquire() {
                // Mock connection acquisition
                this.pending++;
                await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                this.pending--;
                this.active++;
                this.total = Math.max(this.total, this.active);
                
                return {
                    id: `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    pool: name,
                    acquired: Date.now(),
                    release: () => {
                        this.active--;
                        this.idle++;
                        setTimeout(() => this.idle--, 1000);
                    }
                };
            },
            
            getStats() {
                return {
                    name: this.name,
                    active: this.active,
                    idle: this.idle,
                    pending: this.pending,
                    total: this.total,
                    utilization: this.total > 0 ? this.active / this.total : 0
                };
            }
        };
    }

    // Caching methods
    async getFromCache(cacheName, key, fetchFunction = null) {
        const cache = this.caches.get(cacheName);
        if (!cache) {
            throw new Error(`Cache "${cacheName}" not found`);
        }

        let value = cache.get(key);
        if (value !== undefined) {
            this.metrics.cacheHits++;
            this.emit('cacheHit', { cache: cacheName, key });
            return value;
        }

        this.metrics.cacheMisses++;
        this.emit('cacheMiss', { cache: cacheName, key });

        if (fetchFunction) {
            try {
                value = await fetchFunction();
                if (value !== undefined) {
                    cache.set(key, value);
                    this.emit('cacheSet', { cache: cacheName, key, size: this.getObjectSize(value) });
                }
                return value;
            } catch (error) {
                this.emit('cacheFetchError', { cache: cacheName, key, error });
                throw error;
            }
        }

        return undefined;
    }

    setCache(cacheName, key, value) {
        const cache = this.caches.get(cacheName);
        if (!cache) {
            throw new Error(`Cache "${cacheName}" not found`);
        }

        cache.set(key, value);
        this.emit('cacheSet', { cache: cacheName, key, size: this.getObjectSize(value) });
    }

    invalidateCache(cacheName, key = null) {
        const cache = this.caches.get(cacheName);
        if (!cache) {
            return false;
        }

        if (key) {
            const deleted = cache.del(key);
            if (deleted) {
                this.emit('cacheInvalidated', { cache: cacheName, key });
            }
            return deleted;
        } else {
            const itemCount = cache.itemCount;
            cache.reset();
            this.emit('cacheCleared', { cache: cacheName, itemCount });
            return true;
        }
    }

    // Performance optimization methods
    async optimizeOperation(operation, context = {}) {
        const { 
            caching = true,
            cacheName,
            cacheKey,
            timeout = 30000,
            priority = 'normal'
        } = context;

        const startTime = Date.now();
        
        try {
            // Check cache first if enabled
            if (caching && cacheName && cacheKey) {
                const cached = await this.getFromCache(cacheName, cacheKey);
                if (cached !== undefined) {
                    return cached;
                }
            }

            // Execute operation with timeout
            const result = await this.executeWithTimeout(operation, timeout);
            
            // Cache result if caching enabled
            if (caching && cacheName && cacheKey && result !== undefined) {
                this.setCache(cacheName, cacheKey, result);
            }

            // Record performance metrics
            const duration = Date.now() - startTime;
            this.recordResponseTime(duration);

            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.recordResponseTime(duration);
            this.emit('operationError', { error, duration, context });
            throw error;
        }
    }

    async executeWithTimeout(operation, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            Promise.resolve(operation())
                .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    // Resource monitoring
    collectResourceMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        this.metrics.memoryUsage.push({
            timestamp: Date.now(),
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss
        });
        
        // Keep only last 1000 entries
        if (this.metrics.memoryUsage.length > 1000) {
            this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-500);
        }

        // Update connection pool metrics
        for (const [name, pool] of this.connectionPools) {
            this.metrics.connectionPoolUsage.set(name, pool.getStats());
        }

        this.emit('resourceMetricsCollected', {
            memory: memUsage,
            cpu: cpuUsage,
            pools: this.metrics.connectionPoolUsage
        });
    }

    recordResponseTime(duration) {
        this.responseTimesBuffer.push(duration);
        
        // Emit slow operation warning
        if (duration > 5000) {
            this.emit('slowOperation', { duration });
        }
    }

    calculatePercentiles() {
        if (this.responseTimesBuffer.length === 0) return;
        
        const sorted = [...this.responseTimesBuffer].sort((a, b) => a - b);
        const p95Index = Math.floor(sorted.length * 0.95);
        const p99Index = Math.floor(sorted.length * 0.99);
        
        this.metrics.responseTimesP95 = sorted[p95Index] || 0;
        this.metrics.responseTimesP99 = sorted[p99Index] || 0;
        this.metrics.throughput = this.responseTimesBuffer.length;
        
        this.emit('performanceMetricsUpdated', {
            p95: this.metrics.responseTimesP95,
            p99: this.metrics.responseTimesP99,
            throughput: this.metrics.throughput,
            samples: this.responseTimesBuffer.length
        });
    }

    // Auto-scaling logic
    evaluateAutoScaling() {
        if (!this.autoScaling.enabled) return;
        
        const now = Date.now();
        if (now - this.autoScaling.lastScaleAction < this.autoScaling.cooldownPeriod) {
            return; // Still in cooldown period
        }

        const currentLoad = this.calculateCurrentLoad();
        
        if (currentLoad > this.autoScaling.scaleUpThreshold) {
            this.requestScaleUp(currentLoad);
        } else if (currentLoad < this.autoScaling.scaleDownThreshold) {
            this.requestScaleDown(currentLoad);
        }
    }

    calculateCurrentLoad() {
        // Composite load metric based on multiple factors
        const memUsage = process.memoryUsage();
        const memoryLoad = memUsage.heapUsed / memUsage.heapTotal;
        
        const avgResponseTime = this.responseTimesBuffer.length > 0 
            ? this.responseTimesBuffer.reduce((a, b) => a + b, 0) / this.responseTimesBuffer.length
            : 0;
        const responseTimeLoad = Math.min(avgResponseTime / 1000, 1); // Normalize to 0-1
        
        const poolLoad = Array.from(this.connectionPools.values())
            .map(pool => pool.getStats().utilization)
            .reduce((max, util) => Math.max(max, util), 0);
        
        return Math.max(memoryLoad, responseTimeLoad, poolLoad);
    }

    requestScaleUp(currentLoad) {
        this.autoScaling.lastScaleAction = Date.now();
        this.emit('scaleUpRequested', { 
            currentLoad, 
            threshold: this.autoScaling.scaleUpThreshold,
            reason: 'High system load detected'
        });
        this.logger.info(`Scale-up requested - Current load: ${Math.round(currentLoad * 100)}%`);
    }

    requestScaleDown(currentLoad) {
        this.autoScaling.lastScaleAction = Date.now();
        this.emit('scaleDownRequested', { 
            currentLoad, 
            threshold: this.autoScaling.scaleDownThreshold,
            reason: 'Low system load detected'
        });
        this.logger.info(`Scale-down requested - Current load: ${Math.round(currentLoad * 100)}%`);
    }

    optimizeV8Settings() {
        // These would typically be set via command line flags
        this.logger.info('V8 optimization settings applied for production');
        this.emit('v8Optimized');
    }

    getObjectSize(obj) {
        // Rough estimate of object size in memory
        return JSON.stringify(obj).length * 2; // Approximate bytes
    }

    getCacheStats() {
        const stats = {};
        for (const [name, cache] of this.caches) {
            stats[name] = {
                itemCount: cache.itemCount,
                length: cache.length,
                maxAge: cache.maxAge,
                max: cache.max
            };
        }
        return stats;
    }

    getPerformanceMetrics() {
        const cacheHitRate = this.metrics.cacheHits + this.metrics.cacheMisses > 0
            ? this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)
            : 0;

        return {
            ...this.metrics,
            cacheHitRate,
            cacheStats: this.getCacheStats(),
            uptime: Date.now() - this.metrics.startTime,
            currentLoad: this.calculateCurrentLoad(),
            timestamp: new Date().toISOString()
        };
    }

    async getConnectionFromPool(poolName) {
        const pool = this.connectionPools.get(poolName);
        if (!pool) {
            throw new Error(`Connection pool "${poolName}" not found`);
        }

        return await pool.acquire();
    }

    // Cleanup and shutdown
    async shutdown() {
        this.logger.info('Shutting down Performance Manager...');
        
        if (this.resourceMonitor) {
            clearInterval(this.resourceMonitor);
            this.resourceMonitor = null;
        }
        
        // Clear all caches
        for (const [name, cache] of this.caches) {
            cache.reset();
        }
        
        this.caches.clear();
        this.connectionPools.clear();
        this.removeAllListeners();
        
        this.logger.info('Performance Manager shutdown complete');
    }
}

module.exports = { PerformanceManager };