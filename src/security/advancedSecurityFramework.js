/**
 * Advanced Security Framework - Comprehensive security layer
 * Generation 2: Enterprise-grade security with threat detection
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { Logger } = require('../utils/logger');

class AdvancedSecurityFramework {
  constructor(config = {}) {
    this.config = config;
    this.logger = new Logger({ service: 'SecurityFramework' });

    this.rateLimiters = new Map();
    this.threatPatterns = new Map();
    this.securityEvents = [];
    this.encryptionKey = config.encryptionKey || this.generateEncryptionKey();

    this.initializeThreatPatterns();
  }

  // Initialize known threat patterns
  initializeThreatPatterns() {
    this.threatPatterns.set('sql_injection', [
      /('|\\')|(;|%3b)|(--)|(%2d%2d)/i,
      /(union|select|insert|delete|update|drop|create|alter|exec|execute)/i,
    ]);

    this.threatPatterns.set('xss', [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
    ]);

    this.threatPatterns.set('path_traversal', [
      /\.\.[/\\]/g,
      /%2e%2e[/\\]/gi,
      /\.\.%2f/gi,
    ]);

    this.threatPatterns.set('command_injection', [
      /[|&;`$()]/g,
      /<%.*?%>/g,
      /\$\{.*?\}/g,
    ]);
  }

  // Create secure middleware stack
  createSecurityMiddleware() {
    return [
      helmet({
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
      }),
      this.createRateLimiter('global'),
      this.inputValidationMiddleware.bind(this),
      this.threatDetectionMiddleware.bind(this),
      this.auditMiddleware.bind(this),
    ];
  }

  // Advanced rate limiting with intelligent adaptation
  createRateLimiter(name, options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // requests per window
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: req => {
        return req.ip + ':' + (req.user?.id || 'anonymous');
      },
      skip: req => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/api/health';
      },
      onLimitReached: req => {
        this.logSecurityEvent('rate_limit_exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
        });
      },
    };

    const limiter = rateLimit({ ...defaultOptions, ...options });
    this.rateLimiters.set(name, limiter);
    return limiter;
  }

  // Input validation middleware
  async inputValidationMiddleware(req, res, next) {
    try {
      // Validate request size
      const maxSize = this.config.maxRequestSize || 10 * 1024 * 1024; // 10MB
      if (req.get('content-length') > maxSize) {
        this.logSecurityEvent('oversized_request', {
          ip: req.ip,
          size: req.get('content-length'),
          path: req.path,
        });
        return res.status(413).json({ error: 'Request too large' });
      }

      // Validate content type for POST/PUT requests
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return res.status(400).json({ error: 'Invalid content type' });
        }
      }

      // Validate headers
      const suspiciousHeaders = [
        'x-forwarded-for',
        'x-real-ip',
        'x-cluster-client-ip',
      ];
      for (const header of suspiciousHeaders) {
        const value = req.get(header);
        if (value && this.detectThreat(value)) {
          this.logSecurityEvent('malicious_header', {
            ip: req.ip,
            header,
            value,
            path: req.path,
          });
          return res.status(400).json({ error: 'Invalid request' });
        }
      }

      next();
    } catch (error) {
      this.logger.error('Input validation error:', error);
      res.status(500).json({ error: 'Validation error' });
    }
  }

  // Threat detection middleware
  async threatDetectionMiddleware(req, res, next) {
    try {
      const threats = [];

      // Check URL parameters
      for (const [key, value] of Object.entries(req.query)) {
        const threat = this.detectThreat(value);
        if (threat) {
          threats.push({ type: threat, location: 'query', key, value });
        }
      }

      // Check request body
      if (req.body) {
        const bodyThreats = this.scanObjectForThreats(req.body, 'body');
        threats.push(...bodyThreats);
      }

      // Check headers
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
          const threat = this.detectThreat(value);
          if (threat) {
            threats.push({ type: threat, location: 'header', key, value });
          }
        }
      }

      if (threats.length > 0) {
        this.logSecurityEvent('threat_detected', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
          threats,
        });

        // Block high-severity threats
        const highSeverityThreats = ['sql_injection', 'command_injection'];
        if (threats.some(t => highSeverityThreats.includes(t.type))) {
          return res
            .status(403)
            .json({ error: 'Request blocked for security reasons' });
        }
      }

      next();
    } catch (error) {
      this.logger.error('Threat detection error:', error);
      next();
    }
  }

  // Audit middleware
  async auditMiddleware(req, res, next) {
    const startTime = Date.now();

    // Log request
    this.logSecurityEvent('request', {
      ip: req.ip,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });

    // Override res.json to log responses
    const originalJson = res.json;
    res.json = function (data) {
      const duration = Date.now() - startTime;

      // Log response (without sensitive data)
      const responseLog = {
        ip: req.ip,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        timestamp: new Date().toISOString(),
      };

      if (res.statusCode >= 400) {
        responseLog.error = true;
        responseLog.errorMessage = data?.error || 'Unknown error';
      }

      // Don't log response data for security reasons
      this.logSecurityEvent('response', responseLog);

      return originalJson.call(this, data);
    }.bind(this);

    next();
  }

  // Detect threats in input
  detectThreat(input) {
    if (typeof input !== 'string') return null;

    for (const [threatType, patterns] of this.threatPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          return threatType;
        }
      }
    }

    return null;
  }

  // Recursively scan object for threats
  scanObjectForThreats(obj, location, path = '') {
    const threats = [];

    if (typeof obj === 'string') {
      const threat = this.detectThreat(obj);
      if (threat) {
        threats.push({ type: threat, location, path, value: obj });
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const itemThreats = this.scanObjectForThreats(
          item,
          location,
          `${path}[${index}]`
        );
        threats.push(...itemThreats);
      });
    } else if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        const keyPath = path ? `${path}.${key}` : key;
        const itemThreats = this.scanObjectForThreats(value, location, keyPath);
        threats.push(...itemThreats);
      }
    }

    return threats;
  }

  // Encrypt sensitive data
  encrypt(data) {
    try {
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      this.logger.error('Encryption error:', error);
      throw new Error('Encryption failed');
    }
  }

  // Decrypt sensitive data
  decrypt(encryptedData) {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      this.logger.error('Decryption error:', error);
      throw new Error('Decryption failed');
    }
  }

  // Hash sensitive data
  hash(data, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(16).toString('hex');
    }

    const hash = crypto
      .pbkdf2Sync(data, salt, 10000, 64, 'sha512')
      .toString('hex');
    return { hash, salt };
  }

  // Verify hashed data
  verifyHash(data, hash, salt) {
    const computed = this.hash(data, salt);
    return computed.hash === hash;
  }

  // Generate secure API keys
  generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Generate encryption key
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Log security events
  logSecurityEvent(type, data) {
    const event = {
      type,
      timestamp: new Date().toISOString(),
      data,
      id: crypto.randomBytes(8).toString('hex'),
    };

    this.securityEvents.push(event);

    // Keep only last 1000 events to prevent memory leaks
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    // Log to external system
    this.logger.info(`Security event: ${type}`, event);
  }

  // Get security metrics
  getSecurityMetrics() {
    const now = Date.now();
    const lastHour = now - 60 * 60 * 1000;

    const recentEvents = this.securityEvents.filter(
      event => new Date(event.timestamp).getTime() > lastHour
    );

    const eventsByType = recentEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});

    return {
      totalEvents: this.securityEvents.length,
      recentEvents: recentEvents.length,
      eventsByType,
      threatLevel: this.calculateThreatLevel(recentEvents),
      timestamp: new Date().toISOString(),
    };
  }

  // Calculate current threat level
  calculateThreatLevel(recentEvents) {
    const threatEvents = recentEvents.filter(event =>
      ['threat_detected', 'rate_limit_exceeded', 'malicious_header'].includes(
        event.type
      )
    );

    if (threatEvents.length === 0) return 'low';
    if (threatEvents.length < 10) return 'medium';
    return 'high';
  }

  // Get security status
  getSecurityStatus() {
    const metrics = this.getSecurityMetrics();

    return {
      status: metrics.threatLevel === 'high' ? 'alert' : 'normal',
      threatLevel: metrics.threatLevel,
      activeRateLimiters: this.rateLimiters.size,
      threatPatterns: this.threatPatterns.size,
      metrics,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { AdvancedSecurityFramework };
