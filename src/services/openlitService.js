/**
 * OpenLIT Integration Service
 * Handles OpenTelemetry-based LLM observability metrics
 */

const { Logger } = require('../utils/logger');

class OpenLITCollector {
    constructor(config = {}) {
        this.config = {
            endpoint: config.endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
            serviceName: config.serviceName || 'lang-observatory',
            enabled: config.enabled !== false,
            exportInterval: config.exportInterval || 5000,
            batchTimeout: config.batchTimeout || 2000,
            maxExportBatchSize: config.maxExportBatchSize || 512,
            ...config
        };
        
        this.logger = new Logger({ service: 'OpenLITCollector' });
        this.metrics = [];
        this.exportTimer = null;
        this.initialized = false;
    }

    async initialize() {
        if (!this.config.enabled) {
            this.logger.info('OpenLIT collection disabled');
            this.initialized = true;
            return;
        }

        try {
            // Initialize OpenTelemetry SDK
            await this._initializeOTEL();
            
            // Start periodic export
            this._startExportTimer();
            
            this.initialized = true;
            this.logger.info('OpenLIT collector initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize OpenLIT collector:', error);
            throw error;
        }
    }

    async recordLLMMetrics(callData) {
        if (!this.config.enabled) return;

        const timestamp = Date.now();
        const metrics = [
            {
                name: 'llm_request_duration',
                type: 'histogram',
                value: callData.duration || 0,
                labels: {
                    provider: callData.provider,
                    model: callData.model,
                    success: String(callData.success !== false)
                },
                timestamp
            },
            {
                name: 'llm_token_usage',
                type: 'counter',
                value: callData.tokens?.total || 0,
                labels: {
                    provider: callData.provider,
                    model: callData.model,
                    type: 'total'
                },
                timestamp
            },
            {
                name: 'llm_token_usage',
                type: 'counter',
                value: callData.tokens?.input || 0,
                labels: {
                    provider: callData.provider,
                    model: callData.model,
                    type: 'input'
                },
                timestamp
            },
            {
                name: 'llm_token_usage',
                type: 'counter',
                value: callData.tokens?.output || 0,
                labels: {
                    provider: callData.provider,
                    model: callData.model,
                    type: 'output'
                },
                timestamp
            },
            {
                name: 'llm_cost',
                type: 'counter',
                value: callData.cost?.total || 0,
                labels: {
                    provider: callData.provider,
                    model: callData.model,
                    currency: 'usd'
                },
                timestamp
            }
        ];

        // Add error metrics if applicable
        if (callData.error) {
            metrics.push({
                name: 'llm_errors',
                type: 'counter',
                value: 1,
                labels: {
                    provider: callData.provider,
                    model: callData.model,
                    error_type: callData.error.type || 'unknown'
                },
                timestamp
            });
        }

        this.metrics.push(...metrics);
        this.logger.debug(`Recorded ${metrics.length} LLM metrics for ${callData.provider}/${callData.model}`);

        // Export if batch is full
        if (this.metrics.length >= this.config.maxExportBatchSize) {
            await this._export();
        }
    }

    recordCustomMetric(name, value, type = 'gauge', labels = {}) {
        if (!this.config.enabled) return;

        const metric = {
            name,
            type,
            value,
            labels,
            timestamp: Date.now()
        };

        this.metrics.push(metric);
        this.logger.debug(`Recorded custom metric: ${name} = ${value}`);
    }

    recordSpan(operation, duration, labels = {}) {
        if (!this.config.enabled) return;

        const span = {
            name: 'llm_operation_span',
            type: 'span',
            operation,
            duration,
            labels: {
                service_name: this.config.serviceName,
                ...labels
            },
            timestamp: Date.now()
        };

        this.metrics.push(span);
        this.logger.debug(`Recorded span: ${operation} (${duration}ms)`);
    }

    async getHealth() {
        if (!this.config.enabled) {
            return { healthy: true, status: 'disabled' };
        }

        try {
            // Test OTEL endpoint connectivity
            await this._testConnection();
            
            return {
                healthy: true,
                status: 'connected',
                pendingMetrics: this.metrics.length,
                endpoint: this.config.endpoint
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
        if (this.exportTimer) {
            clearInterval(this.exportTimer);
            this.exportTimer = null;
        }

        // Export remaining metrics
        await this._export();
        
        this.initialized = false;
        this.logger.info('OpenLIT collector shutdown complete');
    }

    // Private methods
    async _initializeOTEL() {
        // Mock OTEL initialization - in real implementation, configure:
        // - NodeSDK with auto-instrumentations
        // - OTLP exporters for metrics and traces
        // - Resource detection
        // - Custom processors and samplers
        
        this.logger.debug('Initialized OpenTelemetry SDK');
        return Promise.resolve();
    }

    _startExportTimer() {
        this.exportTimer = setInterval(() => {
            if (this.metrics.length > 0) {
                this._export();
            }
        }, this.config.exportInterval);
    }

    async _export() {
        if (this.metrics.length === 0) return;

        const metricsToExport = this.metrics.splice(0);
        
        try {
            await this._exportToOTEL(metricsToExport);
            this.logger.debug(`Exported ${metricsToExport.length} metrics to OTEL collector`);
        } catch (error) {
            this.logger.error('Failed to export metrics to OTEL collector:', error);
            // Re-queue metrics for retry
            this.metrics.unshift(...metricsToExport);
        }
    }

    async _exportToOTEL(metrics) {
        // Mock OTEL export - replace with actual OTLP exporter calls
        const exportData = {
            resourceMetrics: [{
                resource: {
                    attributes: [
                        { key: 'service.name', value: { stringValue: this.config.serviceName } },
                        { key: 'service.version', value: { stringValue: '1.0.0' } }
                    ]
                },
                scopeMetrics: [{
                    scope: {
                        name: 'lang-observatory',
                        version: '1.0.0'
                    },
                    metrics: metrics.map(m => this._formatMetricForOTEL(m))
                }]
            }]
        };

        // Simulate network call
        return new Promise((resolve) => {
            setTimeout(() => {
                this.logger.debug(`Submitted ${metrics.length} metrics to OTEL endpoint: ${this.config.endpoint}`);
                resolve();
            }, 50);
        });
    }

    _formatMetricForOTEL(metric) {
        // Convert internal metric format to OTEL format
        const formatted = {
            name: metric.name,
            description: `LLM observability metric: ${metric.name}`,
            unit: this._getMetricUnit(metric.name),
        };

        // Add type-specific data
        switch (metric.type) {
            case 'counter':
                formatted.sum = {
                    dataPoints: [{
                        attributes: this._formatLabels(metric.labels),
                        asDouble: metric.value,
                        timeUnixNano: metric.timestamp * 1000000
                    }],
                    aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
                    isMonotonic: true
                };
                break;
            
            case 'gauge':
                formatted.gauge = {
                    dataPoints: [{
                        attributes: this._formatLabels(metric.labels),
                        asDouble: metric.value,
                        timeUnixNano: metric.timestamp * 1000000
                    }]
                };
                break;
            
            case 'histogram':
                formatted.histogram = {
                    dataPoints: [{
                        attributes: this._formatLabels(metric.labels),
                        count: 1,
                        sum: metric.value,
                        timeUnixNano: metric.timestamp * 1000000,
                        bucketCounts: [0, 1], // Simplified bucket
                        explicitBounds: [metric.value]
                    }],
                    aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE'
                };
                break;
        }

        return formatted;
    }

    _formatLabels(labels) {
        return Object.entries(labels || {}).map(([key, value]) => ({
            key,
            value: { stringValue: String(value) }
        }));
    }

    _getMetricUnit(metricName) {
        const units = {
            'llm_request_duration': 'ms',
            'llm_token_usage': '1',
            'llm_cost': 'USD',
            'llm_errors': '1'
        };
        
        return units[metricName] || '1';
    }

    async _testConnection() {
        // Mock connection test - in real implementation, ping OTEL collector
        if (!this.config.endpoint) {
            throw new Error('OTEL endpoint not configured');
        }
        
        return Promise.resolve();
    }
}

module.exports = { OpenLITCollector };