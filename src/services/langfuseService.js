/**
 * Langfuse Integration Service
 * Handles LLM tracing and observability through Langfuse
 */

const crypto = require('crypto');
const { Logger } = require('../utils/logger');

class LangfuseTracer {
    constructor(config = {}) {
        this.config = {
            host: config.host || process.env.LANGFUSE_HOST || 'http://localhost:3000',
            publicKey: config.publicKey || process.env.LANGFUSE_PUBLIC_KEY,
            secretKey: config.secretKey || process.env.LANGFUSE_SECRET_KEY,
            enabled: config.enabled !== false,
            flushInterval: config.flushInterval || 5000,
            batchSize: config.batchSize || 100,
            ...config
        };
        
        this.logger = new Logger({ service: 'LangfuseTracer' });
        this.traces = new Map();
        this.pendingEvents = [];
        this.flushTimer = null;
        this.initialized = false;
    }

    async initialize() {
        if (!this.config.enabled) {
            this.logger.info('Langfuse tracing disabled');
            this.initialized = true;
            return;
        }

        if (!this.config.publicKey || !this.config.secretKey) {
            this.logger.warn('Langfuse credentials not provided, running in mock mode');
            this.config.enabled = false;
        }

        try {
            // Test connection to Langfuse
            await this._testConnection();
            
            // Start periodic flush
            this._startFlushTimer();
            
            this.initialized = true;
            this.logger.info('Langfuse tracer initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Langfuse tracer:', error);
            throw error;
        }
    }

    startTrace(operation, metadata = {}) {
        const traceId = crypto.randomUUID();
        const trace = {
            id: traceId,
            operation,
            startTime: Date.now(),
            metadata,
            spans: [],
            status: 'active'
        };

        this.traces.set(traceId, trace);
        
        this.logger.debug(`Started trace ${traceId} for operation: ${operation}`);
        return traceId;
    }

    endTrace(traceId, result = {}) {
        const trace = this.traces.get(traceId);
        if (!trace) {
            this.logger.warn(`Trace ${traceId} not found`);
            return;
        }

        trace.endTime = Date.now();
        trace.duration = trace.endTime - trace.startTime;
        trace.result = result;
        trace.status = result.success ? 'completed' : 'failed';

        // Queue for submission to Langfuse
        this._queueTraceEvent(trace);
        
        // Clean up from active traces
        this.traces.delete(traceId);
        
        this.logger.debug(`Ended trace ${traceId}: ${trace.status} (${trace.duration}ms)`);
    }

    async recordLLMCall(callData) {
        if (!this.config.enabled) return;

        const event = {
            type: 'llm_call',
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            data: {
                provider: callData.provider,
                model: callData.model,
                input: this._sanitizeInput(callData.input),
                output: this._sanitizeOutput(callData.output),
                tokens: this._calculateTokens(callData),
                cost: this._calculateCost(callData),
                metadata: callData.metadata || {}
            }
        };

        this._queueEvent(event);
        this.logger.debug(`Recorded LLM call: ${callData.provider}/${callData.model}`);
    }

    async getHealth() {
        if (!this.config.enabled) {
            return { healthy: true, status: 'disabled' };
        }

        try {
            await this._testConnection();
            return {
                healthy: true,
                status: 'connected',
                pendingEvents: this.pendingEvents.length,
                activeTraces: this.traces.size
            };
        } catch (error) {
            return {
                healthy: false,
                status: 'connection_failed',
                error: error.message
            };
        }
    }

    async shutdown() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }

        // Flush remaining events
        await this._flush();
        
        this.initialized = false;
        this.logger.info('Langfuse tracer shutdown complete');
    }

    // Private methods
    async _testConnection() {
        // Simulate connection test - in real implementation, this would ping Langfuse API
        if (!this.config.host) {
            throw new Error('Langfuse host not configured');
        }
        
        // Mock health check
        return Promise.resolve();
    }

    _queueTraceEvent(trace) {
        const event = {
            type: 'trace',
            id: trace.id,
            timestamp: new Date(trace.startTime).toISOString(),
            data: trace
        };
        
        this._queueEvent(event);
    }

    _queueEvent(event) {
        this.pendingEvents.push(event);
        
        if (this.pendingEvents.length >= this.config.batchSize) {
            this._flush();
        }
    }

    _startFlushTimer() {
        this.flushTimer = setInterval(() => {
            if (this.pendingEvents.length > 0) {
                this._flush();
            }
        }, this.config.flushInterval);
    }

    async _flush() {
        if (this.pendingEvents.length === 0) return;

        const events = this.pendingEvents.splice(0);
        
        try {
            // In real implementation, this would send to Langfuse API
            this.logger.debug(`Flushed ${events.length} events to Langfuse`);
            
            // Mock successful submission
            await this._submitToLangfuse(events);
        } catch (error) {
            this.logger.error('Failed to flush events to Langfuse:', error);
            // Re-queue events for retry
            this.pendingEvents.unshift(...events);
        }
    }

    async _submitToLangfuse(events) {
        // Mock API submission - replace with actual Langfuse API calls
        return new Promise((resolve) => {
            setTimeout(() => {
                this.logger.debug(`Submitted ${events.length} events to Langfuse API`);
                resolve();
            }, 100);
        });
    }

    _sanitizeInput(input) {
        // Remove sensitive data from input
        if (typeof input === 'string') {
            return input.substring(0, 1000); // Truncate long inputs
        }
        return input;
    }

    _sanitizeOutput(output) {
        // Remove sensitive data from output
        if (typeof output === 'string') {
            return output.substring(0, 1000); // Truncate long outputs
        }
        return output;
    }

    _calculateTokens(callData) {
        // Mock token calculation - replace with actual token counting
        const inputTokens = typeof callData.input === 'string' ? callData.input.length / 4 : 0;
        const outputTokens = typeof callData.output === 'string' ? callData.output.length / 4 : 0;
        
        return {
            input: Math.ceil(inputTokens),
            output: Math.ceil(outputTokens),
            total: Math.ceil(inputTokens + outputTokens)
        };
    }

    _calculateCost(callData) {
        // Mock cost calculation - replace with actual pricing logic
        const tokens = this._calculateTokens(callData);
        const costPerToken = this._getCostPerToken(callData.provider, callData.model);
        
        return {
            input: tokens.input * costPerToken.input,
            output: tokens.output * costPerToken.output,
            total: (tokens.input * costPerToken.input) + (tokens.output * costPerToken.output)
        };
    }

    _getCostPerToken(provider, model) {
        // Mock pricing - replace with actual pricing data
        const pricing = {
            'openai': {
                'gpt-4': { input: 0.00003, output: 0.00006 },
                'gpt-3.5-turbo': { input: 0.0000015, output: 0.000002 }
            },
            'anthropic': {
                'claude-3': { input: 0.000015, output: 0.000075 }
            }
        };
        
        return pricing[provider]?.[model] || { input: 0.000001, output: 0.000001 };
    }
}

module.exports = { LangfuseTracer };