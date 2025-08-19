/**
 * Multi-Region Orchestrator
 * Manages global deployment, data replication, and compliance across regions
 */

const { EventEmitter } = require('events');
const { Logger } = require('../utils/logger');

class MultiRegionOrchestrator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = new Logger({ component: 'MultiRegionOrchestrator' });
    this.config = {
      regions: {
        primary: 'us-east-1',
        secondary: ['eu-west-1', 'ap-southeast-1', 'us-west-2'],
        ...config.regions,
      },
      replication: {
        syncMode: 'async', // 'sync' | 'async' | 'hybrid'
        batchSize: 1000,
        maxLatency: 5000, // 5 seconds max replication lag
        retryAttempts: 3,
        ...config.replication,
      },
      compliance: {
        dataLocalization: true,
        crossBorderRestrictions: true,
        encryptionInTransit: true,
        regionalPolicies: new Map([
          ['eu-west-1', { gdpr: true, dataResidency: true, privacy: 'strict' }],
          [
            'ap-southeast-1',
            { pdpa: true, dataResidency: true, privacy: 'moderate' },
          ],
          ['us-east-1', { ccpa: true, hipaa: false, privacy: 'standard' }],
          ['us-west-2', { ccpa: true, hipaa: true, privacy: 'standard' }],
        ]),
        ...config.compliance,
      },
      failover: {
        autoFailover: true,
        healthCheckInterval: 30000, // 30 seconds
        failoverThreshold: 3, // consecutive failures
        recoveryThreshold: 2, // consecutive successes
        ...config.failover,
      },
      loadBalancing: {
        strategy: 'latency', // 'latency' | 'round-robin' | 'weighted' | 'geography'
        weights: new Map([
          ['us-east-1', 0.4],
          ['eu-west-1', 0.3],
          ['ap-southeast-1', 0.2],
          ['us-west-2', 0.1],
        ]),
        ...config.loadBalancing,
      },
      ...config,
    };

    // Region state management
    this.regionStates = new Map();
    this.replicationQueues = new Map();
    this.healthCheckResults = new Map();
    this.failoverHistory = [];
    this.activeConnections = new Map();
    this.dataCache = new Map();

    // Metrics and monitoring
    this.metrics = {
      totalRequests: 0,
      requestsByRegion: new Map(),
      replicationLag: new Map(),
      failovers: 0,
      crossRegionQueries: 0,
      complianceViolations: 0,
      dataLocalizationEvents: 0,
    };

    this.initialized = false;
  }

  async initialize() {
    this.logger.info('Initializing Multi-Region Orchestrator...');

    // Initialize all regions
    await this.initializeRegions();

    // Setup replication infrastructure
    await this.setupReplication();

    // Configure compliance monitoring
    await this.setupComplianceMonitoring();

    // Start health monitoring
    this.startHealthMonitoring();

    // Setup load balancing
    this.setupLoadBalancing();

    // Initialize failover mechanisms
    this.setupFailoverMechanisms();

    this.initialized = true;
    this.logger.info('Multi-Region Orchestrator initialized successfully');

    return this;
  }

  async initializeRegions() {
    const allRegions = [
      this.config.regions.primary,
      ...this.config.regions.secondary,
    ];

    for (const region of allRegions) {
      try {
        const regionState = {
          name: region,
          status: 'initializing',
          isPrimary: region === this.config.regions.primary,
          healthScore: 1.0,
          lastHealthCheck: Date.now(),
          connections: 0,
          replicationLag: 0,
          compliance: this.config.compliance.regionalPolicies.get(region) || {},
          endpoints: await this.discoverRegionEndpoints(region),
          dataResidency: new Set(),
        };

        this.regionStates.set(region, regionState);
        this.replicationQueues.set(region, []);
        this.healthCheckResults.set(region, []);
        this.metrics.requestsByRegion.set(region, 0);
        this.metrics.replicationLag.set(region, 0);

        this.logger.info(`Region ${region} initialized`, {
          isPrimary: regionState.isPrimary,
          compliance: regionState.compliance,
        });
      } catch (error) {
        this.logger.error(`Failed to initialize region ${region}:`, error);
        this.regionStates.set(region, {
          name: region,
          status: 'failed',
          error: error.message,
        });
      }
    }

    // Update region statuses after initialization
    await this.updateRegionStatuses();
  }

  async discoverRegionEndpoints(region) {
    // Simulate endpoint discovery (in production, use actual service discovery)
    const basePort = 8000;
    const regionPorts = {
      'us-east-1': basePort + 1,
      'eu-west-1': basePort + 2,
      'ap-southeast-1': basePort + 3,
      'us-west-2': basePort + 4,
    };

    return {
      api: `https://api-${region}.lang-observatory.com`,
      metrics: `https://metrics-${region}.lang-observatory.com`,
      traces: `https://traces-${region}.lang-observatory.com`,
      internal: `http://internal-${region}:${regionPorts[region] || basePort}`,
    };
  }

  async setupReplication() {
    this.logger.info('Setting up cross-region replication...');

    // Initialize replication workers for each region
    for (const [region, state] of this.regionStates) {
      if (state.status === 'failed') continue;

      // Start replication worker
      this.startReplicationWorker(region);
    }

    // Setup replication monitoring
    setInterval(() => {
      this.monitorReplicationLag();
    }, 10000); // Every 10 seconds
  }

  startReplicationWorker(region) {
    const processQueue = async () => {
      const queue = this.replicationQueues.get(region);
      if (!queue || queue.length === 0) return;

      const batch = queue.splice(0, this.config.replication.batchSize);

      try {
        await this.replicateDataBatch(region, batch);
        this.updateReplicationMetrics(region, batch.length, true);
      } catch (error) {
        this.logger.error(`Replication failed for region ${region}:`, error);
        this.updateReplicationMetrics(region, batch.length, false);

        // Re-queue failed items with retry logic
        batch.forEach(item => {
          item.retryCount = (item.retryCount || 0) + 1;
          if (item.retryCount <= this.config.replication.retryAttempts) {
            queue.push(item);
          }
        });
      }
    };

    // Process replication queue at intervals
    const interval = this.config.replication.syncMode === 'sync' ? 1000 : 5000;
    setInterval(processQueue, interval);
  }

  async replicateDataBatch(targetRegion, batch) {
    const regionState = this.regionStates.get(targetRegion);
    if (!regionState || regionState.status !== 'healthy') {
      throw new Error(`Region ${targetRegion} not available for replication`);
    }

    // Check compliance before replication
    for (const item of batch) {
      if (!this.validateCrossRegionCompliance(item, targetRegion)) {
        throw new Error(
          `Compliance violation: Cannot replicate data to ${targetRegion}`
        );
      }
    }

    // Simulate replication (in production, use actual replication mechanism)
    const startTime = Date.now();

    // Add artificial latency based on region distance
    const latencyMap = {
      'us-east-1': { 'eu-west-1': 100, 'ap-southeast-1': 200, 'us-west-2': 50 },
      'eu-west-1': {
        'us-east-1': 100,
        'ap-southeast-1': 250,
        'us-west-2': 150,
      },
      'ap-southeast-1': {
        'us-east-1': 200,
        'eu-west-1': 250,
        'us-west-2': 180,
      },
      'us-west-2': { 'us-east-1': 50, 'eu-west-1': 150, 'ap-southeast-1': 180 },
    };

    const sourceRegion = this.config.regions.primary;
    const latency = latencyMap[sourceRegion]?.[targetRegion] || 100;

    await new Promise(resolve => setTimeout(resolve, latency));

    const replicationTime = Date.now() - startTime;
    this.metrics.replicationLag.set(targetRegion, replicationTime);

    this.logger.debug(
      `Replicated ${batch.length} items to ${targetRegion} in ${replicationTime}ms`
    );
  }

  validateCrossRegionCompliance(data, targetRegion) {
    const regionCompliance =
      this.config.compliance.regionalPolicies.get(targetRegion);
    if (!regionCompliance) return true;

    // Check data residency requirements
    if (
      regionCompliance.dataResidency &&
      data.classification === 'restricted'
    ) {
      this.metrics.complianceViolations++;
      return false;
    }

    // Check GDPR requirements
    if (regionCompliance.gdpr && data.containsPII && !data.gdprConsent) {
      this.metrics.complianceViolations++;
      return false;
    }

    // Check PDPA requirements
    if (
      regionCompliance.pdpa &&
      data.containsPersonalData &&
      !data.pdpaConsent
    ) {
      this.metrics.complianceViolations++;
      return false;
    }

    return true;
  }

  setupComplianceMonitoring() {
    this.logger.info('Setting up compliance monitoring...');

    // Monitor data localization
    this.on('dataAccess', event => {
      this.enforceDataLocalization(event);
    });

    // Monitor cross-border data transfers
    this.on('crossRegionTransfer', event => {
      this.validateCrossBorderTransfer(event);
    });

    // Regular compliance audits
    setInterval(
      () => {
        this.performComplianceAudit();
      },
      60 * 60 * 1000
    ); // Hourly audits
  }

  enforceDataLocalization(event) {
    const { region, dataType, userLocation } = event;
    const regionCompliance =
      this.config.compliance.regionalPolicies.get(region);

    if (regionCompliance?.dataResidency) {
      // Ensure sensitive data stays in the same region as the user
      if (
        dataType === 'personal' &&
        this.getRegionFromLocation(userLocation) !== region
      ) {
        this.metrics.dataLocalizationEvents++;
        this.emit('complianceViolation', {
          type: 'data_localization',
          region,
          userLocation,
          dataType,
          timestamp: Date.now(),
        });
      }
    }
  }

  getRegionFromLocation(location) {
    // Simplified location to region mapping
    const locationMap = {
      US: 'us-east-1',
      EU: 'eu-west-1',
      Asia: 'ap-southeast-1',
      Canada: 'us-west-2',
    };
    return locationMap[location] || 'us-east-1';
  }

  startHealthMonitoring() {
    const performHealthCheck = async () => {
      for (const [region, state] of this.regionStates) {
        if (state.status === 'failed') continue;

        try {
          const health = await this.checkRegionHealth(region);
          this.updateHealthStatus(region, health);
        } catch (error) {
          this.logger.error(`Health check failed for region ${region}:`, error);
          this.updateHealthStatus(region, {
            healthy: false,
            error: error.message,
          });
        }
      }
    };

    // Initial health check
    performHealthCheck();

    // Regular health checks
    setInterval(performHealthCheck, this.config.failover.healthCheckInterval);
  }

  async checkRegionHealth(region) {
    const state = this.regionStates.get(region);
    const startTime = Date.now();

    // Simulate health check (in production, use actual health endpoints)
    const healthMetrics = {
      responseTime: Math.random() * 200 + 50, // 50-250ms
      cpuUsage: Math.random() * 0.8, // 0-80%
      memoryUsage: Math.random() * 0.7, // 0-70%
      errorRate: Math.random() * 0.05, // 0-5%
      connectionCount: state.connections,
    };

    // Calculate health score
    const healthScore = this.calculateHealthScore(healthMetrics);

    return {
      healthy: healthScore > 0.7,
      score: healthScore,
      metrics: healthMetrics,
      timestamp: Date.now(),
      responseTime: Date.now() - startTime,
    };
  }

  calculateHealthScore(metrics) {
    const weights = {
      responseTime: 0.3,
      cpuUsage: 0.25,
      memoryUsage: 0.25,
      errorRate: 0.2,
    };

    let score = 1.0;

    // Penalize high response time
    if (metrics.responseTime > 200) {
      score -= (weights.responseTime * (metrics.responseTime - 200)) / 200;
    }

    // Penalize high CPU usage
    score -= weights.cpuUsage * metrics.cpuUsage;

    // Penalize high memory usage
    score -= weights.memoryUsage * metrics.memoryUsage;

    // Penalize high error rate
    score -= weights.errorRate * metrics.errorRate * 10; // Amplify error rate impact

    return Math.max(0, Math.min(1, score));
  }

  updateHealthStatus(region, health) {
    const state = this.regionStates.get(region);
    const healthHistory = this.healthCheckResults.get(region);

    // Update state
    state.healthScore = health.score;
    state.lastHealthCheck = Date.now();

    // Update status based on health
    const previousStatus = state.status;
    if (health.healthy && health.score > 0.8) {
      state.status = 'healthy';
    } else if (health.healthy && health.score > 0.5) {
      state.status = 'degraded';
    } else {
      state.status = 'unhealthy';
    }

    // Record health history
    healthHistory.push(health);
    if (healthHistory.length > 10) {
      healthHistory.shift(); // Keep only last 10 results
    }

    // Trigger failover if needed
    if (previousStatus !== state.status) {
      this.emit('regionStatusChange', {
        region,
        previousStatus,
        newStatus: state.status,
      });

      if (state.status === 'unhealthy' && state.isPrimary) {
        this.triggerFailover(region);
      }
    }
  }

  setupLoadBalancing() {
    this.logger.info(
      `Load balancing strategy: ${this.config.loadBalancing.strategy}`
    );
  }

  selectOptimalRegion(userLocation, requestType) {
    const availableRegions = Array.from(this.regionStates.entries())
      .filter(([_, state]) => state.status === 'healthy')
      .map(([region, state]) => ({ region, state }));

    if (availableRegions.length === 0) {
      throw new Error('No healthy regions available');
    }

    switch (this.config.loadBalancing.strategy) {
      case 'latency':
        return this.selectByLatency(userLocation, availableRegions);
      case 'geography':
        return this.selectByGeography(userLocation, availableRegions);
      case 'weighted':
        return this.selectByWeight(availableRegions);
      case 'round-robin':
      default:
        return this.selectRoundRobin(availableRegions);
    }
  }

  selectByLatency(userLocation, availableRegions) {
    // Simplified latency calculation based on user location
    const latencyMap = {
      US: {
        'us-east-1': 50,
        'us-west-2': 80,
        'eu-west-1': 150,
        'ap-southeast-1': 200,
      },
      EU: {
        'eu-west-1': 50,
        'us-east-1': 150,
        'us-west-2': 180,
        'ap-southeast-1': 250,
      },
      Asia: {
        'ap-southeast-1': 50,
        'us-west-2': 180,
        'us-east-1': 200,
        'eu-west-1': 250,
      },
    };

    const userLatencies = latencyMap[userLocation] || latencyMap['US'];

    return availableRegions.reduce((best, current) => {
      const currentLatency = userLatencies[current.region] || 200;
      const bestLatency = userLatencies[best.region] || 200;
      return currentLatency < bestLatency ? current : best;
    }).region;
  }

  selectByGeography(userLocation, availableRegions) {
    const geographyMap = {
      US: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'],
      EU: ['eu-west-1', 'us-east-1', 'us-west-2', 'ap-southeast-1'],
      Asia: ['ap-southeast-1', 'us-west-2', 'us-east-1', 'eu-west-1'],
    };

    const preferences = geographyMap[userLocation] || geographyMap['US'];

    for (const preferredRegion of preferences) {
      const found = availableRegions.find(r => r.region === preferredRegion);
      if (found) return found.region;
    }

    return availableRegions[0].region;
  }

  selectByWeight(availableRegions) {
    const weights = this.config.loadBalancing.weights;
    const totalWeight = availableRegions.reduce(
      (sum, r) => sum + (weights.get(r.region) || 0.1),
      0
    );
    const random = Math.random() * totalWeight;

    let currentWeight = 0;
    for (const { region } of availableRegions) {
      currentWeight += weights.get(region) || 0.1;
      if (random <= currentWeight) return region;
    }

    return availableRegions[0].region;
  }

  selectRoundRobin(availableRegions) {
    this.roundRobinIndex =
      (this.roundRobinIndex || 0) % availableRegions.length;
    return availableRegions[this.roundRobinIndex++].region;
  }

  setupFailoverMechanisms() {
    this.on('regionStatusChange', event => {
      if (event.newStatus === 'unhealthy') {
        this.handleRegionFailure(event.region);
      } else if (event.newStatus === 'healthy') {
        this.handleRegionRecovery(event.region);
      }
    });
  }

  triggerFailover(failedRegion) {
    this.logger.warn(`Triggering failover from region: ${failedRegion}`);

    const availableRegions = Array.from(this.regionStates.entries())
      .filter(
        ([region, state]) =>
          region !== failedRegion && state.status === 'healthy'
      )
      .map(([region, _]) => region);

    if (availableRegions.length === 0) {
      this.logger.error('No healthy regions available for failover');
      return;
    }

    // Select new primary region
    const newPrimary = availableRegions[0]; // Simplified selection
    const currentPrimary = this.regionStates.get(this.config.regions.primary);

    if (failedRegion === this.config.regions.primary) {
      this.config.regions.primary = newPrimary;
      this.regionStates.get(newPrimary).isPrimary = true;
      currentPrimary.isPrimary = false;
    }

    this.failoverHistory.push({
      timestamp: Date.now(),
      fromRegion: failedRegion,
      toRegion: newPrimary,
      reason: 'health_check_failure',
    });

    this.metrics.failovers++;
    this.emit('failoverCompleted', {
      fromRegion: failedRegion,
      toRegion: newPrimary,
      timestamp: Date.now(),
    });

    this.logger.info(`Failover completed: ${failedRegion} -> ${newPrimary}`);
  }

  handleRegionFailure(region) {
    this.logger.warn(`Region ${region} has failed`);
    // Additional failure handling logic
  }

  handleRegionRecovery(region) {
    this.logger.info(`Region ${region} has recovered`);
    // Additional recovery handling logic
  }

  async routeRequest(request, userContext = {}) {
    this.metrics.totalRequests++;

    const { userLocation = 'US', requestType = 'api' } = userContext;
    const targetRegion = this.selectOptimalRegion(userLocation, requestType);

    // Update region metrics
    const currentCount = this.metrics.requestsByRegion.get(targetRegion) || 0;
    this.metrics.requestsByRegion.set(targetRegion, currentCount + 1);

    // Check if this is a cross-region request
    const userRegion = this.getRegionFromLocation(userLocation);
    if (userRegion !== targetRegion) {
      this.metrics.crossRegionQueries++;
      this.emit('crossRegionTransfer', {
        sourceRegion: userRegion,
        targetRegion,
        requestType,
        timestamp: Date.now(),
      });
    }

    return {
      targetRegion,
      endpoint: this.regionStates.get(targetRegion)?.endpoints,
      routingDecision: {
        strategy: this.config.loadBalancing.strategy,
        userLocation,
        requestType,
        timestamp: Date.now(),
      },
    };
  }

  monitorReplicationLag() {
    for (const [region, lag] of this.metrics.replicationLag) {
      if (lag > this.config.replication.maxLatency) {
        this.logger.warn(
          `High replication lag detected for region ${region}: ${lag}ms`
        );
        this.emit('highReplicationLag', { region, lag, timestamp: Date.now() });
      }
    }
  }

  updateReplicationMetrics(region, batchSize, success) {
    // Update replication lag based on success/failure
    if (success) {
      const currentLag = this.metrics.replicationLag.get(region) || 0;
      this.metrics.replicationLag.set(region, Math.max(0, currentLag - 100));
    } else {
      const currentLag = this.metrics.replicationLag.get(region) || 0;
      this.metrics.replicationLag.set(region, currentLag + 500);
    }
  }

  updateRegionStatuses() {
    for (const [region, state] of this.regionStates) {
      if (state.status === 'initializing') {
        state.status = 'healthy';
      }
    }
  }

  performComplianceAudit() {
    const auditResults = {
      timestamp: Date.now(),
      violations: this.metrics.complianceViolations,
      dataLocalizationEvents: this.metrics.dataLocalizationEvents,
      crossRegionTransfers: this.metrics.crossRegionQueries,
      regions: Array.from(this.regionStates.entries()).map(
        ([region, state]) => ({
          region,
          status: state.status,
          compliance: state.compliance,
        })
      ),
    };

    this.emit('complianceAuditCompleted', auditResults);
    this.logger.info('Compliance audit completed', {
      violations: auditResults.violations,
      events: auditResults.dataLocalizationEvents,
    });

    return auditResults;
  }

  getGlobalMetrics() {
    return {
      ...this.metrics,
      regions: Array.from(this.regionStates.entries()).map(
        ([region, state]) => ({
          region,
          status: state.status,
          healthScore: state.healthScore,
          connections: state.connections,
          replicationLag: this.metrics.replicationLag.get(region),
          requests: this.metrics.requestsByRegion.get(region),
        })
      ),
      failoverHistory: this.failoverHistory.slice(-10), // Last 10 failovers
      timestamp: Date.now(),
    };
  }

  async shutdown() {
    this.logger.info('Shutting down Multi-Region Orchestrator...');

    // Clear all timers and intervals
    clearInterval(this.healthMonitoringInterval);
    clearInterval(this.replicationMonitoringInterval);

    // Close all connections
    this.activeConnections.clear();

    // Clear data structures
    this.regionStates.clear();
    this.replicationQueues.clear();
    this.healthCheckResults.clear();
    this.dataCache.clear();

    this.removeAllListeners();
    this.logger.info('Multi-Region Orchestrator shutdown complete');
  }
}

module.exports = { MultiRegionOrchestrator };
