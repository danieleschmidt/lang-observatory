/**
 * Advanced Resource Pooler
 * Intelligent resource management with adaptive sizing and connection reuse
 */

const { EventEmitter } = require('events');
const { Logger } = require('../utils/logger');

class ResourcePooler extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      minPoolSize: 5,
      maxPoolSize: 50,
      acquireTimeout: 30000,
      idleTimeout: 300000, // 5 minutes
      maxLifetime: 3600000, // 1 hour
      enableAdaptiveScaling: true,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.3,
      healthCheckInterval: 60000,
      enablePrewarm: true,
      enableMetrics: true,
      ...config,
    };

    this.logger = new Logger({ service: 'resource-pooler' });

    // Pool state
    this.pool = new Set();
    this.available = [];
    this.inUse = new Set();
    this.pending = new Map();
    this.totalCreated = 0;
    this.totalDestroyed = 0;

    // Resource factory
    this.resourceFactory = config.resourceFactory;
    this.resourceValidator = config.resourceValidator || this.defaultValidator;
    this.resourceDestroyer = config.resourceDestroyer || this.defaultDestroyer;

    // Adaptive scaling
    this.scalingMetrics = {
      acquisitionTimes: [],
      utilizationSamples: [],
      lastScaleEvent: 0,
    };

    // Statistics
    this.stats = {
      acquired: 0,
      released: 0,
      created: 0,
      destroyed: 0,
      timeouts: 0,
      validationFailures: 0,
      currentSize: 0,
      inUseCount: 0,
      availableCount: 0,
      averageAcquisitionTime: 0,
    };

    this.initialized = false;
  }

  async initialize() {
    if (!this.resourceFactory || typeof this.resourceFactory !== 'function') {
      throw new Error('Resource factory function is required');
    }

    try {
      // Create initial pool
      await this.fillToMinimum();

      // Start background tasks
      this.startHealthChecking();
      this.startAdaptiveScaling();
      this.startMetricsCollection();

      this.initialized = true;
      this.logger.info(
        `Resource Pooler initialized with ${this.available.length} resources`
      );

      return this;
    } catch (error) {
      this.logger.error('Failed to initialize Resource Pooler:', error);
      throw error;
    }
  }

  async acquire(timeout = this.config.acquireTimeout) {
    if (!this.initialized) {
      throw new Error('Resource Pooler not initialized');
    }

    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Try to get available resource immediately
      let resource = this.getAvailableResource();

      if (resource) {
        this.markAsInUse(resource);
        this.recordAcquisition(Date.now() - startTime);
        return resource;
      }

      // Create new resource if under limit
      if (this.pool.size < this.config.maxPoolSize) {
        resource = await this.createResource();
        if (resource) {
          this.markAsInUse(resource);
          this.recordAcquisition(Date.now() - startTime);
          return resource;
        }
      }

      // Wait for resource to become available
      resource = await this.waitForResource(requestId, timeout);
      this.markAsInUse(resource);
      this.recordAcquisition(Date.now() - startTime);

      return resource;
    } catch (error) {
      this.stats.timeouts++;
      this.logger.warn(
        `Resource acquisition failed after ${Date.now() - startTime}ms:`,
        error
      );
      throw error;
    }
  }

  async release(resource) {
    if (!resource) {
      return;
    }

    try {
      // Validate resource before returning to pool
      const isValid = await this.validateResource(resource);

      if (!isValid) {
        this.logger.warn(
          'Invalid resource detected during release, destroying'
        );
        await this.destroyResource(resource);
        return;
      }

      // Check resource age
      if (this.isResourceExpired(resource)) {
        this.logger.debug('Resource expired, destroying');
        await this.destroyResource(resource);
        return;
      }

      // Return to available pool
      this.inUse.delete(resource);
      this.available.push(resource);
      resource.lastUsed = Date.now();

      this.stats.released++;
      this.notifyWaitingRequest();

      this.emit('resourceReleased', { resource: resource.id });
    } catch (error) {
      this.logger.error('Error releasing resource:', error);
      await this.destroyResource(resource);
    }
  }

  async destroy() {
    this.logger.info('Destroying Resource Pooler...');

    // Cancel all pending requests
    for (const [requestId, pendingRequest] of this.pending.entries()) {
      pendingRequest.reject(new Error('Pool is being destroyed'));
    }
    this.pending.clear();

    // Destroy all resources
    const destroyPromises = [];

    for (const resource of this.pool) {
      destroyPromises.push(this.destroyResource(resource));
    }

    await Promise.allSettled(destroyPromises);

    // Stop background tasks
    this.stopBackgroundTasks();

    this.removeAllListeners();
    this.logger.info('Resource Pooler destroyed');
  }

  // Resource management
  async createResource() {
    try {
      const resource = await this.resourceFactory();

      // Add metadata
      resource.id = this.generateResourceId();
      resource.createdAt = Date.now();
      resource.lastUsed = Date.now();
      resource.usageCount = 0;

      this.pool.add(resource);
      this.totalCreated++;
      this.stats.created++;

      this.logger.debug(`Created resource: ${resource.id}`);
      this.emit('resourceCreated', { resource: resource.id });

      return resource;
    } catch (error) {
      this.logger.error('Failed to create resource:', error);
      throw error;
    }
  }

  async destroyResource(resource) {
    if (!resource) return;

    try {
      // Remove from all collections
      this.pool.delete(resource);
      this.inUse.delete(resource);
      const availableIndex = this.available.indexOf(resource);
      if (availableIndex !== -1) {
        this.available.splice(availableIndex, 1);
      }

      // Call custom destroyer
      if (this.resourceDestroyer) {
        await this.resourceDestroyer(resource);
      }

      this.totalDestroyed++;
      this.stats.destroyed++;

      this.logger.debug(`Destroyed resource: ${resource.id}`);
      this.emit('resourceDestroyed', { resource: resource.id });
    } catch (error) {
      this.logger.error('Error destroying resource:', error);
    }
  }

  getAvailableResource() {
    // Get least recently used resource
    if (this.available.length === 0) {
      return null;
    }

    // Sort by last used time (oldest first for better distribution)
    this.available.sort((a, b) => a.lastUsed - b.lastUsed);
    return this.available.shift();
  }

  markAsInUse(resource) {
    this.inUse.add(resource);
    resource.usageCount = (resource.usageCount || 0) + 1;
    resource.lastUsed = Date.now();
    this.stats.acquired++;
  }

  async waitForResource(requestId, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('Resource acquisition timeout'));
      }, timeout);

      this.pending.set(requestId, {
        resolve: resource => {
          clearTimeout(timeoutHandle);
          resolve(resource);
        },
        reject: error => {
          clearTimeout(timeoutHandle);
          reject(error);
        },
        requestedAt: Date.now(),
      });
    });
  }

  notifyWaitingRequest() {
    if (this.pending.size === 0 || this.available.length === 0) {
      return;
    }

    // Get oldest pending request
    const [requestId, pendingRequest] = Array.from(this.pending.entries()).sort(
      ([, a], [, b]) => a.requestedAt - b.requestedAt
    )[0];

    const resource = this.getAvailableResource();
    if (resource) {
      this.pending.delete(requestId);
      pendingRequest.resolve(resource);
    }
  }

  // Resource validation
  async validateResource(resource) {
    try {
      return await this.resourceValidator(resource);
    } catch (error) {
      this.stats.validationFailures++;
      this.logger.warn(`Resource validation failed for ${resource.id}:`, error);
      return false;
    }
  }

  defaultValidator(resource) {
    return resource && !resource.destroyed;
  }

  defaultDestroyer(resource) {
    if (resource && resource.close) {
      return resource.close();
    }
    if (resource && resource.destroy) {
      return resource.destroy();
    }
    return Promise.resolve();
  }

  isResourceExpired(resource) {
    if (!resource || !resource.createdAt) return true;

    const age = Date.now() - resource.createdAt;
    return age > this.config.maxLifetime;
  }

  // Pool management
  async fillToMinimum() {
    const needed = this.config.minPoolSize - this.pool.size;
    if (needed <= 0) return;

    const createPromises = [];
    for (let i = 0; i < needed; i++) {
      createPromises.push(
        this.createResource()
          .then(resource => {
            if (resource) {
              this.available.push(resource);
            }
          })
          .catch(error => {
            this.logger.error('Failed to create resource during fill:', error);
          })
      );
    }

    await Promise.allSettled(createPromises);
    this.logger.debug(`Filled pool to ${this.pool.size} resources`);
  }

  async scaleUp() {
    if (this.pool.size >= this.config.maxPoolSize) {
      return;
    }

    const scaleAmount = Math.min(
      Math.ceil(this.pool.size * 0.5), // Scale by 50%
      this.config.maxPoolSize - this.pool.size
    );

    this.logger.info(`Scaling up by ${scaleAmount} resources`);

    const createPromises = [];
    for (let i = 0; i < scaleAmount; i++) {
      createPromises.push(
        this.createResource()
          .then(resource => {
            if (resource) {
              this.available.push(resource);
            }
          })
          .catch(error => {
            this.logger.error(
              'Failed to create resource during scale up:',
              error
            );
          })
      );
    }

    await Promise.allSettled(createPromises);
    this.scalingMetrics.lastScaleEvent = Date.now();
  }

  async scaleDown() {
    if (this.pool.size <= this.config.minPoolSize) {
      return;
    }

    const maxToRemove = this.pool.size - this.config.minPoolSize;
    const idleResources = this.available.filter(resource => {
      const idleTime = Date.now() - resource.lastUsed;
      return idleTime > this.config.idleTimeout;
    });

    const toRemove = Math.min(idleResources.length, maxToRemove);
    if (toRemove === 0) return;

    this.logger.info(`Scaling down by ${toRemove} resources`);

    const destroyPromises = [];
    for (let i = 0; i < toRemove; i++) {
      const resource = idleResources[i];
      const index = this.available.indexOf(resource);
      if (index !== -1) {
        this.available.splice(index, 1);
        destroyPromises.push(this.destroyResource(resource));
      }
    }

    await Promise.allSettled(destroyPromises);
    this.scalingMetrics.lastScaleEvent = Date.now();
  }

  // Background tasks
  startHealthChecking() {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  async performHealthCheck() {
    const healthCheckPromises = [];

    // Check available resources
    for (const resource of [...this.available]) {
      healthCheckPromises.push(
        this.validateResource(resource)
          .then(isValid => {
            if (!isValid) {
              const index = this.available.indexOf(resource);
              if (index !== -1) {
                this.available.splice(index, 1);
              }
              return this.destroyResource(resource);
            }
          })
          .catch(error => {
            this.logger.error(
              `Health check failed for resource ${resource.id}:`,
              error
            );
          })
      );
    }

    await Promise.allSettled(healthCheckPromises);

    // Ensure minimum pool size
    await this.fillToMinimum();

    // Update stats
    this.updateStats();
  }

  startAdaptiveScaling() {
    if (!this.config.enableAdaptiveScaling) return;

    this.scalingTimer = setInterval(async () => {
      await this.performAdaptiveScaling();
    }, 30000); // Every 30 seconds
  }

  async performAdaptiveScaling() {
    const utilization = this.calculateUtilization();
    this.scalingMetrics.utilizationSamples.push({
      utilization,
      timestamp: Date.now(),
    });

    // Keep only last 10 samples
    if (this.scalingMetrics.utilizationSamples.length > 10) {
      this.scalingMetrics.utilizationSamples.shift();
    }

    const avgUtilization =
      this.scalingMetrics.utilizationSamples.reduce(
        (sum, sample) => sum + sample.utilization,
        0
      ) / this.scalingMetrics.utilizationSamples.length;

    // Prevent frequent scaling
    const timeSinceLastScale = Date.now() - this.scalingMetrics.lastScaleEvent;
    if (timeSinceLastScale < 60000) {
      // 1 minute cooldown
      return;
    }

    if (avgUtilization > this.config.scaleUpThreshold) {
      await this.scaleUp();
    } else if (avgUtilization < this.config.scaleDownThreshold) {
      await this.scaleDown();
    }
  }

  startMetricsCollection() {
    if (!this.config.enableMetrics) return;

    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, 5000); // Every 5 seconds
  }

  collectMetrics() {
    this.updateStats();
    this.emit('metricsCollected', this.getStats());
  }

  stopBackgroundTasks() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.scalingTimer) {
      clearInterval(this.scalingTimer);
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
  }

  // Utility methods
  calculateUtilization() {
    if (this.pool.size === 0) return 0;
    return this.inUse.size / this.pool.size;
  }

  recordAcquisition(duration) {
    this.scalingMetrics.acquisitionTimes.push(duration);
    if (this.scalingMetrics.acquisitionTimes.length > 100) {
      this.scalingMetrics.acquisitionTimes.shift();
    }

    // Update average
    const totalTime = this.scalingMetrics.acquisitionTimes.reduce(
      (sum, time) => sum + time,
      0
    );
    this.stats.averageAcquisitionTime =
      totalTime / this.scalingMetrics.acquisitionTimes.length;
  }

  updateStats() {
    this.stats.currentSize = this.pool.size;
    this.stats.inUseCount = this.inUse.size;
    this.stats.availableCount = this.available.length;
  }

  generateResourceId() {
    return `resource_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API
  getStats() {
    return {
      ...this.stats,
      utilization: this.calculateUtilization(),
      pendingRequests: this.pending.size,
      totalCreated: this.totalCreated,
      totalDestroyed: this.totalDestroyed,
      efficiency: this.stats.acquired / Math.max(this.stats.created, 1),
      config: {
        minPoolSize: this.config.minPoolSize,
        maxPoolSize: this.config.maxPoolSize,
        acquireTimeout: this.config.acquireTimeout,
      },
    };
  }

  getDetailedStats() {
    return {
      ...this.getStats(),
      resources: {
        available: this.available.map(r => ({
          id: r.id,
          age: Date.now() - r.createdAt,
          idleTime: Date.now() - r.lastUsed,
          usageCount: r.usageCount,
        })),
        inUse: Array.from(this.inUse).map(r => ({
          id: r.id,
          age: Date.now() - r.createdAt,
          usageCount: r.usageCount,
        })),
      },
      scalingMetrics: {
        recentUtilization: this.scalingMetrics.utilizationSamples.slice(-5),
        averageAcquisitionTime: this.stats.averageAcquisitionTime,
        lastScaleEvent: this.scalingMetrics.lastScaleEvent,
      },
    };
  }
}

module.exports = { ResourcePooler };
