/**
 * Global Error Handler Middleware
 * Centralized error handling with security and monitoring
 */

const { Logger } = require('../../utils/logger');
const { I18nManager } = require('../../quantum/i18nManager');
const { SecurityManager } = require('../../quantum/securityManager');

class GlobalErrorHandler {
  constructor(config = {}) {
    this.config = {
      enableStackTrace: process.env.NODE_ENV === 'development',
      enableDetailedErrors: process.env.NODE_ENV !== 'production',
      ...config,
    };

    this.logger = new Logger({ service: 'error-handler' });
    this.i18n = new I18nManager(config.i18n || {});
    this.security = new SecurityManager(config.security || {});
  }

  async initialize() {
    await this.i18n.initialize();
    await this.security.initialize();
    this.logger.info('Global Error Handler initialized');
  }

  /**
   * Express error handling middleware
   */
  middleware() {
    return async (error, req, res, next) => {
      try {
        // Security scan for potential attacks
        const securityThreat = await this.security.scanError(error, req);
        if (securityThreat.isBlocked) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Request blocked for security reasons',
            timestamp: new Date().toISOString(),
          });
        }

        // Classify error type
        const classification = this.classifyError(error);

        // Get user's preferred language
        const locale = req.headers['accept-language'] || 'en';

        // Log error with context
        this.logError(error, req, classification);

        // Build response
        const response = await this.buildErrorResponse(
          error,
          classification,
          locale
        );

        // Send response
        res.status(classification.status).json(response);
      } catch (handlerError) {
        this.logger.error('Error in error handler:', handlerError);

        // Fallback error response
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        });
      }
    };
  }

  classifyError(error) {
    // Validation errors
    if (error.name === 'ValidationError' || error.type === 'validation') {
      return {
        type: 'validation',
        status: 400,
        category: 'client',
        severity: 'low',
      };
    }

    // Authentication errors
    if (error.name === 'UnauthorizedError' || error.status === 401) {
      return {
        type: 'authentication',
        status: 401,
        category: 'client',
        severity: 'medium',
      };
    }

    // Authorization errors
    if (error.status === 403) {
      return {
        type: 'authorization',
        status: 403,
        category: 'client',
        severity: 'medium',
      };
    }

    // Not found errors
    if (error.status === 404) {
      return {
        type: 'not_found',
        status: 404,
        category: 'client',
        severity: 'low',
      };
    }

    // Rate limiting
    if (error.type === 'rate_limit' || error.status === 429) {
      return {
        type: 'rate_limit',
        status: 429,
        category: 'client',
        severity: 'medium',
      };
    }

    // Database errors
    if (
      error.code &&
      (error.code.startsWith('ER_') || error.code.includes('SQLITE'))
    ) {
      return {
        type: 'database',
        status: 500,
        category: 'server',
        severity: 'high',
      };
    }

    // Network/timeout errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return {
        type: 'network',
        status: 503,
        category: 'server',
        severity: 'high',
      };
    }

    // Quantum/neuromorphic system errors
    if (error.type === 'quantum' || error.type === 'neuromorphic') {
      return {
        type: error.type,
        status: 503,
        category: 'server',
        severity: 'high',
      };
    }

    // Default server error
    return {
      type: 'server',
      status: error.status || 500,
      category: 'server',
      severity: 'high',
    };
  }

  logError(error, req, classification) {
    const logData = {
      error: {
        name: error.name,
        message: error.message,
        type: classification.type,
        status: classification.status,
        severity: classification.severity,
      },
      request: {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        sessionId: req.session?.id,
        userId: req.user?.id,
      },
      timestamp: new Date().toISOString(),
    };

    // Add stack trace in development
    if (this.config.enableStackTrace) {
      logData.error.stack = error.stack;
    }

    // Log based on severity
    switch (classification.severity) {
      case 'high':
        this.logger.error('High severity error:', logData);
        break;
      case 'medium':
        this.logger.warn('Medium severity error:', logData);
        break;
      case 'low':
        this.logger.info('Low severity error:', logData);
        break;
      default:
        this.logger.error('Unknown severity error:', logData);
    }
  }

  async buildErrorResponse(error, classification, locale) {
    const response = {
      error: classification.type,
      timestamp: new Date().toISOString(),
    };

    // Get localized messages
    try {
      response.message = await this.i18n.translate(
        `error.${classification.type}.message`,
        locale,
        { defaultMessage: error.message }
      );

      response.description = await this.i18n.translate(
        `error.${classification.type}.description`,
        locale,
        { defaultMessage: 'An error occurred while processing your request' }
      );
    } catch (i18nError) {
      this.logger.warn('Failed to get localized error message:', i18nError);
      response.message = error.message;
      response.description = 'An error occurred while processing your request';
    }

    // Add helpful hints for client errors
    if (classification.category === 'client') {
      response.hint = await this.getErrorHint(classification.type, locale);
    }

    // Add technical details in development
    if (this.config.enableDetailedErrors) {
      response.details = {
        type: error.name,
        code: error.code,
        ...(error.validation && { validation: error.validation }),
      };

      if (this.config.enableStackTrace) {
        response.stack = error.stack;
      }
    }

    // Add request ID for tracking
    response.requestId = this.generateRequestId();

    return response;
  }

  async getErrorHint(errorType, locale) {
    const hints = {
      validation: 'Please check your input data and try again',
      authentication: 'Please check your credentials and try again',
      authorization: 'You do not have permission to access this resource',
      not_found: 'Please check the URL and try again',
      rate_limit: 'Please wait before making more requests',
    };

    try {
      return await this.i18n.translate(`error.${errorType}.hint`, locale, {
        defaultMessage: hints[errorType] || 'Please try again later',
      });
    } catch (error) {
      return hints[errorType] || 'Please try again later';
    }
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle unhandled promise rejections
   */
  handleUnhandledRejection(reason, promise) {
    this.logger.error('Unhandled promise rejection:', {
      reason,
      promise: promise.toString(),
      timestamp: new Date().toISOString(),
    });

    // In production, we might want to restart the process
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  /**
   * Handle uncaught exceptions
   */
  handleUncaughtException(error) {
    this.logger.error('Uncaught exception:', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      timestamp: new Date().toISOString(),
    });

    // Graceful shutdown
    process.exit(1);
  }
}

module.exports = { GlobalErrorHandler };
