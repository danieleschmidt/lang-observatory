/**
 * Core Observability Engine - Central orchestrator for all observability operations
 * Generation 1: Basic functionality with essential features
 */

const { LangfuseTracer } = require('../services/langfuseService');
const { OpenLITCollector } = require('../services/openlitService');
const { MetricsManager } = require('../services/metricsService');
const { Logger } = require('../utils/logger');
const { ConfigManager } = require('../utils/config');

class ObservabilityEngine {
  constructor(config = {}) {
    this.config = new ConfigManager(config);
    this.logger = new Logger(this.config.get('logging', {}));

    this.tracer = new LangfuseTracer(this.config.get('langfuse', {}));
    this.collector = new OpenLITCollector(this.config.get('openlit', {}));
    this.metrics = new MetricsManager(this.config.get('metrics', {}));

    this.traces = new Map();
    this.activeOperations = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return this;

    this.logger.info('Initializing Observability Engine...');

    try {
      await Promise.all([
        this.tracer.initialize(),
        this.collector.initialize(),
        this.metrics.initialize(),
      ]);

      this.initialized = true;
      this.logger.info('Observability Engine initialized successfully');
      return this;
    } catch (error) {
      this.logger.error('Failed to initialize Observability Engine:', error);
      throw error;
    }
  }

  async startTrace(operationName, metadata = {}) {
    if (!this.initialized) {
      throw new Error('Observability Engine not initialized');
    }

    const traceId = this.generateTraceId();
    const startTime = Date.now();

    const trace = {
      id: traceId,
      operation: operationName,
      startTime,
      metadata,
      spans: [],
      status: 'active',
    };

    this.traces.set(traceId, trace);
    this.activeOperations.set(traceId, { operation: operationName, startTime });

    // Start trace in external systems
    this.tracer.startTrace(operationName, { traceId, ...metadata });
    this.metrics.startOperation(operationName, traceId);

    this.logger.debug(
      `Started trace ${traceId} for operation: ${operationName}`
    );
    return traceId;
  }

  async addSpan(traceId, spanName, data = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }

    const span = {
      id: this.generateSpanId(),
      name: spanName,
      timestamp: Date.now(),
      data,
    };

    trace.spans.push(span);
    this.logger.debug(`Added span ${span.id} to trace ${traceId}: ${spanName}`);

    return span.id;
  }

  async endTrace(traceId, result = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }

    const endTime = Date.now();
    const duration = endTime - trace.startTime;

    trace.endTime = endTime;
    trace.duration = duration;
    trace.result = result;
    trace.status = result.success !== false ? 'completed' : 'failed';

    // End trace in external systems
    this.tracer.endTrace(traceId, { ...result, duration });

    if (trace.status === 'completed') {
      this.metrics.recordSuccess(trace.operation, duration, traceId);
    } else {
      this.metrics.recordError(
        trace.operation,
        duration,
        result.error || new Error('Unknown error'),
        traceId
      );
    }

    this.activeOperations.delete(traceId);
    this.logger.debug(
      `Ended trace ${traceId} (${duration}ms): ${trace.status}`
    );

    return trace;
  }

  async recordLLMInteraction(provider, model, input, output, metadata = {}) {
    const traceId = await this.startTrace('llm-interaction', {
      provider,
      model,
    });

    try {
      const interaction = {
        provider,
        model,
        input,
        output,
        timestamp: new Date().toISOString(),
        metadata,
      };

      await this.addSpan(traceId, 'llm-call', interaction);

      // Record in all systems
      await Promise.all([
        this.tracer.recordLLMCall(interaction),
        this.collector.recordLLMMetrics(interaction),
        this.metrics.recordLLMUsage(interaction),
      ]);

      await this.endTrace(traceId, { success: true, interaction });
      return interaction;
    } catch (error) {
      await this.endTrace(traceId, { success: false, error: error.message });
      throw error;
    }
  }

  getTrace(traceId) {
    return this.traces.get(traceId);
  }

  getAllTraces() {
    return Array.from(this.traces.values());
  }

  getActiveOperations() {
    return Array.from(this.activeOperations.values());
  }

  async getHealthStatus() {
    if (!this.initialized) {
      return { status: 'not_initialized' };
    }

    const services = await Promise.allSettled([
      this.tracer.getHealth(),
      this.collector.getHealth(),
      this.metrics.getHealth(),
    ]);

    const allHealthy = services.every(
      s => s.status === 'fulfilled' && s.value.healthy
    );

    return {
      status: allHealthy ? 'healthy' : 'degraded',
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
      },
      activeOperations: this.activeOperations.size,
      totalTraces: this.traces.size,
      timestamp: new Date().toISOString(),
    };
  }

  generateTraceId() {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSpanId() {
    return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async shutdown() {
    if (!this.initialized) return;

    this.logger.info('Shutting down Observability Engine...');

    await Promise.allSettled([
      this.tracer.shutdown(),
      this.collector.shutdown(),
      this.metrics.shutdown(),
    ]);

    this.traces.clear();
    this.activeOperations.clear();
    this.initialized = false;

    this.logger.info('Observability Engine shutdown complete');
  }
}

module.exports = { ObservabilityEngine };
