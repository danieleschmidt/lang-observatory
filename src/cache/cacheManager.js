/**
 * Cache Manager
 * Handles caching for improved performance
 */

const { Logger } = require('../utils/logger');
const { Helpers } = require('../utils/helpers');

class CacheManager {
    constructor(config = {}) {
        this.config = {
            enabled: config.enabled !== false,
            defaultTTL: config.defaultTTL || 300, // 5 minutes
            maxSize: config.maxSize || 1000,
            checkPeriod: config.checkPeriod || 60, // 1 minute
            redisUrl: config.redisUrl || process.env.REDIS_URL,
            useRedis: config.useRedis && Boolean(config.redisUrl || process.env.REDIS_URL),
            ...config
        };
        
        this.logger = new Logger({ service: 'CacheManager' });
        this.memoryCache = new Map();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
        
        this.redisClient = null;
        this.cleanupTimer = null;
        this.initialized = false;
    }

    async initialize() {
        if (!this.config.enabled) {
            this.logger.info('Cache manager disabled');
            this.initialized = true;
            return;
        }

        try {
            // Initialize Redis if configured
            if (this.config.useRedis) {
                await this._initializeRedis();
            }
            
            // Start periodic cleanup for memory cache
            this._startCleanupTimer();
            
            this.initialized = true;
            this.logger.info('Cache manager initialized', {
                useRedis: this.config.useRedis,
                maxSize: this.config.maxSize,
                defaultTTL: this.config.defaultTTL
            });
        } catch (error) {
            this.logger.error('Failed to initialize cache manager:', error);
            throw error;
        }
    }

    async get(key) {
        if (!this.config.enabled) return null;

        try {
            const cacheKey = this._normalizeKey(key);
            
            // Try Redis first if available
            if (this.redisClient) {
                const redisValue = await this._getFromRedis(cacheKey);
                if (redisValue !== null) {
                    this.cacheStats.hits++;
                    return redisValue;
                }
            }
            
            // Try memory cache
            const memoryValue = this._getFromMemory(cacheKey);
            if (memoryValue !== null) {
                this.cacheStats.hits++;
                return memoryValue;
            }
            
            this.cacheStats.misses++;
            return null;
        } catch (error) {
            this.logger.error(`Error getting cache key ${key}:`, error);
            this.cacheStats.misses++;
            return null;
        }
    }

    async set(key, value, ttl = null) {
        if (!this.config.enabled) return;

        try {
            const cacheKey = this._normalizeKey(key);
            const cacheTTL = ttl || this.config.defaultTTL;
            const expiresAt = Date.now() + (cacheTTL * 1000);
            
            const cacheValue = {
                data: value,
                expiresAt,
                createdAt: Date.now()
            };
            
            // Set in Redis if available
            if (this.redisClient) {
                await this._setInRedis(cacheKey, cacheValue, cacheTTL);
            }
            
            // Set in memory cache
            this._setInMemory(cacheKey, cacheValue);
            
            this.cacheStats.sets++;
            this.logger.debug(`Cached key ${key} with TTL ${cacheTTL}s`);
        } catch (error) {
            this.logger.error(`Error setting cache key ${key}:`, error);
        }
    }

    async delete(key) {
        if (!this.config.enabled) return;

        try {
            const cacheKey = this._normalizeKey(key);
            
            // Delete from Redis if available
            if (this.redisClient) {
                await this._deleteFromRedis(cacheKey);
            }
            
            // Delete from memory cache
            this._deleteFromMemory(cacheKey);
            
            this.cacheStats.deletes++;
            this.logger.debug(`Deleted cache key ${key}`);
        } catch (error) {
            this.logger.error(`Error deleting cache key ${key}:`, error);
        }
    }

    async clear() {
        if (!this.config.enabled) return;

        try {
            // Clear Redis if available
            if (this.redisClient) {
                await this.redisClient.flushdb();
            }
            
            // Clear memory cache
            this.memoryCache.clear();
            
            this.logger.info('Cache cleared');
        } catch (error) {
            this.logger.error('Error clearing cache:', error);
        }
    }

    async getOrSet(key, factory, ttl = null) {
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }
        
        try {
            const value = await factory();
            await this.set(key, value, ttl);
            return value;
        } catch (error) {
            this.logger.error(`Error in getOrSet for key ${key}:`, error);
            throw error;
        }
    }

    getStats() {
        const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0
            ? (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)) * 100
            : 0;

        return {
            ...this.cacheStats,
            hitRate: Math.round(hitRate * 100) / 100,
            memorySize: this.memoryCache.size,
            enabled: this.config.enabled,
            useRedis: this.config.useRedis,
            redisConnected: Boolean(this.redisClient?.connected)
        };
    }

    async healthCheck() {
        try {
            const testKey = '__health_check__';
            const testValue = { timestamp: Date.now() };
            
            await this.set(testKey, testValue, 10);
            const retrieved = await this.get(testKey);
            await this.delete(testKey);
            
            const healthy = retrieved && retrieved.timestamp === testValue.timestamp;
            
            return {
                healthy,
                stats: this.getStats(),
                redis: this.redisClient ? await this._redisHealthCheck() : null
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                stats: this.getStats()
            };
        }
    }

    async shutdown() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        
        if (this.redisClient) {
            try {
                await this.redisClient.quit();
            } catch (error) {
                this.logger.warn('Error closing Redis connection:', error);
            }
        }
        
        this.memoryCache.clear();
        this.initialized = false;
        this.logger.info('Cache manager shutdown complete');
    }

    // Private methods
    async _initializeRedis() {
        try {
            // Mock Redis initialization - replace with actual Redis client
            this.redisClient = {
                connected: true,
                get: async (key) => {
                    // Mock implementation
                    return null;
                },
                setex: async (key, ttl, value) => {
                    // Mock implementation
                    return 'OK';
                },
                del: async (key) => {
                    // Mock implementation
                    return 1;
                },
                flushdb: async () => {
                    // Mock implementation
                    return 'OK';
                },
                ping: async () => {
                    // Mock implementation
                    return 'PONG';
                },
                quit: async () => {
                    this.connected = false;
                }
            };
            
            this.logger.info('Redis cache initialized', { url: this.config.redisUrl });
        } catch (error) {
            this.logger.warn('Failed to initialize Redis, falling back to memory cache:', error);
            this.config.useRedis = false;
        }
    }

    async _getFromRedis(key) {
        try {
            const value = await this.redisClient.get(key);
            if (value) {
                const parsed = JSON.parse(value);
                if (parsed.expiresAt > Date.now()) {
                    return parsed.data;
                }
            }
            return null;
        } catch (error) {
            this.logger.warn(`Redis get error for key ${key}:`, error);
            return null;
        }
    }

    async _setInRedis(key, value, ttl) {
        try {
            await this.redisClient.setex(key, ttl, JSON.stringify(value));
        } catch (error) {
            this.logger.warn(`Redis set error for key ${key}:`, error);
        }
    }

    async _deleteFromRedis(key) {
        try {
            await this.redisClient.del(key);
        } catch (error) {
            this.logger.warn(`Redis delete error for key ${key}:`, error);
        }
    }

    _getFromMemory(key) {
        const entry = this.memoryCache.get(key);
        if (entry) {
            if (entry.expiresAt > Date.now()) {
                return entry.data;
            } else {
                this.memoryCache.delete(key);
                this.cacheStats.evictions++;
            }
        }
        return null;
    }

    _setInMemory(key, value) {
        // Evict oldest entries if at max size
        if (this.memoryCache.size >= this.config.maxSize) {
            const oldestKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(oldestKey);
            this.cacheStats.evictions++;
        }
        
        this.memoryCache.set(key, value);
    }

    _deleteFromMemory(key) {
        this.memoryCache.delete(key);
    }

    _normalizeKey(key) {
        if (typeof key === 'object') {
            return Helpers.calculateHash(key);
        }
        return String(key);
    }

    _startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this._cleanupExpiredEntries();
        }, this.config.checkPeriod * 1000);
    }

    _cleanupExpiredEntries() {
        const now = Date.now();
        let evicted = 0;
        
        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.expiresAt <= now) {
                this.memoryCache.delete(key);
                evicted++;
            }
        }
        
        if (evicted > 0) {
            this.cacheStats.evictions += evicted;
            this.logger.debug(`Cleaned up ${evicted} expired cache entries`);
        }
    }

    async _redisHealthCheck() {
        try {
            const pong = await this.redisClient.ping();
            return {
                healthy: pong === 'PONG',
                connected: this.redisClient.connected
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                connected: false
            };
        }
    }
}

module.exports = { CacheManager };