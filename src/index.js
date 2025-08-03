/**
 * Lang Observatory - Main Entry Point
 * A turnkey observability stack for Large Language Model applications
 */

const { LangfuseTracer } = require('./services/langfuseService');
const { OpenLITCollector } = require('./services/openlitService');
const { MetricsManager } = require('./services/metricsService');
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
        
        this.initialized = false;
    }

    async initialize() {
        try {
            this.logger.info('Initializing Lang Observatory...');
            
            // Initialize services in dependency order
            await this.tracer.initialize();
            await this.collector.initialize();
            await this.metrics.initialize();
            
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
            throw new Error('Lang Observatory not initialized. Call initialize() first.');
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
            this.tracer.endTrace(traceId, { success: true, duration, result: typeof result });
            this.metrics.recordSuccess(operation, duration, traceId);
            
            return result;
        } catch (error) {
            // Record failure
            const duration = Date.now() - startTime;
            this.tracer.endTrace(traceId, { success: false, duration, error: error.message });
            this.metrics.recordError(operation, duration, error, traceId);
            
            throw error;
        }
    }

    async recordLLMCall(provider, model, input, output, metadata = {}) {
        if (!this.initialized) {
            throw new Error('Lang Observatory not initialized. Call initialize() first.');
        }

        const callData = {
            provider,
            model,
            input,
            output,
            timestamp: new Date().toISOString(),
            ...metadata
        };

        // Record in multiple systems
        await Promise.all([
            this.tracer.recordLLMCall(callData),
            this.collector.recordLLMMetrics(callData),
            this.metrics.recordLLMUsage(callData)
        ]);

        return callData;
    }

    async getHealthStatus() {
        if (!this.initialized) {
            return { status: 'not_initialized', services: {} };
        }

        const services = await Promise.allSettled([
            this.tracer.getHealth(),
            this.collector.getHealth(),
            this.metrics.getHealth()
        ]);

        return {
            status: services.every(s => s.status === 'fulfilled' && s.value.healthy) ? 'healthy' : 'degraded',
            services: {
                tracer: services[0].status === 'fulfilled' ? services[0].value : { healthy: false, error: services[0].reason },
                collector: services[1].status === 'fulfilled' ? services[1].value : { healthy: false, error: services[1].reason },
                metrics: services[2].status === 'fulfilled' ? services[2].value : { healthy: false, error: services[2].reason }
            },
            timestamp: new Date().toISOString()
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
            this.metrics.shutdown()
        ]);
        
        this.initialized = false;
        this.logger.info('Lang Observatory shutdown complete');
    }
}

module.exports = { LangObservatory };