/**
 * Validation Middleware
 * Provides request validation for API endpoints
 */

// const { Validators, ValidationError } = require('../utils/validators');
const { Logger } = require('../utils/logger');

const logger = new Logger({ service: 'ValidationMiddleware' });

// Validation schemas
const schemas = {
  llmCall: {
    provider: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    model: { required: true, type: 'string', minLength: 1, maxLength: 200 },
    input: { required: false, type: ['string', 'object'] },
    output: { required: false, type: ['string', 'object'] },
    tokens: {
      required: false,
      type: 'object',
      properties: {
        input: { type: 'number', min: 0 },
        output: { type: 'number', min: 0 },
        total: { type: 'number', min: 0 },
      },
    },
    cost: {
      required: false,
      type: 'object',
      properties: {
        input: { type: 'number', min: 0 },
        output: { type: 'number', min: 0 },
        total: { type: 'number', min: 0 },
      },
    },
    latency: { required: false, type: 'number', min: 0 },
    timeToFirstToken: { required: false, type: 'number', min: 0 },
    tokensPerSecond: { required: false, type: 'number', min: 0 },
    status: {
      required: false,
      type: 'string',
      enum: ['success', 'error', 'timeout'],
    },
    error: { required: false, type: 'string', maxLength: 1000 },
    metadata: { required: false, type: 'object' },
    traceId: {
      required: false,
      type: 'string',
      pattern:
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    },
    sessionId: { required: false, type: 'string', maxLength: 100 },
    startedAt: { required: false, type: 'string' }, // ISO date string
    completedAt: { required: false, type: 'string' }, // ISO date string
  },

  llmCallBatch: {
    calls: {
      required: true,
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: 'llmCall', // Reference to llmCall schema
    },
  },

  trace: {
    operation: { required: true, type: 'string', minLength: 1, maxLength: 200 },
    sessionId: { required: false, type: 'string', maxLength: 100 },
    userId: { required: false, type: 'string', maxLength: 100 },
    parentTraceId: {
      required: false,
      type: 'string',
      pattern:
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    },
    metadata: { required: false, type: 'object' },
    tags: { required: false, type: 'object' },
  },

  metric: {
    name: { required: true, type: 'string', minLength: 1, maxLength: 200 },
    value: { required: true, type: 'number' },
    type: {
      required: false,
      type: 'string',
      enum: ['counter', 'gauge', 'histogram'],
    },
    labels: { required: false, type: 'object' },
    timestamp: { required: false, type: 'number', min: 0 },
  },

  query: {
    startDate: { required: false, type: 'string' }, // ISO date string
    endDate: { required: false, type: 'string' }, // ISO date string
    limit: { required: false, type: 'number', min: 1, max: 1000 },
    offset: { required: false, type: 'number', min: 0 },
    groupBy: {
      required: false,
      type: 'string',
      enum: ['hour', 'day', 'week', 'month', 'provider', 'model'],
    },
  },
};

function validationMiddleware(schemaName) {
  return (req, res, next) => {
    try {
      const schema = schemas[schemaName];
      if (!schema) {
        logger.error(`Validation schema '${schemaName}' not found`);
        return res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Validation configuration error',
        });
      }

      const errors = validateObject(req.body, schema, schemaName);

      if (errors.length > 0) {
        logger.debug('Validation failed', {
          schema: schemaName,
          errors,
          body: req.body,
        });

        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Request validation failed',
          details: errors,
        });
      }

      // Sanitize input data
      req.body = sanitizeObject(req.body, schema);

      next();
    } catch (error) {
      logger.error('Validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Validation failed',
      });
    }
  };
}

function queryValidationMiddleware(req, res, next) {
  try {
    const errors = validateObject(req.query, schemas.query, 'query');

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Query parameter validation failed',
        details: errors,
      });
    }

    // Sanitize and convert query parameters
    req.query = sanitizeObject(req.query, schemas.query);

    next();
  } catch (error) {
    logger.error('Query validation middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Query validation failed',
    });
  }
}

function validateObject(obj, schema, schemaName = 'object') {
  const errors = [];

  // Check for required fields
  for (const [field, rules] of Object.entries(schema)) {
    if (rules.required && (obj[field] === undefined || obj[field] === null)) {
      errors.push({
        field,
        message: `${field} is required`,
        code: 'REQUIRED_FIELD',
      });
      continue;
    }

    // Skip validation if field is not present and not required
    if (obj[field] === undefined || obj[field] === null) {
      continue;
    }

    const fieldErrors = validateField(obj[field], rules, field);
    errors.push(...fieldErrors);
  }

  return errors;
}

function validateField(value, rules, fieldName) {
  const errors = [];

  // Type validation
  if (rules.type) {
    const validTypes = Array.isArray(rules.type) ? rules.type : [rules.type];
    const valueType = Array.isArray(value) ? 'array' : typeof value;

    if (!validTypes.includes(valueType)) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be of type ${validTypes.join(' or ')}`,
        code: 'INVALID_TYPE',
        expected: validTypes,
        actual: valueType,
      });
      return errors; // Skip other validations if type is wrong
    }
  }

  // String validations
  if (typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be at least ${rules.minLength} characters long`,
        code: 'MIN_LENGTH',
        minLength: rules.minLength,
        actual: value.length,
      });
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be at most ${rules.maxLength} characters long`,
        code: 'MAX_LENGTH',
        maxLength: rules.maxLength,
        actual: value.length,
      });
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push({
        field: fieldName,
        message: `${fieldName} format is invalid`,
        code: 'INVALID_FORMAT',
        pattern: rules.pattern.toString(),
      });
    }

    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be one of: ${rules.enum.join(', ')}`,
        code: 'INVALID_ENUM',
        allowedValues: rules.enum,
        actual: value,
      });
    }
  }

  // Number validations
  if (typeof value === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be at least ${rules.min}`,
        code: 'MIN_VALUE',
        min: rules.min,
        actual: value,
      });
    }

    if (rules.max !== undefined && value > rules.max) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be at most ${rules.max}`,
        code: 'MAX_VALUE',
        max: rules.max,
        actual: value,
      });
    }
  }

  // Array validations
  if (Array.isArray(value)) {
    if (rules.minItems && value.length < rules.minItems) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must have at least ${rules.minItems} items`,
        code: 'MIN_ITEMS',
        minItems: rules.minItems,
        actual: value.length,
      });
    }

    if (rules.maxItems && value.length > rules.maxItems) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must have at most ${rules.maxItems} items`,
        code: 'MAX_ITEMS',
        maxItems: rules.maxItems,
        actual: value.length,
      });
    }

    // Validate array items
    if (rules.items) {
      const itemSchema =
        typeof rules.items === 'string' ? schemas[rules.items] : rules.items;
      value.forEach((item, index) => {
        const itemErrors = validateObject(
          item,
          itemSchema,
          `${fieldName}[${index}]`
        );
        errors.push(...itemErrors);
      });
    }
  }

  // Object validations
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    if (rules.properties) {
      const propErrors = validateObject(value, rules.properties, fieldName);
      errors.push(...propErrors);
    }
  }

  return errors;
}

function sanitizeObject(obj, schema) {
  const sanitized = {};

  for (const [field, rules] of Object.entries(schema)) {
    if (obj[field] !== undefined && obj[field] !== null) {
      sanitized[field] = sanitizeField(obj[field], rules);
    }
  }

  return sanitized;
}

function sanitizeField(value, rules) {
  // String sanitization
  if (typeof value === 'string') {
    // Remove control characters and limit length
    // eslint-disable-next-line no-control-regex
    let sanitized = value.replace(/[\u0000-\u001F\u007F]/g, '');

    if (rules.maxLength) {
      sanitized = sanitized.substring(0, rules.maxLength);
    }

    return sanitized;
  }

  // Number sanitization
  if (typeof value === 'number') {
    // Ensure finite number
    if (!isFinite(value)) {
      return 0;
    }

    // Apply min/max constraints
    if (rules.min !== undefined && value < rules.min) {
      return rules.min;
    }

    if (rules.max !== undefined && value > rules.max) {
      return rules.max;
    }

    return value;
  }

  // Array sanitization
  if (Array.isArray(value)) {
    let sanitized = value;

    // Apply length constraints
    if (rules.maxItems && sanitized.length > rules.maxItems) {
      sanitized = sanitized.slice(0, rules.maxItems);
    }

    // Sanitize items
    if (rules.items) {
      const itemSchema =
        typeof rules.items === 'string' ? schemas[rules.items] : rules.items;
      sanitized = sanitized.map(item => sanitizeObject(item, itemSchema));
    }

    return sanitized;
  }

  // Object sanitization
  if (typeof value === 'object' && value !== null) {
    if (rules.properties) {
      return sanitizeObject(value, rules.properties);
    }

    // Basic object sanitization - remove undefined values
    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
      if (val !== undefined) {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  return value;
}

module.exports = {
  validationMiddleware,
  queryValidationMiddleware,
  validateObject,
  validateField,
  sanitizeObject,
  schemas,
};
