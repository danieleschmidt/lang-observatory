/**
 * Lang Observatory - Main Entry Point
 * A turnkey observability stack for Large Language Model applications
 */

const { LangfuseTracer } = require('./services/langfuseService');
const { OpenLITCollector } = require('./services/openlitService');
const { MetricsManager } = require('./services/metricsService');
const { QuantumTaskPlanner } = require('./quantum/quantumTaskPlanner');
const { AdaptiveScheduler } = require('./quantum/adaptiveScheduler');
const { PhotonProcessor } = require('./neuromorphic/photonProcessor');
const {
  NeuromorphicLLMInterface,
} = require('./neuromorphic/neuromorphicLLMInterface');
const { ReliabilityManager } = require('./reliability/reliabilityManager');
const { PerformanceManager } = require('./performance/performanceManager');
const { AutoScalingManager } = require('./performance/autoScalingManager');
const { ConfigManager } = require('./utils/config');
const { Logger } = require('./utils/logger');

class LangObservatory {
  constructor(config = {}) {
    this.config = new ConfigManager(config);
    this.logger = new Logger(this.config.get('logging', {}));

    // Initialize core services
    this.tracer = new LangfuseTracer(this.config.get('langfuse', {}));
    this.collector = new OpenLITCollector(this.config.get('openlit', {}));
    this.metrics = new MetricsManager(this.config.get('metrics', {}));

    // Initialize quantum-inspired components
    this.quantumPlanner = new QuantumTaskPlanner(
      this.config.get('quantum', {})
    );
    this.adaptiveScheduler = new AdaptiveScheduler(
      this.config.get('adaptive', {})
    );

    // Initialize neuromorphic components
    this.photonProcessor = new PhotonProcessor(this.config.get('photon', {}));
    this.neuromorphicInterface = new NeuromorphicLLMInterface({
      photon: this.config.get('photon', {}),
      ...this.config.get('neuromorphic', {}),
    });

    // Initialize reliability manager
    this.reliabilityManager = new ReliabilityManager(
      this.config.get('reliability', {})
    );

    // Initialize performance manager
    this.performanceManager = new PerformanceManager(
      this.config.get('performance', {})
    );

    // Initialize auto-scaling manager
    this.autoScalingManager = new AutoScalingManager(
      this.config.get('autoScaling', {})
    );

    this.initialized = false;
  }

  async initialize() {
    try {
      this.logger.info('Initializing Lang Observatory...');

      // Initialize performance and reliability managers first
      await this.performanceManager.initialize();
      await this.autoScalingManager.initialize();
      await this.reliabilityManager.initialize();

      // Initialize services in dependency order with reliability and performance
      await this.reliabilityManager.executeWithReliability(
        () => this.tracer.initialize(),
        { name: 'langfuse', retryPolicy: 'external-api' }
      );

      await this.reliabilityManager.executeWithReliability(
        () => this.collector.initialize(),
        { name: 'openlit', retryPolicy: 'external-api' }
      );

      await this.reliabilityManager.executeWithReliability(
        () => this.metrics.initialize(),
        { name: 'database', retryPolicy: 'database' }
      );

      await this.reliabilityManager.executeWithReliability(
        () => this.quantumPlanner.initialize(),
        { name: 'quantum-planner', retryPolicy: 'quantum-operation' }
      );

      await this.reliabilityManager.executeWithReliability(
        () => this.adaptiveScheduler.initialize(),
        { name: 'quantum-planner', retryPolicy: 'quantum-operation' }
      );

      // Initialize neuromorphic components with reliability
      await this.reliabilityManager.executeWithReliability(
        () => this.photonProcessor.initialize(),
        { name: 'quantum-planner', retryPolicy: 'quantum-operation' }
      );

      await this.reliabilityManager.executeWithReliability(
        () => this.neuromorphicInterface.initialize(),
        { name: 'quantum-planner', retryPolicy: 'quantum-operation' }
      );

      this.initialized = true;
      this.logger.info('Lang Observatory initialized successfully');

      return this;
    } catch (error) {
      this.logger.error('Failed to initialize Lang Observatory:', error);
      throw error;
    }
  }

  async trace(operation, callback, metadata = {}) {
    if (!this.initialized) {
      throw new Error(
        'Lang Observatory not initialized. Call initialize() first.'
      );
    }

    const traceId = this.tracer.startTrace(operation, metadata);
    const startTime = Date.now();

    try {
      // Start metrics collection
      this.metrics.startOperation(operation, traceId);

      // Execute the operation
      const result = await callback();

      // Record successful completion
      const duration = Date.now() - startTime;
      this.tracer.endTrace(traceId, {
        success: true,
        duration,
        result: typeof result,
      });
      this.metrics.recordSuccess(operation, duration, traceId);

      return result;
    } catch (error) {
      // Record failure
      const duration = Date.now() - startTime;
      this.tracer.endTrace(traceId, {
        success: false,
        duration,
        error: error.message,
      });
      this.metrics.recordError(operation, duration, error, traceId);

      throw error;
    }
  }

  async recordLLMCall(provider, model, input, output, metadata = {}) {
    if (!this.initialized) {
      throw new Error(
        'Lang Observatory not initialized. Call initialize() first.'
      );
    }

    const callData = {
      provider,
      model,
      input,
      output,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    // Record in multiple systems with reliability and performance optimization
    const recordings = await Promise.allSettled([
      this.performanceManager.optimizeOperation(
        () =>
          this.reliabilityManager.executeWithReliability(
            () => this.tracer.recordLLMCall(callData),
            {
              name: 'langfuse',
              retryPolicy: 'external-api',
              circuitBreaker: true,
            }
          ),
        {
          cacheName: 'llm-responses',
          cacheKey: `${provider}-${model}-${JSON.stringify(input).slice(0, 100)}`,
          timeout: 15000,
        }
      ),
      this.performanceManager.optimizeOperation(
        () =>
          this.reliabilityManager.executeWithReliability(
            () => this.collector.recordLLMMetrics(callData),
            {
              name: 'openlit',
              retryPolicy: 'external-api',
              circuitBreaker: true,
            }
          ),
        { timeout: 10000 }
      ),
      this.performanceManager.optimizeOperation(
        () =>
          this.reliabilityManager.executeWithReliability(
            () => this.metrics.recordLLMUsage(callData),
            { name: 'database', retryPolicy: 'database', circuitBreaker: true }
          ),
        {
          cacheName: 'database-queries',
          cacheKey: `llm-usage-${provider}-${model}`,
          timeout: 5000,
        }
      ),
    ]);

    // Log any failures but don't stop processing
    recordings.forEach((result, index) => {
      if (result.status === 'rejected') {
        const services = ['langfuse', 'openlit', 'metrics'];
        this.logger.warn(
          `Failed to record LLM call in ${services[index]}:`,
          result.reason
        );
      }
    });

    // Process through neuromorphic system
    const neuromorphicInsights =
      await this.neuromorphicInterface.processLLMCall(callData);

    return {
      ...callData,
      neuromorphicInsights,
    };
  }

  async planTasks(tasks, constraints = {}) {
    if (!this.initialized) {
      throw new Error(
        'Lang Observatory not initialized. Call initialize() first.'
      );
    }

    this.logger.info(
      `Planning ${tasks.length} tasks using quantum optimization`
    );

    try {
      // Use quantum planner for task optimization with performance caching
      const quantumPlan = await this.performanceManager.optimizeOperation(
        () => this.quantumPlanner.planTasks(tasks, constraints),
        {
          cacheName: 'quantum-plans',
          cacheKey: `${JSON.stringify(tasks)}-${JSON.stringify(constraints)}`,
          timeout: 30000,
        }
      );

      // Apply adaptive scheduling to each task
      const adaptiveSchedules = await Promise.all(
        (quantumPlan.phases || []).flatMap(phase =>
          (phase.tasks || []).map(async taskInfo => {
            const schedule = await this.adaptiveScheduler.scheduleTask(
              taskInfo.task,
              { phase: phase, quantumPlan }
            );
            return { ...taskInfo, schedule };
          })
        )
      );

      // Record planning metrics
      await this.recordPlanningMetrics(quantumPlan, adaptiveSchedules);

      return {
        quantumPlan,
        adaptiveSchedules,
        totalDuration: quantumPlan.totalDuration,
        efficiency: quantumPlan.efficiency,
        parallelism: quantumPlan.parallelism,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Task planning failed:', error);
      throw error;
    }
  }

  async executeTask(taskId, executionOptions = {}) {
    if (!this.initialized) {
      throw new Error(
        'Lang Observatory not initialized. Call initialize() first.'
      );
    }

    const startTime = Date.now();

    try {
      // Trace the execution
      const traceId = this.tracer.startTrace(`task-execution-${taskId}`, {
        taskId,
      });

      // Start metrics collection
      this.metrics.startOperation('task-execution', traceId);

      // Execute with monitoring
      const result = await this.executeWithMonitoring(
        taskId,
        executionOptions,
        traceId
      );

      // Record execution result in adaptive scheduler
      await this.adaptiveScheduler.recordExecution(taskId, result);

      const duration = Date.now() - startTime;
      this.tracer.endTrace(traceId, { success: result.success, duration });
      this.metrics.recordSuccess('task-execution', duration, traceId);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.recordError(
        'task-execution',
        duration,
        error,
        'unknown-trace'
      );
      throw error;
    }
  }

  async recordPlanningMetrics(quantumPlan, adaptiveSchedules) {
    const planningMetrics = {
      quantumMetrics: this.quantumPlanner.getQuantumMetrics(),
      adaptiveMetrics: this.adaptiveScheduler.getAdaptiveMetrics(),
      planEfficiency: quantumPlan.efficiency,
      totalTasks: quantumPlan.phases.reduce(
        (sum, phase) => sum + phase.tasks.length,
        0
      ),
      parallelPhases: quantumPlan.phases.length,
      timestamp: new Date().toISOString(),
    };

    // Record in metrics system
    await this.metrics.recordCustomMetric('quantum-planning', planningMetrics);
  }

  async executeWithMonitoring(taskId, options, traceId) {
    // Simplified execution simulation
    const startTime = Date.now();

    try {
      // Simulate task execution
      await new Promise(resolve =>
        setTimeout(resolve, Math.random() * 1000 + 500)
      );

      const duration = Date.now() - startTime;
      const success = Math.random() > 0.1; // 90% success rate

      return {
        taskId,
        success,
        duration,
        resourceUsage: {
          cpu: Math.random() * 2,
          memory: Math.random() * 1.5,
          io: Math.random() * 1.2,
          network: Math.random() * 0.8,
        },
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        taskId,
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
        completedAt: new Date().toISOString(),
      };
    }
  }

  async getHealthStatus() {
    if (!this.initialized) {
      return { status: 'not_initialized', services: {} };
    }

    const services = await Promise.allSettled([
      this.tracer.getHealth(),
      this.collector.getHealth(),
      this.metrics.getHealth(),
      this.quantumPlanner.getHealth(),
      this.adaptiveScheduler.getHealth(),
      this.photonProcessor.getHealth(),
      this.neuromorphicInterface.getHealth(),
    ]);

    // Get reliability status
    const reliabilityStatus =
      this.reliabilityManager.getAllCircuitBreakerStatus();
    const reliabilityMetrics = this.reliabilityManager.getMetrics();

    // Get performance metrics
    const performanceMetrics = this.performanceManager.getPerformanceMetrics();
    const autoScalingStatus = this.autoScalingManager.getScalingStatus();

    // Determine overall health including reliability and performance
    const serviceHealthy = services.every(
      s => s.status === 'fulfilled' && s.value.healthy
    );
    const circuitsHealthy = Object.values(reliabilityStatus).every(
      cb => cb.healthy
    );
    const performanceHealthy = performanceMetrics.currentLoad < 0.9; // Under 90% load
    const overallStatus =
      serviceHealthy && circuitsHealthy && performanceHealthy
        ? 'healthy'
        : 'degraded';

    return {
      status: overallStatus,
      services: {
        tracer:
          services[0].status === 'fulfilled'
            ? services[0].value
            : { healthy: false, error: services[0].reason },
        collector:
          services[1].status === 'fulfilled'
            ? services[1].value
            : { healthy: false, error: services[1].reason },
        metrics:
          services[2].status === 'fulfilled'
            ? services[2].value
            : { healthy: false, error: services[2].reason },
        quantumPlanner:
          services[3].status === 'fulfilled'
            ? services[3].value
            : { healthy: false, error: services[3].reason },
        adaptiveScheduler:
          services[4].status === 'fulfilled'
            ? services[4].value
            : { healthy: false, error: services[4].reason },
        photonProcessor:
          services[5].status === 'fulfilled'
            ? services[5].value
            : { healthy: false, error: services[5].reason },
        neuromorphicInterface:
          services[6].status === 'fulfilled'
            ? services[6].value
            : { healthy: false, error: services[6].reason },
      },
      reliability: {
        circuitBreakers: reliabilityStatus,
        metrics: reliabilityMetrics,
        overallHealthy: circuitsHealthy,
      },
      performance: {
        metrics: performanceMetrics,
        autoScaling: autoScalingStatus,
        overallHealthy: performanceHealthy,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async shutdown() {
    if (!this.initialized) {
      return;
    }

    this.logger.info('Shutting down Lang Observatory...');

    await Promise.allSettled([
      this.tracer.shutdown(),
      this.collector.shutdown(),
      this.metrics.shutdown(),
      this.quantumPlanner.shutdown(),
      this.adaptiveScheduler.shutdown(),
      this.photonProcessor.shutdown(),
      this.neuromorphicInterface.shutdown(),
      this.reliabilityManager.shutdown(),
      this.performanceManager.shutdown(),
      this.autoScalingManager.shutdown(),
    ]);

    this.initialized = false;
    this.logger.info('Lang Observatory shutdown complete');
  }
}

// Additional neuromorphic methods for the main class
LangObservatory.prototype.getNeuromorphicInsights = async function (callId) {
  if (!this.initialized) {
    throw new Error('Lang Observatory not initialized');
  }
  return await this.neuromorphicInterface.getLLMInsights(callId);
};

LangObservatory.prototype.getProviderNeuromorphicAnalysis = async function (
  provider,
  limit = 10
) {
  if (!this.initialized) {
    throw new Error('Lang Observatory not initialized');
  }
  return await this.neuromorphicInterface.getProviderInsights(provider, limit);
};

LangObservatory.prototype.getNeuromorphicMetrics = async function () {
  if (!this.initialized) {
    throw new Error('Lang Observatory not initialized');
  }
  return await this.neuromorphicInterface.getNeuromorphicMetrics();
};

LangObservatory.prototype.getPhotonProcessorStats = function () {
  if (!this.initialized) {
    throw new Error('Lang Observatory not initialized');
  }
  return this.photonProcessor.getProcessingStats();
};

module.exports = { LangObservatory, PhotonProcessor, NeuromorphicLLMInterface };
