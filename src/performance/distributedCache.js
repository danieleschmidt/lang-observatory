/**
 * Distributed Cache System
 * High-performance distributed caching with intelligent prefetching and compression
 */

const { EventEmitter } = require('events');
const { Logger } = require('../utils/logger');
const { SecurityManager } = require('../quantum/securityManager');

class DistributedCache extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            defaultTTL: 3600000, // 1 hour
            maxMemoryUsage: 512 * 1024 * 1024, // 512MB
            maxKeys: 100000,
            compressionThreshold: 1024, // 1KB
            enableCompression: true,
            enablePrefetching: true,
            enableDistribution: true,
            shardCount: 16,
            replicationFactor: 2,
            nodes: ['localhost:6379'], // Redis-like nodes
            ...config
        };
        
        this.logger = new Logger({ service: 'distributed-cache' });
        this.security = new SecurityManager(config.security || {});
        
        // Cache storage
        this.localShards = new Array(this.config.shardCount);
        this.remoteNodes = new Map();
        this.accessPatterns = new Map();
        this.memoryUsage = 0;
        
        // Performance tracking
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0,
            compressions: 0,
            prefetches: 0,
            networkRequests: 0,
            totalLatency: 0
        };
        
        // Initialize shards
        for (let i = 0; i < this.config.shardCount; i++) {
            this.localShards[i] = new Map();
        }
        
        // Background tasks
        this.cleanupTimer = null;
        this.prefetchTimer = null;
        this.syncTimer = null;
        
        this.initialized = false;
    }

    async initialize() {
        try {
            await this.security.initialize();
            
            // Initialize compression if enabled
            if (this.config.enableCompression) {
                this.compressor = new CompressionManager();
                await this.compressor.initialize();
            }
            
            // Initialize distributed nodes
            if (this.config.enableDistribution) {
                await this.initializeDistributedNodes();
            }
            
            // Start background tasks
            this.startBackgroundTasks();
            
            this.initialized = true;
            this.logger.info(`Distributed Cache initialized with ${this.config.shardCount} shards`);
            
            return this;
        } catch (error) {
            this.logger.error('Failed to initialize Distributed Cache:', error);
            throw error;
        }
    }

    async initializeDistributedNodes() {
        for (const nodeAddress of this.config.nodes) {
            try {
                const node = new CacheNode(nodeAddress, {
                    timeout: 5000,
                    maxRetries: 3
                });
                
                await node.initialize();
                this.remoteNodes.set(nodeAddress, node);
                this.logger.info(`Connected to cache node: ${nodeAddress}`);
                
            } catch (error) {
                this.logger.warn(`Failed to connect to cache node ${nodeAddress}:`, error);
            }
        }
    }

    // Core cache operations
    async get(key, options = {}) {
        if (!this.initialized) {
            throw new Error('Distributed Cache not initialized');
        }

        const startTime = Date.now();
        
        try {
            // Validate key
            const validatedKey = await this.validateKey(key);
            
            // Try local cache first
            const localResult = await this.getLocal(validatedKey, options);
            if (localResult !== undefined) {
                this.stats.hits++;
                this.recordAccessPattern(validatedKey, 'hit');
                this.emit('cacheHit', { key: validatedKey, source: 'local' });
                return localResult;
            }

            // Try distributed cache
            if (this.config.enableDistribution && this.remoteNodes.size > 0) {
                const distributedResult = await this.getDistributed(validatedKey, options);
                if (distributedResult !== undefined) {
                    // Cache locally for future access
                    await this.setLocal(validatedKey, distributedResult, options);
                    
                    this.stats.hits++;
                    this.stats.networkRequests++;
                    this.recordAccessPattern(validatedKey, 'distributed_hit');
                    this.emit('cacheHit', { key: validatedKey, source: 'distributed' });
                    return distributedResult;
                }
            }

            // Cache miss
            this.stats.misses++;
            this.recordAccessPattern(validatedKey, 'miss');
            this.emit('cacheMiss', { key: validatedKey });
            
            // Trigger prefetch if enabled
            if (this.config.enablePrefetching) {
                this.schedulePrefetch(validatedKey);
            }
            
            return undefined;

        } catch (error) {
            this.logger.error(`Cache get error for key ${key}:`, error);
            this.emit('cacheError', { key, operation: 'get', error });
            return undefined;
        } finally {
            this.stats.totalLatency += Date.now() - startTime;
        }
    }

    async set(key, value, options = {}) {
        if (!this.initialized) {
            throw new Error('Distributed Cache not initialized');
        }

        const startTime = Date.now();
        
        try {
            const validatedKey = await this.validateKey(key);
            const ttl = options.ttl || this.config.defaultTTL;
            
            // Prepare cache entry
            const entry = await this.prepareCacheEntry(value, ttl);
            
            // Set in local cache
            await this.setLocal(validatedKey, entry.value, { ...options, compressed: entry.compressed });
            
            // Set in distributed cache
            if (this.config.enableDistribution && this.remoteNodes.size > 0) {
                await this.setDistributed(validatedKey, entry.value, options);
            }
            
            this.stats.sets++;
            this.recordAccessPattern(validatedKey, 'set');
            this.emit('cacheSet', { key: validatedKey, compressed: entry.compressed });
            
        } catch (error) {
            this.logger.error(`Cache set error for key ${key}:`, error);
            this.emit('cacheError', { key, operation: 'set', error });
            throw error;
        } finally {
            this.stats.totalLatency += Date.now() - startTime;
        }
    }

    async delete(key, options = {}) {
        if (!this.initialized) {
            throw new Error('Distributed Cache not initialized');
        }

        try {
            const validatedKey = await this.validateKey(key);
            
            // Delete from local cache
            const localDeleted = await this.deleteLocal(validatedKey);
            
            // Delete from distributed cache
            let distributedDeleted = false;
            if (this.config.enableDistribution && this.remoteNodes.size > 0) {
                distributedDeleted = await this.deleteDistributed(validatedKey);
            }
            
            const deleted = localDeleted || distributedDeleted;
            
            if (deleted) {
                this.stats.deletes++;
                this.recordAccessPattern(validatedKey, 'delete');
                this.emit('cacheDelete', { key: validatedKey });
            }
            
            return deleted;

        } catch (error) {
            this.logger.error(`Cache delete error for key ${key}:`, error);
            this.emit('cacheError', { key, operation: 'delete', error });
            return false;
        }
    }

    async clear(pattern = '*') {
        if (!this.initialized) {
            throw new Error('Distributed Cache not initialized');
        }

        try {
            let deletedCount = 0;
            
            // Clear local shards
            for (const shard of this.localShards) {
                const keysToDelete = [];
                
                for (const key of shard.keys()) {
                    if (this.matchesPattern(key, pattern)) {
                        keysToDelete.push(key);
                    }
                }
                
                for (const key of keysToDelete) {
                    shard.delete(key);
                    deletedCount++;
                }
            }
            
            // Clear distributed cache
            if (this.config.enableDistribution && this.remoteNodes.size > 0) {
                const distributedDeleted = await this.clearDistributed(pattern);
                deletedCount += distributedDeleted;
            }
            
            this.logger.info(`Cleared ${deletedCount} cache entries matching pattern: ${pattern}`);
            this.emit('cacheCleared', { pattern, count: deletedCount });
            
            return deletedCount;

        } catch (error) {
            this.logger.error(`Cache clear error for pattern ${pattern}:`, error);
            throw error;
        }
    }

    // Local cache operations
    async getLocal(key, options = {}) {
        const shardIndex = this.getShardIndex(key);
        const shard = this.localShards[shardIndex];
        const entry = shard.get(key);
        
        if (!entry) return undefined;
        
        // Check TTL
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            shard.delete(key);
            this.stats.evictions++;
            return undefined;
        }
        
        // Update access time
        entry.lastAccessed = Date.now();
        entry.accessCount = (entry.accessCount || 0) + 1;
        
        // Decompress if needed
        let value = entry.value;
        if (entry.compressed && this.compressor) {
            value = await this.compressor.decompress(value);
        }
        
        return value;
    }

    async setLocal(key, value, options = {}) {
        const shardIndex = this.getShardIndex(key);
        const shard = this.localShards[shardIndex];
        const ttl = options.ttl || this.config.defaultTTL;
        
        // Check memory limits
        await this.checkMemoryLimits();
        
        const entry = {
            value,
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            expiresAt: ttl > 0 ? Date.now() + ttl : null,
            accessCount: 1,
            size: this.calculateSize(value),
            compressed: options.compressed || false
        };
        
        // Remove old entry if exists
        const oldEntry = shard.get(key);
        if (oldEntry) {
            this.memoryUsage -= oldEntry.size;
        }
        
        shard.set(key, entry);
        this.memoryUsage += entry.size;
    }

    async deleteLocal(key) {
        const shardIndex = this.getShardIndex(key);
        const shard = this.localShards[shardIndex];
        const entry = shard.get(key);
        
        if (entry) {
            shard.delete(key);
            this.memoryUsage -= entry.size;
            return true;
        }
        
        return false;
    }

    // Distributed cache operations
    async getDistributed(key, options = {}) {
        const nodes = this.selectNodesForKey(key);
        
        for (const node of nodes) {
            try {
                const result = await node.get(key, options);
                if (result !== undefined) {
                    return result;
                }
            } catch (error) {
                this.logger.warn(`Failed to get from node ${node.address}:`, error);
            }
        }
        
        return undefined;
    }

    async setDistributed(key, value, options = {}) {
        const nodes = this.selectNodesForKey(key);
        const promises = [];
        
        for (const node of nodes) {
            promises.push(
                node.set(key, value, options).catch(error => {
                    this.logger.warn(`Failed to set on node ${node.address}:`, error);
                })
            );
        }
        
        // Wait for at least one successful write
        await Promise.race(promises);
    }

    async deleteDistributed(key) {
        const nodes = this.selectNodesForKey(key);
        const promises = [];
        let deleted = false;
        
        for (const node of nodes) {
            promises.push(
                node.delete(key).then(result => {
                    if (result) deleted = true;
                }).catch(error => {
                    this.logger.warn(`Failed to delete from node ${node.address}:`, error);
                })
            );
        }
        
        await Promise.allSettled(promises);
        return deleted;
    }

    async clearDistributed(pattern) {
        const promises = [];
        let totalDeleted = 0;
        
        for (const node of this.remoteNodes.values()) {
            promises.push(
                node.clear(pattern).then(count => {
                    totalDeleted += count;
                }).catch(error => {
                    this.logger.warn(`Failed to clear from node ${node.address}:`, error);
                })
            );
        }
        
        await Promise.allSettled(promises);
        return totalDeleted;
    }

    // Utility methods
    async validateKey(key) {
        if (!key || typeof key !== 'string') {
            throw new Error('Cache key must be a non-empty string');
        }
        
        if (key.length > 1000) {
            throw new Error('Cache key too long');
        }
        
        // Security validation
        const securityCheck = await this.security.validateCacheKey(key);
        if (!securityCheck.safe) {
            throw new Error(`Unsafe cache key: ${securityCheck.reason}`);
        }
        
        return key;
    }

    async prepareCacheEntry(value, ttl) {
        let processedValue = value;
        let compressed = false;
        
        // Serialize if needed
        if (typeof value === 'object') {
            processedValue = JSON.stringify(value);
        }
        
        // Compress if enabled and value is large enough
        if (this.config.enableCompression && 
            this.compressor && 
            processedValue.length > this.config.compressionThreshold) {
            
            try {
                processedValue = await this.compressor.compress(processedValue);
                compressed = true;
                this.stats.compressions++;
            } catch (error) {
                this.logger.warn('Compression failed, storing uncompressed:', error);
            }
        }
        
        return { value: processedValue, compressed };
    }

    getShardIndex(key) {
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            const char = key.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash) % this.config.shardCount;
    }

    selectNodesForKey(key) {
        if (this.remoteNodes.size === 0) return [];
        
        const nodes = Array.from(this.remoteNodes.values());
        const hash = this.getShardIndex(key);
        const selectedNodes = [];
        
        // Select primary node
        const primaryIndex = hash % nodes.length;
        selectedNodes.push(nodes[primaryIndex]);
        
        // Select replicas
        for (let i = 1; i < this.config.replicationFactor && i < nodes.length; i++) {
            const replicaIndex = (primaryIndex + i) % nodes.length;
            selectedNodes.push(nodes[replicaIndex]);
        }
        
        return selectedNodes;
    }

    calculateSize(value) {
        if (typeof value === 'string') {
            return Buffer.byteLength(value, 'utf8');
        } else if (Buffer.isBuffer(value)) {
            return value.length;
        } else {
            return Buffer.byteLength(JSON.stringify(value), 'utf8');
        }
    }

    matchesPattern(key, pattern) {
        if (pattern === '*') return true;
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            return regex.test(key);
        }
        return key === pattern;
    }

    async checkMemoryLimits() {
        if (this.memoryUsage > this.config.maxMemoryUsage) {
            await this.evictLeastRecentlyUsed();
        }
        
        const totalKeys = this.localShards.reduce((sum, shard) => sum + shard.size, 0);
        if (totalKeys > this.config.maxKeys) {
            await this.evictLeastRecentlyUsed();
        }
    }

    async evictLeastRecentlyUsed() {
        const candidates = [];
        
        // Collect all entries
        for (let i = 0; i < this.config.shardCount; i++) {
            const shard = this.localShards[i];
            for (const [key, entry] of shard.entries()) {
                candidates.push({ key, entry, shardIndex: i });
            }
        }
        
        // Sort by last accessed time
        candidates.sort((a, b) => a.entry.lastAccessed - b.entry.lastAccessed);
        
        // Evict oldest 10%
        const evictCount = Math.max(1, Math.floor(candidates.length * 0.1));
        
        for (let i = 0; i < evictCount; i++) {
            const candidate = candidates[i];
            const shard = this.localShards[candidate.shardIndex];
            shard.delete(candidate.key);
            this.memoryUsage -= candidate.entry.size;
            this.stats.evictions++;
        }
        
        this.logger.debug(`Evicted ${evictCount} cache entries`);
    }

    recordAccessPattern(key, type) {
        if (!this.accessPatterns.has(key)) {
            this.accessPatterns.set(key, {
                key,
                hits: 0,
                misses: 0,
                sets: 0,
                lastAccessed: Date.now(),
                accessFrequency: 0
            });
        }
        
        const pattern = this.accessPatterns.get(key);
        pattern.lastAccessed = Date.now();
        pattern.accessFrequency++;
        
        switch (type) {
            case 'hit':
            case 'distributed_hit':
                pattern.hits++;
                break;
            case 'miss':
                pattern.misses++;
                break;
            case 'set':
                pattern.sets++;
                break;
        }
        
        // Cleanup old patterns periodically
        if (this.accessPatterns.size > 10000) {
            this.cleanupAccessPatterns();
        }
    }

    cleanupAccessPatterns() {
        const cutoff = Date.now() - 3600000; // 1 hour
        let cleaned = 0;
        
        for (const [key, pattern] of this.accessPatterns.entries()) {
            if (pattern.lastAccessed < cutoff) {
                this.accessPatterns.delete(key);
                cleaned++;
            }
        }
        
        this.logger.debug(`Cleaned up ${cleaned} access patterns`);
    }

    schedulePrefetch(key) {
        // Simple prefetching logic - could be much more sophisticated
        const pattern = this.accessPatterns.get(key);
        if (pattern && pattern.accessFrequency > 5) {
            setTimeout(async () => {
                try {
                    // Try to prefetch related keys
                    const relatedKeys = this.findRelatedKeys(key);
                    for (const relatedKey of relatedKeys.slice(0, 3)) {
                        await this.get(relatedKey);
                        this.stats.prefetches++;
                    }
                } catch (error) {
                    this.logger.warn('Prefetch failed:', error);
                }
            }, 100);
        }
    }

    findRelatedKeys(key) {
        // Simple heuristic - find keys with similar prefixes
        const keyPrefix = key.split(':')[0];
        const relatedKeys = [];
        
        for (const patternKey of this.accessPatterns.keys()) {
            if (patternKey !== key && patternKey.startsWith(keyPrefix)) {
                relatedKeys.push(patternKey);
            }
        }
        
        return relatedKeys;
    }

    startBackgroundTasks() {
        // Cleanup expired entries every 5 minutes
        this.cleanupTimer = setInterval(() => {
            this.cleanupExpiredEntries();
        }, 5 * 60 * 1000);
        
        // Prefetch popular keys every minute
        if (this.config.enablePrefetching) {
            this.prefetchTimer = setInterval(() => {
                this.prefetchPopularKeys();
            }, 60 * 1000);
        }
        
        // Sync with distributed nodes every 30 seconds
        if (this.config.enableDistribution) {
            this.syncTimer = setInterval(() => {
                this.syncWithRemoteNodes();
            }, 30 * 1000);
        }
    }

    cleanupExpiredEntries() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const shard of this.localShards) {
            const expiredKeys = [];
            
            for (const [key, entry] of shard.entries()) {
                if (entry.expiresAt && now > entry.expiresAt) {
                    expiredKeys.push(key);
                }
            }
            
            for (const key of expiredKeys) {
                const entry = shard.get(key);
                shard.delete(key);
                this.memoryUsage -= entry.size;
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            this.logger.debug(`Cleaned up ${cleaned} expired cache entries`);
        }
    }

    async prefetchPopularKeys() {
        // Find most frequently accessed keys that aren't in cache
        const popularKeys = Array.from(this.accessPatterns.values())
            .filter(pattern => pattern.accessFrequency > 3)
            .sort((a, b) => b.accessFrequency - a.accessFrequency)
            .slice(0, 10);
        
        for (const pattern of popularKeys) {
            try {
                const exists = await this.getLocal(pattern.key);
                if (!exists) {
                    // Try to fetch from distributed cache
                    await this.get(pattern.key);
                }
            } catch (error) {
                // Ignore prefetch errors
            }
        }
    }

    async syncWithRemoteNodes() {
        // Health check remote nodes
        const healthPromises = Array.from(this.remoteNodes.values()).map(async node => {
            try {
                await node.ping();
                return { node, healthy: true };
            } catch (error) {
                return { node, healthy: false, error };
            }
        });
        
        const healthResults = await Promise.allSettled(healthPromises);
        
        for (const result of healthResults) {
            if (result.status === 'fulfilled' && !result.value.healthy) {
                this.logger.warn(`Node ${result.value.node.address} is unhealthy:`, result.value.error);
            }
        }
    }

    // Statistics and monitoring
    getStats() {
        const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
        const avgLatency = this.stats.totalLatency / (this.stats.hits + this.stats.misses) || 0;
        const totalKeys = this.localShards.reduce((sum, shard) => sum + shard.size, 0);
        
        return {
            ...this.stats,
            hitRate,
            avgLatency,
            memoryUsage: this.memoryUsage,
            totalKeys,
            shards: this.localShards.length,
            remoteNodes: this.remoteNodes.size,
            accessPatterns: this.accessPatterns.size
        };
    }

    async shutdown() {
        this.logger.info('Shutting down Distributed Cache...');
        
        // Stop background tasks
        if (this.cleanupTimer) clearInterval(this.cleanupTimer);
        if (this.prefetchTimer) clearInterval(this.prefetchTimer);
        if (this.syncTimer) clearInterval(this.syncTimer);
        
        // Close remote connections
        const closePromises = Array.from(this.remoteNodes.values()).map(node => 
            node.close().catch(error => 
                this.logger.warn(`Failed to close node ${node.address}:`, error)
            )
        );
        
        await Promise.allSettled(closePromises);
        
        // Clear local cache
        for (const shard of this.localShards) {
            shard.clear();
        }
        
        this.removeAllListeners();
        this.logger.info('Distributed Cache shutdown complete');
    }
}

// Simple compression manager
class CompressionManager {
    async initialize() {
        // Initialize compression (using zlib in real implementation)
        this.algorithm = 'gzip';
    }

    async compress(data) {
        // Simulated compression - in real implementation use zlib
        if (typeof data === 'string' && data.length > 100) {
            return `COMPRESSED:${data.slice(0, 50)}...`;
        }
        return data;
    }

    async decompress(data) {
        // Simulated decompression
        if (typeof data === 'string' && data.startsWith('COMPRESSED:')) {
            return data.replace('COMPRESSED:', '');
        }
        return data;
    }
}

// Cache node for distributed operations
class CacheNode {
    constructor(address, options = {}) {
        this.address = address;
        this.options = options;
        this.connected = false;
    }

    async initialize() {
        // Simulate connection
        this.connected = true;
    }

    async get(key, options = {}) {
        if (!this.connected) throw new Error('Node not connected');
        // Simulate remote get operation
        await this.simulateNetworkDelay();
        return undefined; // Simulate cache miss
    }

    async set(key, value, options = {}) {
        if (!this.connected) throw new Error('Node not connected');
        await this.simulateNetworkDelay();
    }

    async delete(key) {
        if (!this.connected) throw new Error('Node not connected');
        await this.simulateNetworkDelay();
        return false;
    }

    async clear(pattern) {
        if (!this.connected) throw new Error('Node not connected');
        await this.simulateNetworkDelay();
        return 0;
    }

    async ping() {
        if (!this.connected) throw new Error('Node not connected');
        await this.simulateNetworkDelay(10);
    }

    async close() {
        this.connected = false;
    }

    async simulateNetworkDelay(baseMs = 50) {
        await new Promise(resolve => 
            setTimeout(resolve, baseMs + Math.random() * 50)
        );
    }
}

module.exports = { DistributedCache, CompressionManager, CacheNode };