/**
 * Input Validation Utilities
 * Provides validation functions for API inputs and configurations
 */

class ValidationError extends Error {
    constructor(message, field = null) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
    }
}

class Validators {
    static validateLLMCallData(data) {
        const errors = [];
        
        // Required fields
        if (!data.provider || typeof data.provider !== 'string') {
            errors.push({ field: 'provider', message: 'Provider is required and must be a string' });
        }
        
        if (!data.model || typeof data.model !== 'string') {
            errors.push({ field: 'model', message: 'Model is required and must be a string' });
        }
        
        // Optional but validated fields
        if (data.input !== undefined && typeof data.input !== 'string' && typeof data.input !== 'object') {
            errors.push({ field: 'input', message: 'Input must be a string or object' });
        }
        
        if (data.output !== undefined && typeof data.output !== 'string' && typeof data.output !== 'object') {
            errors.push({ field: 'output', message: 'Output must be a string or object' });
        }
        
        if (data.tokens && typeof data.tokens === 'object') {
            if (data.tokens.input !== undefined && !Number.isInteger(data.tokens.input)) {
                errors.push({ field: 'tokens.input', message: 'Input tokens must be an integer' });
            }
            
            if (data.tokens.output !== undefined && !Number.isInteger(data.tokens.output)) {
                errors.push({ field: 'tokens.output', message: 'Output tokens must be an integer' });
            }
            
            if (data.tokens.total !== undefined && !Number.isInteger(data.tokens.total)) {
                errors.push({ field: 'tokens.total', message: 'Total tokens must be an integer' });
            }
        }
        
        if (data.cost && typeof data.cost === 'object') {
            if (data.cost.input !== undefined && typeof data.cost.input !== 'number') {
                errors.push({ field: 'cost.input', message: 'Input cost must be a number' });
            }
            
            if (data.cost.output !== undefined && typeof data.cost.output !== 'number') {
                errors.push({ field: 'cost.output', message: 'Output cost must be a number' });
            }
            
            if (data.cost.total !== undefined && typeof data.cost.total !== 'number') {
                errors.push({ field: 'cost.total', message: 'Total cost must be a number' });
            }
        }
        
        if (errors.length > 0) {
            throw new ValidationError(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
        }
        
        return true;
    }

    static validateOperationName(operation) {
        if (!operation || typeof operation !== 'string') {
            throw new ValidationError('Operation name is required and must be a string');
        }
        
        if (operation.length < 1 || operation.length > 100) {
            throw new ValidationError('Operation name must be between 1 and 100 characters');
        }
        
        if (!/^[a-zA-Z0-9_\-\.]+$/.test(operation)) {
            throw new ValidationError('Operation name can only contain alphanumeric characters, underscores, hyphens, and dots');
        }
        
        return true;
    }

    static validateTraceId(traceId) {
        if (!traceId || typeof traceId !== 'string') {
            throw new ValidationError('Trace ID is required and must be a string');
        }
        
        // UUID v4 format validation
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(traceId)) {
            throw new ValidationError('Trace ID must be a valid UUID v4');
        }
        
        return true;
    }

    static validateMetricData(data) {
        const errors = [];
        
        if (!data.name || typeof data.name !== 'string') {
            errors.push({ field: 'name', message: 'Metric name is required and must be a string' });
        }
        
        if (data.value === undefined || typeof data.value !== 'number') {
            errors.push({ field: 'value', message: 'Metric value is required and must be a number' });
        }
        
        if (data.type && !['counter', 'gauge', 'histogram'].includes(data.type)) {
            errors.push({ field: 'type', message: 'Metric type must be one of: counter, gauge, histogram' });
        }
        
        if (data.labels && typeof data.labels !== 'object') {
            errors.push({ field: 'labels', message: 'Labels must be an object' });
        }
        
        if (data.timestamp && (!Number.isInteger(data.timestamp) || data.timestamp < 0)) {
            errors.push({ field: 'timestamp', message: 'Timestamp must be a positive integer' });
        }
        
        if (errors.length > 0) {
            throw new ValidationError(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
        }
        
        return true;
    }

    static validateConfiguration(config) {
        const errors = [];
        
        // Langfuse configuration
        if (config.langfuse) {
            if (config.langfuse.host && typeof config.langfuse.host !== 'string') {
                errors.push({ field: 'langfuse.host', message: 'Langfuse host must be a string' });
            }
            
            if (config.langfuse.publicKey && typeof config.langfuse.publicKey !== 'string') {
                errors.push({ field: 'langfuse.publicKey', message: 'Langfuse public key must be a string' });
            }
            
            if (config.langfuse.secretKey && typeof config.langfuse.secretKey !== 'string') {
                errors.push({ field: 'langfuse.secretKey', message: 'Langfuse secret key must be a string' });
            }
        }
        
        // OpenLIT configuration
        if (config.openlit) {
            if (config.openlit.endpoint && typeof config.openlit.endpoint !== 'string') {
                errors.push({ field: 'openlit.endpoint', message: 'OpenLIT endpoint must be a string' });
            }
            
            if (config.openlit.serviceName && typeof config.openlit.serviceName !== 'string') {
                errors.push({ field: 'openlit.serviceName', message: 'OpenLIT service name must be a string' });
            }
        }
        
        // Metrics configuration
        if (config.metrics) {
            if (config.metrics.retentionDays !== undefined && (!Number.isInteger(config.metrics.retentionDays) || config.metrics.retentionDays < 1)) {
                errors.push({ field: 'metrics.retentionDays', message: 'Metrics retention days must be a positive integer' });
            }
            
            if (config.metrics.aggregationInterval !== undefined && (!Number.isInteger(config.metrics.aggregationInterval) || config.metrics.aggregationInterval < 1000)) {
                errors.push({ field: 'metrics.aggregationInterval', message: 'Metrics aggregation interval must be at least 1000ms' });
            }
        }
        
        if (errors.length > 0) {
            throw new ValidationError(`Configuration validation failed: ${errors.map(e => e.message).join(', ')}`);
        }
        
        return true;
    }

    static sanitizeInput(input, maxLength = 10000) {
        if (typeof input === 'string') {
            // Remove potentially dangerous characters
            let sanitized = input
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
                .substring(0, maxLength); // Truncate to max length
            
            return sanitized;
        }
        
        if (typeof input === 'object' && input !== null) {
            // Recursively sanitize object properties
            const sanitized = {};
            for (const [key, value] of Object.entries(input)) {
                if (typeof key === 'string' && key.length <= 100) {
                    sanitized[this.sanitizeInput(key, 100)] = this.sanitizeInput(value, maxLength);
                }
            }
            return sanitized;
        }
        
        return input;
    }

    static validateProvider(provider) {
        const validProviders = [
            'openai',
            'anthropic',
            'google',
            'azure',
            'aws',
            'cohere',
            'huggingface',
            'custom'
        ];
        
        if (!validProviders.includes(provider.toLowerCase())) {
            throw new ValidationError(`Invalid provider: ${provider}. Must be one of: ${validProviders.join(', ')}`);
        }
        
        return true;
    }

    static validateModel(provider, model) {
        // Provider-specific model validation
        const modelPatterns = {
            'openai': /^(gpt-3\.5-turbo|gpt-4|gpt-4-turbo|text-davinci-003|text-embedding-ada-002).*$/,
            'anthropic': /^(claude-3|claude-2|claude-instant).*$/,
            'google': /^(gemini|palm|bard).*$/,
            'azure': /^(gpt-35-turbo|gpt-4).*$/
        };
        
        const pattern = modelPatterns[provider.toLowerCase()];
        if (pattern && !pattern.test(model)) {
            throw new ValidationError(`Invalid model '${model}' for provider '${provider}'`);
        }
        
        return true;
    }

    static validateDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start.getTime())) {
            throw new ValidationError('Start date is invalid');
        }
        
        if (isNaN(end.getTime())) {
            throw new ValidationError('End date is invalid');
        }
        
        if (start >= end) {
            throw new ValidationError('Start date must be before end date');
        }
        
        const maxRange = 90 * 24 * 60 * 60 * 1000; // 90 days
        if (end - start > maxRange) {
            throw new ValidationError('Date range cannot exceed 90 days');
        }
        
        return true;
    }
}

module.exports = { Validators, ValidationError };