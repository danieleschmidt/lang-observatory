/**
 * Security Enhancement Middleware
 * Provides additional security layers for the API
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { Logger } = require('../utils/logger');

const logger = new Logger({ service: 'SecurityMiddleware' });

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Rate limit exceeded',
      message,
      retryAfter: windowMs / 1000,
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(
        `Rate limit exceeded for IP: ${req.ip}, endpoint: ${req.path}`
      );
      res.status(429).json({
        error: 'Rate limit exceeded',
        message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
};

// API rate limiters
const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many API requests, please try again later'
);

const strictApiLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  20, // 20 requests per minute
  'Rate limit for sensitive operations exceeded'
);

// Metrics endpoint limiter
const metricsLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  30, // 30 requests per minute
  'Metrics endpoint rate limit exceeded'
);

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

// Input sanitization middleware
const inputSanitizer = (req, res, next) => {
  try {
    const sanitizeObject = obj => {
      if (typeof obj !== 'object' || obj === null) return obj;

      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          // Remove potentially dangerous characters
          sanitized[key] = value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    next();
  } catch (error) {
    logger.error('Input sanitization failed:', error);
    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid input format',
    });
  }
};

// Request size limiter
const requestSizeLimiter = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('content-length') || '0');
    const maxBytes =
      typeof maxSize === 'string'
        ? parseInt(maxSize.replace(/\D/g, '')) *
          (maxSize.includes('mb') ? 1024 * 1024 : 1024)
        : maxSize;

    if (contentLength > maxBytes) {
      logger.warn(
        `Request size limit exceeded: ${contentLength} bytes from IP: ${req.ip}`
      );
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request size exceeds limit of ${maxSize}`,
      });
    }

    next();
  };
};

// API key validation middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required',
    });
  }

  // Validate API key format (basic validation)
  if (!/^[a-zA-Z0-9_-]{32,}$/.test(apiKey)) {
    logger.warn(`Invalid API key format from IP: ${req.ip}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key format',
    });
  }

  // In production, validate against database/cache
  // For now, accept any properly formatted key
  req.apiKey = apiKey;
  next();
};

// CORS middleware with security
const corsConfig = (req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'localhost',
  ];
  const origin = req.headers.origin;

  if (origin && allowedOrigins.some(allowed => origin.includes(allowed))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-API-Key'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
};

// Security logging middleware
const securityLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length') || 0,
    };

    if (res.statusCode >= 400) {
      logger.warn('Security event - Client error:', logData);
    } else if (res.statusCode >= 500) {
      logger.error('Security event - Server error:', logData);
    } else {
      logger.debug('Request completed:', logData);
    }
  });

  next();
};

module.exports = {
  apiLimiter,
  strictApiLimiter,
  metricsLimiter,
  securityHeaders,
  inputSanitizer,
  requestSizeLimiter,
  validateApiKey,
  corsConfig,
  securityLogger,
};
