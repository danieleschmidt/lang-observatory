/**
 * Comprehensive Validator - Advanced input validation and sanitization
 * Generation 2: Enterprise-grade validation with schema support
 */

const Joi = require('joi');
const DOMPurify = require('isomorphic-dompurify');
const { Logger } = require('../utils/logger');

class ComprehensiveValidator {
  constructor(config = {}) {
    this.config = config;
    this.logger = new Logger({ service: 'ComprehensiveValidator' });

    this.schemas = new Map();
    this.customValidators = new Map();
    this.sanitizers = new Map();

    this.initializeBuiltInSchemas();
    this.initializeSanitizers();
  }

  // Initialize built-in validation schemas
  initializeBuiltInSchemas() {
    // LLM interaction schema
    this.schemas.set(
      'llm-interaction',
      Joi.object({
        provider: Joi.string()
          .valid('openai', 'anthropic', 'google', 'azure', 'huggingface')
          .required(),
        model: Joi.string().min(1).max(100).required(),
        input: Joi.alternatives()
          .try(Joi.string().max(100000), Joi.object())
          .required(),
        output: Joi.alternatives()
          .try(Joi.string().max(100000), Joi.object())
          .required(),
        metadata: Joi.object({
          temperature: Joi.number().min(0).max(2),
          maxTokens: Joi.number().min(1).max(100000),
          topP: Joi.number().min(0).max(1),
          frequencyPenalty: Joi.number().min(-2).max(2),
          presencePenalty: Joi.number().min(-2).max(2),
          stopSequences: Joi.array().items(Joi.string().max(100)),
          userId: Joi.string().max(255),
          sessionId: Joi.string().max(255),
          tags: Joi.array().items(Joi.string().max(50)),
        }).optional(),
      })
    );

    // Trace schema
    this.schemas.set(
      'trace',
      Joi.object({
        operation: Joi.string().min(1).max(255).required(),
        metadata: Joi.object().optional(),
        spans: Joi.array()
          .items(
            Joi.object({
              name: Joi.string().min(1).max(255).required(),
              data: Joi.object().optional(),
              timestamp: Joi.number().positive().optional(),
            })
          )
          .optional(),
      })
    );

    // Span schema
    this.schemas.set(
      'span',
      Joi.object({
        name: Joi.string().min(1).max(255).required(),
        data: Joi.object().optional(),
      })
    );

    // Health check schema
    this.schemas.set(
      'health-check',
      Joi.object({
        service: Joi.string().min(1).max(100).required(),
        status: Joi.string()
          .valid('healthy', 'unhealthy', 'degraded')
          .required(),
        timestamp: Joi.date().iso().required(),
        details: Joi.object().optional(),
      })
    );

    // Metrics schema
    this.schemas.set(
      'metrics',
      Joi.object({
        name: Joi.string().min(1).max(255).required(),
        value: Joi.number().required(),
        type: Joi.string()
          .valid('counter', 'gauge', 'histogram', 'summary')
          .required(),
        labels: Joi.object()
          .pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/, Joi.string().max(255))
          .optional(),
        timestamp: Joi.date().iso().optional(),
      })
    );

    // Configuration schema
    this.schemas.set(
      'config',
      Joi.object({
        langfuse: Joi.object({
          baseUrl: Joi.string().uri().optional(),
          publicKey: Joi.string().max(255).optional(),
          secretKey: Joi.string().max(255).optional(),
          enabled: Joi.boolean().default(true),
        }).optional(),
        openlit: Joi.object({
          endpoint: Joi.string().uri().optional(),
          apiKey: Joi.string().max(255).optional(),
          enabled: Joi.boolean().default(true),
        }).optional(),
        prometheus: Joi.object({
          endpoint: Joi.string().uri().optional(),
          pushGateway: Joi.string().uri().optional(),
          enabled: Joi.boolean().default(true),
        }).optional(),
        logging: Joi.object({
          level: Joi.string()
            .valid('error', 'warn', 'info', 'debug')
            .default('info'),
          format: Joi.string().valid('json', 'text').default('json'),
        }).optional(),
      })
    );
  }

  // Initialize sanitizers
  initializeSanitizers() {
    this.sanitizers.set('html', input => {
      if (typeof input !== 'string') return input;
      return DOMPurify.sanitize(input);
    });

    this.sanitizers.set('sql', input => {
      if (typeof input !== 'string') return input;
      return input.replace(/['";\\]/g, '');
    });

    this.sanitizers.set('xss', input => {
      if (typeof input !== 'string') return input;
      return input
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    });

    this.sanitizers.set('path', input => {
      if (typeof input !== 'string') return input;
      return input.replace(/\.\.[/\\]/g, '').replace(/[<>:"|?*]/g, '');
    });

    this.sanitizers.set('email', input => {
      if (typeof input !== 'string') return input;
      return input.toLowerCase().trim();
    });

    this.sanitizers.set('alphanum', input => {
      if (typeof input !== 'string') return input;
      return input.replace(/[^a-zA-Z0-9]/g, '');
    });
  }

  // Validate data against schema
  async validate(data, schemaName, options = {}) {
    try {
      const schema = this.schemas.get(schemaName);
      if (!schema) {
        throw new Error(`Schema '${schemaName}' not found`);
      }

      const validationOptions = {
        abortEarly: false,
        stripUnknown: options.stripUnknown !== false,
        ...options.joiOptions,
      };

      const { error, value } = schema.validate(data, validationOptions);

      if (error) {
        const validationError = new ValidationError(
          'Validation failed',
          error.details
        );
        this.logger.warn(
          `Validation failed for schema '${schemaName}':`,
          error.details
        );
        throw validationError;
      }

      this.logger.debug(`Validation successful for schema '${schemaName}'`);
      return value;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      this.logger.error(`Validation error for schema '${schemaName}':`, error);
      throw new Error(`Validation failed: ${error.message}`);
    }
  }

  // Sanitize data
  async sanitize(data, sanitizerNames = ['html', 'xss']) {
    try {
      let sanitized = data;

      for (const sanitizerName of sanitizerNames) {
        const sanitizer = this.sanitizers.get(sanitizerName);
        if (!sanitizer) {
          this.logger.warn(`Sanitizer '${sanitizerName}' not found`);
          continue;
        }

        sanitized = this.applySanitizerRecursively(sanitized, sanitizer);
      }

      this.logger.debug(
        `Data sanitized with sanitizers: ${sanitizerNames.join(', ')}`
      );
      return sanitized;
    } catch (error) {
      this.logger.error('Sanitization error:', error);
      throw new Error(`Sanitization failed: ${error.message}`);
    }
  }

  // Apply sanitizer recursively to nested objects
  applySanitizerRecursively(data, sanitizer) {
    if (typeof data === 'string') {
      return sanitizer(data);
    } else if (Array.isArray(data)) {
      return data.map(item => this.applySanitizerRecursively(item, sanitizer));
    } else if (data && typeof data === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.applySanitizerRecursively(value, sanitizer);
      }
      return sanitized;
    }

    return data;
  }

  // Validate and sanitize in one step
  async validateAndSanitize(
    data,
    schemaName,
    sanitizerNames = ['html', 'xss'],
    options = {}
  ) {
    try {
      // Sanitize first
      const sanitized = await this.sanitize(data, sanitizerNames, options);

      // Then validate
      const validated = await this.validate(sanitized, schemaName, options);

      return validated;
    } catch (error) {
      this.logger.error('Validate and sanitize error:', error);
      throw error;
    }
  }

  // Add custom schema
  addSchema(name, schema) {
    if (!(schema && typeof schema.validate === 'function')) {
      throw new Error('Schema must be a valid Joi schema object');
    }

    this.schemas.set(name, schema);
    this.logger.info(`Added custom schema: ${name}`);
  }

  // Add custom validator
  addCustomValidator(name, validator) {
    if (typeof validator !== 'function') {
      throw new Error('Validator must be a function');
    }

    this.customValidators.set(name, validator);
    this.logger.info(`Added custom validator: ${name}`);
  }

  // Add custom sanitizer
  addCustomSanitizer(name, sanitizer) {
    if (typeof sanitizer !== 'function') {
      throw new Error('Sanitizer must be a function');
    }

    this.sanitizers.set(name, sanitizer);
    this.logger.info(`Added custom sanitizer: ${name}`);
  }

  // Validate with custom validator
  async validateCustom(data, validatorName, options = {}) {
    const validator = this.customValidators.get(validatorName);
    if (!validator) {
      throw new Error(`Custom validator '${validatorName}' not found`);
    }

    try {
      const result = await validator(data, options);
      this.logger.debug(
        `Custom validation successful for validator '${validatorName}'`
      );
      return result;
    } catch (error) {
      this.logger.warn(
        `Custom validation failed for validator '${validatorName}':`,
        error
      );
      throw error;
    }
  }

  // Validate LLM provider credentials
  async validateLLMCredentials(provider, credentials) {
    const providerSchemas = {
      openai: Joi.object({
        apiKey: Joi.string()
          .pattern(/^sk-[a-zA-Z0-9]{48}$/)
          .required(),
        organization: Joi.string().optional(),
      }),
      anthropic: Joi.object({
        apiKey: Joi.string()
          .pattern(/^sk-ant-[a-zA-Z0-9-]{95}$/)
          .required(),
      }),
      google: Joi.object({
        apiKey: Joi.string().min(10).required(),
        projectId: Joi.string().optional(),
      }),
      azure: Joi.object({
        apiKey: Joi.string().min(10).required(),
        endpoint: Joi.string().uri().required(),
        deploymentName: Joi.string().required(),
      }),
    };

    const schema = providerSchemas[provider];
    if (!schema) {
      throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    return await this.validate(credentials, null, { joiOptions: { schema } });
  }

  // Get validation summary
  getValidationSummary() {
    return {
      schemas: Array.from(this.schemas.keys()),
      customValidators: Array.from(this.customValidators.keys()),
      sanitizers: Array.from(this.sanitizers.keys()),
      timestamp: new Date().toISOString(),
    };
  }
}

// Custom validation error class
class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
    this.isValidationError = true;
  }
}

module.exports = { ComprehensiveValidator, ValidationError };
