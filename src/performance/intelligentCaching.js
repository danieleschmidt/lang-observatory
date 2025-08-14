/**
 * Intelligent Caching System
 * Multi-level caching with automatic invalidation and performance optimization
 */

const Redis = require('redis');
const { Logger } = require('../utils/logger');
const { MetricsManager } = require('../services/metricsService');

class IntelligentCache {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      redis: {
        url:
          config.redis?.url ||
          process.env.REDIS_URL ||
          'redis://localhost:6379',
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        ...config.redis,
      },
      memory: {
        maxSize: config.memory?.maxSize || 1000, // Max items in memory cache
        maxAge: config.memory?.maxAge || 300000, // 5 minutes
        ...config.memory,
      },
      intelligent: {
        adaptiveTTL: config.intelligent?.adaptiveTTL !== false,
        accessPatternLearning:
          config.intelligent?.accessPatternLearning !== false,
        predictivePreloading:
          config.intelligent?.predictivePreloading !== false,
        ...config.intelligent,
      },
      ...config,
    };

    this.logger = new Logger({ service: 'IntelligentCache' });
    this.metrics = new MetricsManager();

    // Multi-level storage
    this.memoryCache = new Map();
    this.redisClient = null;

    // Intelligence features
    this.accessPatterns = new Map(); // Track access patterns
    this.hitRates = new Map(); // Track hit rates per key pattern
    this.adaptiveTTLs = new Map(); // Dynamic TTL values

    // Performance monitoring
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      errors: 0,
      totalRequests: 0,
      avgResponseTime: 0,
    };

    this.initialized = false;
  }

  async initialize() {
    if (!this.config.enabled) {
      this.logger.info('Intelligent caching disabled');
      this.initialized = true;
      return;
    }

    try {
      // Initialize Redis connection
      if (this.config.redis.url) {
        this.redisClient = Redis.createClient(this.config.redis);

        this.redisClient.on('error', error => {
          this.logger.error('Redis connection error:', error);
          this.stats.errors++;
        });

        this.redisClient.on('connect', () => {
          this.logger.info('Redis connected successfully');
        });

        await this.redisClient.connect();
      }

      // Start background optimization processes
      this._startBackgroundTasks();

      this.initialized = true;
      this.logger.info('Intelligent cache initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize intelligent cache:', error);
      // Continue without Redis if connection fails
      this.redisClient = null;
      this.initialized = true;
    }
  }

  async get(key, options = {}) {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }

    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      // Record access pattern
      this._recordAccess(key);

      // Try memory cache first
      const memoryResult = this._getFromMemory(key);
      if (memoryResult !== null) {
        this.stats.hits++;
        this._updateResponseTime(Date.now() - startTime);
        return memoryResult;
      }

      // Try Redis cache
      if (this.redisClient) {
        const redisResult = await this._getFromRedis(key);
        if (redisResult !== null) {
          // Store in memory for faster access
          this._setInMemory(key, redisResult, options);
          this.stats.hits++;
          this._updateResponseTime(Date.now() - startTime);
          return redisResult;
        }
      }

      this.stats.misses++;
      this._updateResponseTime(Date.now() - startTime);
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      this.stats.errors++;
      return null;
    }
  }

  async set(key, value, options = {}) {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }

    try {
      const ttl = this._calculateAdaptiveTTL(key, options.ttl);

      // Set in memory cache
      this._setInMemory(key, value, { ...options, ttl });

      // Set in Redis cache
      if (this.redisClient) {
        await this._setInRedis(key, value, ttl);
      }

      // Update access patterns for intelligence
      this._updateAccessPattern(key, 'set');

      return true;
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  async delete(key) {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }

    try {
      // Delete from memory
      this.memoryCache.delete(key);

      // Delete from Redis
      if (this.redisClient) {
        await this.redisClient.del(key);
      }

      return true;
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  async clear() {
    if (!this.initialized) {
      throw new Error('Cache not initialized');
    }

    try {
      // Clear memory cache
      this.memoryCache.clear();

      // Clear Redis cache
      if (this.redisClient) {
        await this.redisClient.flushAll();
      }

      // Reset intelligence data
      this.accessPatterns.clear();
      this.hitRates.clear();
      this.adaptiveTTLs.clear();

      return true;
    } catch (error) {
      this.logger.error('Cache clear error:', error);
      this.stats.errors++;
      return false;
    }
  }

  // Intelligent caching with pattern-based optimization
  async smartGet(pattern, generator, options = {}) {
    const cacheKey = this._generateCacheKey(pattern, options.keyParams);

    // Try to get from cache
    let result = await this.get(cacheKey, options);

    if (result !== null) {
      return result;
    }

    // Generate value if not in cache
    try {
      result = await generator();

      // Use intelligent TTL based on access patterns
      const smartTTL = this._calculateSmartTTL(pattern, result);
      await this.set(cacheKey, result, { ...options, ttl: smartTTL });

      return result;
    } catch (error) {
      this.logger.error(
        `Smart cache generation error for pattern ${pattern}:`,
        error
      );
      throw error;
    }
  }

  // Bulk operations for better performance
  async mget(keys) {
    if (!this.initialized || !Array.isArray(keys)) {
      return {};
    }

    const results = {};
    const uncachedKeys = [];

    // Check memory cache first
    for (const key of keys) {
      const memoryResult = this._getFromMemory(key);
      if (memoryResult !== null) {
        results[key] = memoryResult;
        this.stats.hits++;
      } else {
        uncachedKeys.push(key);
      }
    }

    // Check Redis for remaining keys
    if (this.redisClient && uncachedKeys.length > 0) {
      try {
        const redisResults = await this.redisClient.mGet(uncachedKeys);

        for (let i = 0; i < uncachedKeys.length; i++) {
          const key = uncachedKeys[i];
          const value = redisResults[i];

          if (value !== null) {
            const parsed = JSON.parse(value);
            results[key] = parsed;
            this._setInMemory(key, parsed); // Cache in memory
            this.stats.hits++;
          } else {
            this.stats.misses++;
          }
        }
      } catch (error) {
        this.logger.error('Bulk Redis get error:', error);
        this.stats.errors++;
      }
    } else {
      this.stats.misses += uncachedKeys.length;
    }

    return results;
  }

  async mset(keyValuePairs, options = {}) {
    if (!this.initialized || !Array.isArray(keyValuePairs)) {
      return false;
    }

    try {
      // Set in memory cache
      for (const [key, value] of keyValuePairs) {
        this._setInMemory(key, value, options);
      }

      // Batch set in Redis
      if (this.redisClient) {
        const redisPairs = [];
        for (const [key, value] of keyValuePairs) {
          redisPairs.push(key, JSON.stringify(value));
        }

        await this.redisClient.mSet(redisPairs);

        // Set TTL for each key if specified
        if (options.ttl) {
          const pipeline = this.redisClient.multi();
          for (const [key] of keyValuePairs) {
            pipeline.expire(key, Math.ceil(options.ttl / 1000));
          }
          await pipeline.exec();
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Bulk cache set error:', error);
      this.stats.errors++;
      return false;
    }
  }

  // Predictive preloading based on access patterns
  async preloadPredictive() {
    if (!this.config.intelligent.predictivePreloading) {
      return;
    }

    try {
      const predictions = this._generatePredictions();

      for (const prediction of predictions) {
        // Only preload if not already cached and high confidence
        if (prediction.confidence > 0.7) {
          const cached = await this.get(prediction.key);
          if (cached === null) {
            this.logger.debug(`Predictive preload for key: ${prediction.key}`);
            // This would need to be connected to the actual data generator
            // For now, just mark for potential preloading
          }
        }
      }
    } catch (error) {
      this.logger.error('Predictive preloading error:', error);
    }
  }

  // Get cache statistics and performance metrics
  getStats() {
    const hitRate =
      this.stats.totalRequests > 0
        ? this.stats.hits / this.stats.totalRequests
        : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 10000) / 10000,
      memorySize: this.memoryCache.size,
      accessPatterns: this.accessPatterns.size,
      adaptiveTTLs: this.adaptiveTTLs.size,
      intelligence: {
        adaptiveTTLEnabled: this.config.intelligent.adaptiveTTL,
        patternLearningEnabled: this.config.intelligent.accessPatternLearning,
        predictivePreloadingEnabled:
          this.config.intelligent.predictivePreloading,
      },
    };
  }

  async getHealth() {
    const stats = this.getStats();
    const redisHealthy = this.redisClient
      ? await this._checkRedisHealth()
      : true;

    return {
      healthy: this.initialized && redisHealthy && stats.hitRate > 0.1,
      stats,
      redis: {
        connected: !!this.redisClient,
        healthy: redisHealthy,
      },
      memory: {
        size: this.memoryCache.size,
        maxSize: this.config.memory.maxSize,
      },
    };
  }

  async shutdown() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }

    this.memoryCache.clear();
    this.accessPatterns.clear();
    this.hitRates.clear();
    this.adaptiveTTLs.clear();

    this.initialized = false;
    this.logger.info('Intelligent cache shutdown complete');
  }

  // Private methods for intelligence features

  _recordAccess(key) {
    if (!this.config.intelligent.accessPatternLearning) return;

    const now = Date.now();
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, []);
    }

    const pattern = this.accessPatterns.get(key);
    pattern.push(now);

    // Keep only recent accesses (last hour)
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentAccesses = pattern.filter(time => time > oneHourAgo);
    this.accessPatterns.set(key, recentAccesses);
  }

  _updateAccessPattern(key, operation) {
    // Update hit rates and patterns for intelligence
    const patternKey = this._extractPattern(key);
    if (!this.hitRates.has(patternKey)) {
      this.hitRates.set(patternKey, { hits: 0, total: 0 });
    }

    const hitRate = this.hitRates.get(patternKey);
    hitRate.total++;
    if (operation === 'hit') {
      hitRate.hits++;
    }
  }

  _calculateAdaptiveTTL(key, defaultTTL = 300000) {
    if (!this.config.intelligent.adaptiveTTL) {
      return defaultTTL;
    }

    const pattern = this._extractPattern(key);
    const accessHistory = this.accessPatterns.get(key) || [];

    if (accessHistory.length < 2) {
      return defaultTTL;
    }

    // Calculate access frequency
    const now = Date.now();
    const recentAccesses = accessHistory.filter(
      time => time > now - 30 * 60 * 1000
    ); // Last 30 minutes
    const accessFrequency = recentAccesses.length;

    // Adjust TTL based on access frequency
    let adaptiveTTL = defaultTTL;
    if (accessFrequency > 10) {
      adaptiveTTL = defaultTTL * 2; // Frequently accessed, cache longer
    } else if (accessFrequency < 2) {
      adaptiveTTL = defaultTTL * 0.5; // Rarely accessed, cache shorter
    }

    this.adaptiveTTLs.set(pattern, adaptiveTTL);
    return adaptiveTTL;
  }

  _calculateSmartTTL(pattern, data) {
    // Calculate TTL based on data characteristics and access patterns
    let baseTTL = 300000; // 5 minutes default

    // Adjust based on data size (larger data cached longer)
    const dataSize = JSON.stringify(data).length;
    if (dataSize > 10000) {
      baseTTL *= 1.5;
    }

    // Adjust based on access pattern
    const patternHistory = this.accessPatterns.get(pattern) || [];
    if (patternHistory.length > 5) {
      baseTTL *= 1.2; // Popular patterns cached longer
    }

    return Math.min(baseTTL, 3600000); // Max 1 hour
  }

  _generatePredictions() {
    const predictions = [];

    for (const [key, accesses] of this.accessPatterns.entries()) {
      if (accesses.length < 3) continue;

      // Simple prediction based on access intervals
      const intervals = [];
      for (let i = 1; i < accesses.length; i++) {
        intervals.push(accesses[i] - accesses[i - 1]);
      }

      const avgInterval =
        intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const lastAccess = accesses[accesses.length - 1];
      const nextPredicted = lastAccess + avgInterval;

      if (
        nextPredicted > Date.now() - 60000 &&
        nextPredicted < Date.now() + 300000
      ) {
        predictions.push({
          key,
          predictedTime: nextPredicted,
          confidence: Math.min(0.9, 1 / Math.sqrt(intervals.length)),
        });
      }
    }

    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  _extractPattern(key) {
    // Extract pattern from cache key for grouping similar keys
    return key.replace(/[0-9]+/g, 'N').replace(/[a-f0-9-]{36}/g, 'UUID');
  }

  _generateCacheKey(pattern, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    return `${pattern}:${sortedParams}`;
  }

  _getFromMemory(key) {
    const item = this.memoryCache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.memoryCache.delete(key);
      this.stats.evictions++;
      return null;
    }

    return item.value;
  }

  _setInMemory(key, value, options = {}) {
    const ttl = options.ttl || this.config.memory.maxAge;
    const expires = Date.now() + ttl;

    // Evict oldest items if cache is full
    if (this.memoryCache.size >= this.config.memory.maxSize) {
      this._evictOldest();
    }

    this.memoryCache.set(key, { value, expires, created: Date.now() });
  }

  async _getFromRedis(key) {
    if (!this.redisClient) return null;

    const value = await this.redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }

  async _setInRedis(key, value, ttl) {
    if (!this.redisClient) return;

    const serialized = JSON.stringify(value);
    const ttlSeconds = Math.ceil(ttl / 1000);

    await this.redisClient.setEx(key, ttlSeconds, serialized);
  }

  _evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.memoryCache.entries()) {
      if (item.created < oldestTime) {
        oldestTime = item.created;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  async _checkRedisHealth() {
    if (!this.redisClient) return false;

    try {
      await this.redisClient.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  _updateResponseTime(time) {
    this.stats.avgResponseTime =
      (this.stats.avgResponseTime * (this.stats.totalRequests - 1) + time) /
      this.stats.totalRequests;
  }

  _startBackgroundTasks() {
    // Periodically clean up expired memory cache items
    setInterval(() => {
      this._cleanupExpiredMemoryItems();
    }, 60000); // Every minute

    // Periodically run predictive preloading
    if (this.config.intelligent.predictivePreloading) {
      setInterval(() => {
        this.preloadPredictive();
      }, 300000); // Every 5 minutes
    }

    // Update metrics
    setInterval(() => {
      this._updateMetrics();
    }, 30000); // Every 30 seconds
  }

  _cleanupExpiredMemoryItems() {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (now > item.expires) {
        this.memoryCache.delete(key);
        this.stats.evictions++;
      }
    }
  }

  _updateMetrics() {
    if (this.metrics.initialized) {
      const stats = this.getStats();
      this.metrics.recordCustomMetric('cache_hit_rate', stats.hitRate, 'gauge');
      this.metrics.recordCustomMetric(
        'cache_memory_size',
        stats.memorySize,
        'gauge'
      );
      this.metrics.recordCustomMetric(
        'cache_total_requests',
        stats.totalRequests,
        'counter'
      );
      this.metrics.recordCustomMetric(
        'cache_avg_response_time',
        stats.avgResponseTime,
        'gauge'
      );
    }
  }
}

module.exports = { IntelligentCache };
