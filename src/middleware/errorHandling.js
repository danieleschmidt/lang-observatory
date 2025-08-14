/**
 * Enhanced Error Handling Middleware
 * Provides comprehensive error handling with logging and monitoring
 */

const { Logger } = require('../utils/logger');
const { MetricsManager } = require('../services/metricsService');

const logger = new Logger({ service: 'ErrorHandler' });
const metrics = new MetricsManager();

// Custom error classes
class ValidationError extends Error {
  constructor(message, field = null, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.field = field;
    this.code = code;
  }
}

class AuthenticationError extends Error {
  constructor(message = 'Authentication failed', code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
    this.code = code;
  }
}

class AuthorizationError extends Error {
  constructor(message = 'Insufficient permissions', code = 'AUTHZ_ERROR') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
    this.code = code;
  }
}

class ResourceNotFoundError extends Error {
  constructor(resource = 'Resource', id = null, code = 'NOT_FOUND') {
    super(`${resource}${id ? ` with ID ${id}` : ''} not found`);
    this.name = 'ResourceNotFoundError';
    this.statusCode = 404;
    this.resource = resource;
    this.resourceId = id;
    this.code = code;
  }
}

class ConflictError extends Error {
  constructor(message = 'Resource conflict', code = 'CONFLICT') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
    this.code = code;
  }
}

class RateLimitError extends Error {
  constructor(
    message = 'Rate limit exceeded',
    retryAfter = 60,
    code = 'RATE_LIMIT'
  ) {
    super(message);
    this.name = 'RateLimitError';
    this.statusCode = 429;
    this.retryAfter = retryAfter;
    this.code = code;
  }
}

class ServiceUnavailableError extends Error {
  constructor(
    service = 'Service',
    message = null,
    code = 'SERVICE_UNAVAILABLE'
  ) {
    super(message || `${service} is currently unavailable`);
    this.name = 'ServiceUnavailableError';
    this.statusCode = 503;
    this.service = service;
    this.code = code;
  }
}

// Error response formatter
const formatErrorResponse = (error, req) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorId = generateErrorId();

  const baseResponse = {
    error: error.name || 'Error',
    message: error.message || 'An error occurred',
    errorId,
    timestamp: new Date().toISOString(),
    path: req?.path,
    method: req?.method,
  };

  // Add specific error fields
  if (error.field) baseResponse.field = error.field;
  if (error.code) baseResponse.code = error.code;
  if (error.resource) baseResponse.resource = error.resource;
  if (error.resourceId) baseResponse.resourceId = error.resourceId;
  if (error.retryAfter) baseResponse.retryAfter = error.retryAfter;
  if (error.service) baseResponse.service = error.service;

  // Add stack trace in development
  if (isDevelopment && error.stack) {
    baseResponse.stack = error.stack;
  }

  return baseResponse;
};

// Generate unique error ID for tracking
const generateErrorId = () => {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Log error with context
const logError = (error, req, res, errorId) => {
  const logContext = {
    errorId,
    name: error.name,
    message: error.message,
    statusCode: error.statusCode || 500,
    method: req?.method,
    path: req?.path,
    ip: req?.ip,
    userAgent: req?.get?.('User-Agent'),
    userId: req?.user?.id,
    sessionId: req?.sessionId,
    traceId: req?.traceId,
    stack: error.stack,
  };

  if (error.statusCode >= 500) {
    logger.error('Server error occurred:', logContext);
  } else if (error.statusCode >= 400) {
    logger.warn('Client error occurred:', logContext);
  } else {
    logger.info('Error handled:', logContext);
  }

  // Record error metrics
  if (metrics.initialized) {
    metrics.recordCustomMetric('errors_by_type', 1, 'counter', {
      error_type: error.name,
      status_code: error.statusCode || 500,
      path: req?.path || 'unknown',
    });
  }
};

// Async error handler wrapper
const asyncHandler = fn => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Main error handling middleware
const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const errorResponse = formatErrorResponse(error, req);
  const statusCode = error.statusCode || 500;

  logError(error, req, res, errorResponse.errorId);

  // Set response headers
  res.status(statusCode);

  if (error instanceof RateLimitError) {
    res.set('Retry-After', error.retryAfter);
  }

  // Send error response
  res.json(errorResponse);
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const error = new ResourceNotFoundError('Endpoint', req.path);
  next(error);
};

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', {
    reason: reason?.toString(),
    stack: reason?.stack,
    promise: promise?.toString(),
  });

  // Don't exit in production, log and continue
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Uncaught exception handler
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });

  // Exit gracefully
  process.exit(1);
});

// Graceful shutdown handler
const gracefulShutdown = signal => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Close server connections, cleanup resources
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = {
  // Error classes
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ResourceNotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,

  // Middleware
  errorHandler,
  notFoundHandler,
  asyncHandler,

  // Utilities
  formatErrorResponse,
  generateErrorId,
  logError,
};
