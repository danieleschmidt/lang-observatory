/**
 * Advanced Input Validation Middleware
 * Provides comprehensive validation with security considerations
 */

const { Logger } = require('../utils/logger');
const { ValidationError } = require('./errorHandling');

const logger = new Logger({ service: 'AdvancedValidation' });

// Common validation patterns
const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  apiKey: /^[a-zA-Z0-9_-]{32,}$/,
  traceId: /^[a-zA-Z0-9_-]{16,64}$/,
  sessionId: /^[a-zA-Z0-9_-]{16,64}$/,
  provider: /^[a-zA-Z0-9_-]{1,50}$/,
  model: /^[a-zA-Z0-9._-]{1,100}$/,
  operation: /^[a-zA-Z0-9_-]{1,100}$/,
  timeRange: /^(1h|24h|7d|30d)$/,
  sortBy: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
  sortOrder: /^(asc|desc)$/i,
};

// Data type validators
const validators = {
  string: (value, rules = {}) => {
    if (typeof value !== 'string') {
      throw new ValidationError('Value must be a string');
    }

    if (rules.minLength && value.length < rules.minLength) {
      throw new ValidationError(
        `String must be at least ${rules.minLength} characters long`
      );
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      throw new ValidationError(
        `String must be at most ${rules.maxLength} characters long`
      );
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      throw new ValidationError('String format is invalid');
    }

    if (rules.enum && !rules.enum.includes(value)) {
      throw new ValidationError(
        `Value must be one of: ${rules.enum.join(', ')}`
      );
    }

    return value.trim();
  },

  number: (value, rules = {}) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(num)) {
      throw new ValidationError('Value must be a valid number');
    }

    if (rules.min !== undefined && num < rules.min) {
      throw new ValidationError(`Number must be at least ${rules.min}`);
    }

    if (rules.max !== undefined && num > rules.max) {
      throw new ValidationError(`Number must be at most ${rules.max}`);
    }

    if (rules.integer && !Number.isInteger(num)) {
      throw new ValidationError('Value must be an integer');
    }

    return num;
  },

  boolean: value => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }
    throw new ValidationError('Value must be a boolean');
  },

  array: (value, rules = {}) => {
    if (!Array.isArray(value)) {
      throw new ValidationError('Value must be an array');
    }

    if (rules.minLength && value.length < rules.minLength) {
      throw new ValidationError(
        `Array must have at least ${rules.minLength} items`
      );
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      throw new ValidationError(
        `Array must have at most ${rules.maxLength} items`
      );
    }

    if (rules.itemType) {
      return value.map((item, index) => {
        try {
          return validators[rules.itemType](item, rules.itemRules || {});
        } catch (error) {
          throw new ValidationError(
            `Array item at index ${index}: ${error.message}`
          );
        }
      });
    }

    return value;
  },

  object: (value, rules = {}) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ValidationError('Value must be an object');
    }

    const validated = {};

    // Validate required fields
    if (rules.required) {
      for (const field of rules.required) {
        if (!(field in value)) {
          throw new ValidationError(`Required field '${field}' is missing`);
        }
      }
    }

    // Validate each field
    if (rules.schema) {
      for (const [field, fieldRules] of Object.entries(rules.schema)) {
        if (field in value) {
          try {
            validated[field] = validateField(value[field], fieldRules, field);
          } catch (error) {
            if (error instanceof ValidationError) {
              error.field = field;
            }
            throw error;
          }
        }
      }
    }

    // Check for unexpected fields
    if (rules.strict) {
      const allowedFields = new Set(Object.keys(rules.schema || {}));
      for (const field of Object.keys(value)) {
        if (!allowedFields.has(field)) {
          throw new ValidationError(`Unexpected field '${field}'`);
        }
      }
    }

    return validated;
  },
};

// Validate a single field
const validateField = (value, rules, fieldName) => {
  try {
    // Handle null/undefined
    if (value === null || value === undefined) {
      if (rules.required) {
        throw new ValidationError(`Field '${fieldName}' is required`);
      }
      return rules.default || value;
    }

    // Apply type validation
    if (rules.type && validators[rules.type]) {
      return validators[rules.type](value, rules);
    }

    return value;
  } catch (error) {
    if (error instanceof ValidationError && !error.field) {
      error.field = fieldName;
    }
    throw error;
  }
};

// Validation schemas for common request types
const schemas = {
  llmCall: {
    schema: {
      provider: { type: 'string', required: true, pattern: patterns.provider },
      model: { type: 'string', required: true, pattern: patterns.model },
      input: { type: 'string', maxLength: 50000 },
      output: { type: 'string', maxLength: 50000 },
      tokens: {
        type: 'object',
        schema: {
          input: { type: 'number', min: 0, integer: true },
          output: { type: 'number', min: 0, integer: true },
          total: { type: 'number', min: 0, integer: true },
        },
      },
      cost: {
        type: 'object',
        schema: {
          input: { type: 'number', min: 0 },
          output: { type: 'number', min: 0 },
          total: { type: 'number', min: 0 },
        },
      },
      latency: { type: 'number', min: 0 },
      traceId: { type: 'string', pattern: patterns.traceId },
      sessionId: { type: 'string', pattern: patterns.sessionId },
      metadata: { type: 'object' },
    },
    required: ['provider', 'model'],
  },

  trace: {
    schema: {
      operation: {
        type: 'string',
        required: true,
        pattern: patterns.operation,
      },
      sessionId: { type: 'string', pattern: patterns.sessionId },
      userId: { type: 'string', maxLength: 100 },
      parentTraceId: { type: 'string', pattern: patterns.traceId },
      metadata: { type: 'object' },
      tags: { type: 'object' },
    },
    required: ['operation'],
  },

  metric: {
    schema: {
      name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
      value: { type: 'number', required: true },
      type: {
        type: 'string',
        enum: ['gauge', 'counter', 'histogram'],
        default: 'gauge',
      },
      labels: { type: 'object', default: {} },
      timestamp: { type: 'number', min: 0 },
    },
    required: ['name', 'value'],
  },

  queryParams: {
    schema: {
      page: { type: 'number', min: 1, integer: true, default: 1 },
      limit: { type: 'number', min: 1, max: 1000, integer: true, default: 50 },
      sortBy: { type: 'string', pattern: patterns.sortBy },
      sortOrder: {
        type: 'string',
        pattern: patterns.sortOrder,
        default: 'desc',
      },
      timeRange: {
        type: 'string',
        pattern: patterns.timeRange,
        default: '24h',
      },
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      provider: { type: 'string', pattern: patterns.provider },
      model: { type: 'string', pattern: patterns.model },
    },
  },
};

// Create validation middleware
const createValidator = (schemaName, location = 'body') => {
  const schema = schemas[schemaName];
  if (!schema) {
    throw new Error(`Unknown validation schema: ${schemaName}`);
  }

  return (req, res, next) => {
    try {
      const data = req[location];
      const validated = validators.object(data, schema);
      req[location] = validated;
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.warn(`Validation failed for ${schemaName}:`, {
          field: error.field,
          message: error.message,
          path: req.path,
          method: req.method,
        });
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          field: error.field,
          timestamp: new Date().toISOString(),
        });
      }

      logger.error('Validation middleware error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Validation processing failed',
      });
    }
  };
};

// Sanitize dangerous content
const sanitizeContent = content => {
  if (typeof content !== 'string') return content;

  return (
    content
      // Remove potentially dangerous HTML/JS
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      // Remove SQL injection patterns
      .replace(/('|(\\')|(;)|(\\)|(%))/g, '')
      // Remove control characters
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim()
  );
};

// Security-focused content validator
const securityValidator = (req, res, next) => {
  const recursiveSanitize = obj => {
    if (typeof obj === 'string') {
      return sanitizeContent(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(recursiveSanitize);
    } else if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = recursiveSanitize(value);
      }
      return sanitized;
    }
    return obj;
  };

  try {
    if (req.body) req.body = recursiveSanitize(req.body);
    if (req.query) req.query = recursiveSanitize(req.query);
    if (req.params) req.params = recursiveSanitize(req.params);

    next();
  } catch (error) {
    logger.error('Security validation failed:', error);
    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid input format',
    });
  }
};

module.exports = {
  schemas,
  validators,
  patterns,
  createValidator,
  securityValidator,
  sanitizeContent,
  validateField,
};
