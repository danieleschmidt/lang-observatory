/**
 * Lang Observatory SDK - Client library for easy integration
 * Generation 1: Simple, intuitive API for developers
 */

const axios = require('axios');
const { EventEmitter } = require('events');

class LangObservatorySDK extends EventEmitter {
  constructor(options = {}) {
    super();

    this.baseUrl = options.baseUrl || 'http://localhost:3000/api';
    this.apiKey = options.apiKey;
    this.defaultMetadata = options.metadata || {};
    this.autoFlush = options.autoFlush !== false;
    this.flushInterval = options.flushInterval || 5000;

    this.pendingEvents = [];
    this.activeTraces = new Map();

    // Setup auto-flush if enabled
    if (this.autoFlush) {
      this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
    }

    // Setup axios instance
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: options.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
    });
  }

  // Start a new trace
  async startTrace(operation, metadata = {}) {
    try {
      const response = await this.client.post('/observability/traces', {
        operation,
        metadata: { ...this.defaultMetadata, ...metadata },
      });

      const { traceId } = response.data;
      this.activeTraces.set(traceId, {
        operation,
        startTime: Date.now(),
        spans: [],
      });

      this.emit('traceStarted', { traceId, operation });
      return traceId;
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to start trace: ${error.message}`);
    }
  }

  // Add a span to an existing trace
  async addSpan(traceId, name, data = {}) {
    try {
      const response = await this.client.post(
        `/observability/traces/${traceId}/spans`,
        {
          name,
          data,
        }
      );

      const trace = this.activeTraces.get(traceId);
      if (trace) {
        trace.spans.push(response.data);
      }

      this.emit('spanAdded', { traceId, span: response.data });
      return response.data.spanId;
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to add span: ${error.message}`);
    }
  }

  // End a trace
  async endTrace(traceId, result = {}) {
    try {
      const response = await this.client.put(
        `/observability/traces/${traceId}/end`,
        {
          result,
        }
      );

      this.activeTraces.delete(traceId);
      this.emit('traceEnded', { traceId, result: response.data });
      return response.data;
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to end trace: ${error.message}`);
    }
  }

  // Convenience method to trace a function
  async trace(operation, fn, metadata = {}) {
    const traceId = await this.startTrace(operation, metadata);
    const startTime = Date.now();

    try {
      const result = await fn(traceId);
      const duration = Date.now() - startTime;

      await this.endTrace(traceId, {
        success: true,
        duration,
        result: typeof result,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      await this.endTrace(traceId, {
        success: false,
        duration,
        error: error.message,
      });

      throw error;
    }
  }

  // Record LLM interaction
  async recordLLMInteraction(provider, model, input, output, metadata = {}) {
    try {
      // Add to pending events for batch processing if auto-flush is enabled
      const interaction = {
        provider,
        model,
        input,
        output,
        metadata: { ...this.defaultMetadata, ...metadata },
        timestamp: new Date().toISOString(),
      };

      if (this.autoFlush) {
        this.pendingEvents.push({
          type: 'llm-interaction',
          data: interaction,
        });
      } else {
        // Send immediately
        const response = await this.client.post(
          '/observability/llm-interactions',
          interaction
        );
        this.emit('llmInteractionRecorded', response.data);
        return response.data;
      }
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to record LLM interaction: ${error.message}`);
    }
  }

  // Flush pending events
  async flush() {
    if (this.pendingEvents.length === 0) return;

    const events = [...this.pendingEvents];
    this.pendingEvents = [];

    try {
      // Group events by type and send in batches
      const llmInteractions = events
        .filter(e => e.type === 'llm-interaction')
        .map(e => e.data);

      if (llmInteractions.length > 0) {
        for (const interaction of llmInteractions) {
          await this.client.post(
            '/observability/llm-interactions',
            interaction
          );
        }

        this.emit('eventsFlushed', {
          count: llmInteractions.length,
          type: 'llm-interactions',
        });
      }
    } catch (error) {
      // Re-add failed events to the beginning of the queue
      this.pendingEvents.unshift(...events);
      this.emit('error', new Error(`Failed to flush events: ${error.message}`));
    }
  }

  // Get trace by ID
  async getTrace(traceId) {
    try {
      const response = await this.client.get(
        `/observability/traces/${traceId}`
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new Error(`Failed to get trace: ${error.message}`);
    }
  }

  // Get all traces with pagination
  async getTraces(options = {}) {
    try {
      const params = {
        page: options.page || 1,
        limit: options.limit || 50,
      };

      const response = await this.client.get('/observability/traces', {
        params,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get traces: ${error.message}`);
    }
  }

  // Get health status
  async getHealth() {
    try {
      const response = await this.client.get('/observability/health');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get health status: ${error.message}`);
    }
  }

  // Get active operations
  async getActiveOperations() {
    try {
      const response = await this.client.get(
        '/observability/operations/active'
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get active operations: ${error.message}`);
    }
  }

  // Decorator for auto-tracing functions
  traced(operation, metadata = {}) {
    return (target, propertyKey, descriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args) {
        const traceId = await this.startTrace(
          `${operation}-${propertyKey}`,
          metadata
        );

        try {
          const result = await originalMethod.apply(this, args);
          await this.endTrace(traceId, { success: true });
          return result;
        } catch (error) {
          await this.endTrace(traceId, {
            success: false,
            error: error.message,
          });
          throw error;
        }
      };

      return descriptor;
    };
  }

  // Clean shutdown
  async shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush any remaining events
    await this.flush();

    this.removeAllListeners();
    this.activeTraces.clear();
  }
}

// Convenience factory function
function createSDK(options) {
  return new LangObservatorySDK(options);
}

module.exports = {
  LangObservatorySDK,
  createSDK,
};
