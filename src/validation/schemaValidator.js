/**
 * Schema Validation System
 * Comprehensive data validation with security and performance optimizations
 */

const { Logger } = require('../utils/logger');
const { SecurityManager } = require('../quantum/securityManager');

class SchemaValidator {
    constructor(config = {}) {
        this.config = {
            strictMode: true,
            enableSanitization: true,
            maxStringLength: 10000,
            maxArrayLength: 1000,
            maxDepth: 10,
            ...config
        };
        
        this.logger = new Logger({ service: 'schema-validator' });
        this.security = new SecurityManager(config.security || {});
        this.schemas = new Map();
        this.cache = new Map();
        this.cacheSize = 0;
        this.maxCacheSize = config.maxCacheSize || 1000;
    }

    async initialize() {
        await this.security.initialize();
        this.registerBuiltinSchemas();
        this.logger.info('Schema Validator initialized');
    }

    registerBuiltinSchemas() {
        // LLM Call Schema
        this.registerSchema('llm-call', {
            type: 'object',
            required: ['provider', 'model', 'input', 'output'],
            properties: {
                provider: { type: 'string', minLength: 1, maxLength: 50 },
                model: { type: 'string', minLength: 1, maxLength: 100 },
                input: { type: 'string', maxLength: this.config.maxStringLength },
                output: { type: 'string', maxLength: this.config.maxStringLength },
                timestamp: { type: 'string', format: 'iso-date-time' },
                metadata: { type: 'object' }
            }
        });

        // Task Schema
        this.registerSchema('task', {
            type: 'object',
            required: ['id'],
            properties: {
                id: { type: 'string', minLength: 1, maxLength: 100 },
                priority: { type: 'number', minimum: 0, maximum: 1 },
                estimatedDuration: { type: 'number', minimum: 0 },
                dependencies: { type: 'array', items: { type: 'string' } },
                metadata: { type: 'object' }
            }
        });

        // Health Status Schema
        this.registerSchema('health-status', {
            type: 'object',
            required: ['status'],
            properties: {
                status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                services: { type: 'object' },
                timestamp: { type: 'string', format: 'iso-date-time' }
            }
        });

        // Metrics Schema
        this.registerSchema('metrics', {
            type: 'object',
            properties: {
                name: { type: 'string', minLength: 1, maxLength: 100 },
                value: { type: 'number' },
                unit: { type: 'string', maxLength: 20 },
                tags: { type: 'object' },
                timestamp: { type: 'string', format: 'iso-date-time' }
            }
        });

        // API Request Schema
        this.registerSchema('api-request', {
            type: 'object',
            required: ['method', 'path'],
            properties: {
                method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
                path: { type: 'string', pattern: '^/[a-zA-Z0-9/_-]*$' },
                headers: { type: 'object' },
                body: { type: ['object', 'string', 'null'] },
                params: { type: 'object' },
                query: { type: 'object' }
            }
        });
    }

    registerSchema(name, schema) {
        if (!name || typeof name !== 'string') {
            throw new Error('Schema name must be a non-empty string');
        }
        
        if (!schema || typeof schema !== 'object') {
            throw new Error('Schema must be an object');
        }

        this.schemas.set(name, this.normalizeSchema(schema));
        this.logger.info(`Registered schema: ${name}`);
    }

    normalizeSchema(schema) {
        const normalized = { ...schema };
        
        // Add default values
        if (!normalized.type) {
            normalized.type = 'object';
        }
        
        // Recursively normalize nested schemas
        if (normalized.properties) {
            Object.keys(normalized.properties).forEach(key => {
                normalized.properties[key] = this.normalizeSchema(normalized.properties[key]);
            });
        }
        
        if (normalized.items) {
            normalized.items = this.normalizeSchema(normalized.items);
        }
        
        return normalized;
    }

    async validate(schemaName, data, options = {}) {
        const startTime = Date.now();
        
        try {
            // Security validation first
            const securityCheck = await this.security.validateInput(data, {
                maxDepth: this.config.maxDepth,
                maxStringLength: this.config.maxStringLength,
                checkXSS: true,
                checkSQLInjection: true
            });
            
            if (!securityCheck.safe) {
                throw new ValidationError('Security validation failed', securityCheck.issues);
            }

            // Check cache
            const cacheKey = this.getCacheKey(schemaName, data);
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
                    return cached.result;
                }
                this.cache.delete(cacheKey);
                this.cacheSize--;
            }

            // Get schema
            const schema = this.schemas.get(schemaName);
            if (!schema) {
                throw new ValidationError(`Unknown schema: ${schemaName}`);
            }

            // Validate
            const result = await this.validateAgainstSchema(data, schema, [], options);
            
            // Cache result
            this.cacheResult(cacheKey, result);
            
            // Log validation metrics
            const duration = Date.now() - startTime;
            this.logger.debug(`Validation completed for ${schemaName} in ${duration}ms`);
            
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(`Validation failed for ${schemaName} after ${duration}ms:`, error);
            throw error;
        }
    }

    async validateAgainstSchema(data, schema, path = [], options = {}) {
        const context = {
            path: path.join('.'),
            value: data,
            schema
        };

        // Type validation
        if (!this.validateType(data, schema.type)) {
            throw new ValidationError(`Invalid type at ${context.path}. Expected ${schema.type}, got ${typeof data}`);
        }

        // Required fields
        if (schema.required && schema.type === 'object') {
            for (const field of schema.required) {
                if (data[field] === undefined || data[field] === null) {
                    throw new ValidationError(`Missing required field: ${path.concat(field).join('.')}`);
                }
            }
        }

        // Validate based on type
        switch (schema.type) {
            case 'object':
                await this.validateObject(data, schema, path, options);
                break;
            case 'array':
                await this.validateArray(data, schema, path, options);
                break;
            case 'string':
                this.validateString(data, schema, context);
                break;
            case 'number':
                this.validateNumber(data, schema, context);
                break;
            case 'boolean':
                this.validateBoolean(data, schema, context);
                break;
        }

        // Custom validation
        if (schema.validate && typeof schema.validate === 'function') {
            const customResult = await schema.validate(data, context);
            if (!customResult.valid) {
                throw new ValidationError(`Custom validation failed at ${context.path}: ${customResult.message}`);
            }
        }

        // Sanitization
        if (this.config.enableSanitization && options.sanitize !== false) {
            return this.sanitizeData(data, schema);
        }

        return { valid: true, data };
    }

    validateType(data, expectedType) {
        if (expectedType === 'any') return true;
        
        if (Array.isArray(expectedType)) {
            return expectedType.includes(typeof data) || expectedType.includes('null') && data === null;
        }
        
        switch (expectedType) {
            case 'object':
                return typeof data === 'object' && data !== null && !Array.isArray(data);
            case 'array':
                return Array.isArray(data);
            case 'string':
                return typeof data === 'string';
            case 'number':
                return typeof data === 'number' && !isNaN(data);
            case 'boolean':
                return typeof data === 'boolean';
            case 'null':
                return data === null;
            default:
                return typeof data === expectedType;
        }
    }

    async validateObject(data, schema, path, options) {
        if (schema.properties) {
            for (const [key, propSchema] of Object.entries(schema.properties)) {
                if (data[key] !== undefined) {
                    await this.validateAgainstSchema(data[key], propSchema, [...path, key], options);
                }
            }
        }

        // Additional properties
        if (schema.additionalProperties === false) {
            const allowedKeys = Object.keys(schema.properties || {});
            for (const key of Object.keys(data)) {
                if (!allowedKeys.includes(key)) {
                    throw new ValidationError(`Additional property not allowed: ${[...path, key].join('.')}`);
                }
            }
        }
    }

    async validateArray(data, schema, path, options) {
        if (schema.maxItems && data.length > schema.maxItems) {
            throw new ValidationError(`Array too long at ${path.join('.')}. Max: ${schema.maxItems}, got: ${data.length}`);
        }
        
        if (schema.minItems && data.length < schema.minItems) {
            throw new ValidationError(`Array too short at ${path.join('.')}. Min: ${schema.minItems}, got: ${data.length}`);
        }

        if (data.length > this.config.maxArrayLength) {
            throw new ValidationError(`Array exceeds maximum length: ${this.config.maxArrayLength}`);
        }

        if (schema.items) {
            for (let i = 0; i < data.length; i++) {
                await this.validateAgainstSchema(data[i], schema.items, [...path, i.toString()], options);
            }
        }
    }

    validateString(data, schema, context) {
        if (schema.minLength && data.length < schema.minLength) {
            throw new ValidationError(`String too short at ${context.path}. Min: ${schema.minLength}, got: ${data.length}`);
        }
        
        if (schema.maxLength && data.length > schema.maxLength) {
            throw new ValidationError(`String too long at ${context.path}. Max: ${schema.maxLength}, got: ${data.length}`);
        }
        
        if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
            throw new ValidationError(`String doesn't match pattern at ${context.path}`);
        }
        
        if (schema.format) {
            this.validateFormat(data, schema.format, context);
        }
    }

    validateNumber(data, schema, context) {
        if (schema.minimum && data < schema.minimum) {
            throw new ValidationError(`Number too small at ${context.path}. Min: ${schema.minimum}, got: ${data}`);
        }
        
        if (schema.maximum && data > schema.maximum) {
            throw new ValidationError(`Number too large at ${context.path}. Max: ${schema.maximum}, got: ${data}`);
        }
        
        if (schema.multipleOf && data % schema.multipleOf !== 0) {
            throw new ValidationError(`Number not multiple of ${schema.multipleOf} at ${context.path}`);
        }
    }

    validateBoolean(data, schema, context) {
        // Boolean validation is straightforward - type check is sufficient
        return true;
    }

    validateFormat(data, format, context) {
        const formats = {
            'email': /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            'url': /^https?:\/\/.+/,
            'uuid': /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            'iso-date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
            'ipv4': /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
        };
        
        if (formats[format] && !formats[format].test(data)) {
            throw new ValidationError(`Invalid ${format} format at ${context.path}`);
        }
    }

    sanitizeData(data, schema) {
        if (typeof data !== 'object' || data === null) {
            return data;
        }

        const sanitized = Array.isArray(data) ? [] : {};

        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string') {
                // Basic XSS protection
                sanitized[key] = value
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+\s*=/gi, '');
            } else if (typeof value === 'object' && value !== null) {
                const propSchema = schema.properties?.[key] || schema.items || {};
                sanitized[key] = this.sanitizeData(value, propSchema);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    getCacheKey(schemaName, data) {
        const dataStr = JSON.stringify(data);
        const hash = this.simpleHash(dataStr);
        return `${schemaName}:${hash}`;
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    cacheResult(key, result) {
        if (this.cacheSize >= this.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.cacheSize--;
        }

        this.cache.set(key, {
            result,
            timestamp: Date.now()
        });
        this.cacheSize++;
    }

    clearCache() {
        this.cache.clear();
        this.cacheSize = 0;
        this.logger.info('Validation cache cleared');
    }

    getStats() {
        return {
            registeredSchemas: this.schemas.size,
            cacheSize: this.cacheSize,
            cacheHitRate: this.cacheHitRate || 0
        };
    }
}

class ValidationError extends Error {
    constructor(message, details = null) {
        super(message);
        this.name = 'ValidationError';
        this.type = 'validation';
        this.details = details;
    }
}

module.exports = { SchemaValidator, ValidationError };