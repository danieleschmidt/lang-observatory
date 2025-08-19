/**
 * Advanced Security Manager
 * Implements comprehensive security patterns for production deployment
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');
const { Logger } = require('../utils/logger');

class AdvancedSecurityManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = new Logger({ component: 'AdvancedSecurityManager' });
    this.config = {
      encryption: {
        algorithm: 'aes-256-gcm',
        keyRotationInterval: 24 * 60 * 60 * 1000, // 24 hours
        ...config.encryption,
      },
      rateLimiting: {
        maxRequestsPerMinute: 1000,
        maxRequestsPerHour: 10000,
        burstLimit: 100,
        ...config.rateLimiting,
      },
      authentication: {
        tokenExpiry: 3600, // 1 hour
        refreshTokenExpiry: 7 * 24 * 3600, // 7 days
        maxFailedAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 minutes
        ...config.authentication,
      },
      compliance: {
        dataRetentionDays: 90,
        auditLogRetentionDays: 365,
        enableGDPRMode: true,
        enableCCPAMode: true,
        ...config.compliance,
      },
      ...config,
    };

    // Security state
    this.encryptionKeys = new Map();
    this.rateLimiters = new Map();
    this.failedAttempts = new Map();
    this.blacklistedIPs = new Set();
    this.activeTokens = new Map();
    this.auditLogs = [];
    this.securityMetrics = {
      totalRequests: 0,
      blockedRequests: 0,
      authenticatedRequests: 0,
      failedAuthentications: 0,
      encryptedOperations: 0,
      dataClassifications: new Map(),
    };

    this.initialized = false;
  }

  async initialize() {
    this.logger.info('Initializing Advanced Security Manager...');

    // Initialize encryption keys
    await this.initializeEncryption();

    // Setup rate limiting
    this.setupRateLimiting();

    // Setup audit logging
    this.setupAuditLogging();

    // Setup compliance monitoring
    this.setupComplianceMonitoring();

    // Start security monitoring
    this.startSecurityMonitoring();

    this.initialized = true;
    this.logger.info('Advanced Security Manager initialized successfully');

    return this;
  }

  async initializeEncryption() {
    // Generate master encryption key
    const masterKey = crypto.randomBytes(32);
    this.encryptionKeys.set('master', {
      key: masterKey,
      createdAt: Date.now(),
      algorithm: this.config.encryption.algorithm,
    });

    // Generate data classification keys
    const classifications = [
      'public',
      'internal',
      'confidential',
      'restricted',
    ];
    for (const classification of classifications) {
      const key = crypto.randomBytes(32);
      this.encryptionKeys.set(classification, {
        key,
        createdAt: Date.now(),
        algorithm: this.config.encryption.algorithm,
        classification,
      });
    }

    // Setup key rotation
    setInterval(() => {
      this.rotateEncryptionKeys();
    }, this.config.encryption.keyRotationInterval);

    this.logger.info('Encryption keys initialized with automatic rotation');
  }

  setupRateLimiting() {
    // Global rate limiter
    this.rateLimiters.set('global', {
      requests: new Map(),
      maxPerMinute: this.config.rateLimiting.maxRequestsPerMinute,
      maxPerHour: this.config.rateLimiting.maxRequestsPerHour,
      burstLimit: this.config.rateLimiting.burstLimit,
    });

    // Endpoint-specific rate limiters
    const endpoints = [
      { name: 'auth', maxPerMinute: 100, maxPerHour: 1000 },
      { name: 'llm-calls', maxPerMinute: 500, maxPerHour: 5000 },
      { name: 'metrics', maxPerMinute: 200, maxPerHour: 2000 },
      { name: 'traces', maxPerMinute: 1000, maxPerHour: 10000 },
    ];

    endpoints.forEach(endpoint => {
      this.rateLimiters.set(endpoint.name, {
        requests: new Map(),
        maxPerMinute: endpoint.maxPerMinute,
        maxPerHour: endpoint.maxPerHour,
        burstLimit: Math.min(endpoint.maxPerMinute / 10, 50),
      });
    });

    // Cleanup old rate limit entries every minute
    setInterval(() => {
      this.cleanupRateLimitEntries();
    }, 60000);
  }

  setupAuditLogging() {
    // Security events to audit
    const auditEvents = [
      'authentication_success',
      'authentication_failure',
      'authorization_failure',
      'data_access',
      'data_modification',
      'encryption_operation',
      'key_rotation',
      'rate_limit_exceeded',
      'security_policy_violation',
    ];

    auditEvents.forEach(event => {
      this.on(event, data => {
        this.recordAuditLog(event, data);
      });
    });

    // Cleanup old audit logs based on retention policy
    setInterval(
      () => {
        this.cleanupAuditLogs();
      },
      24 * 60 * 60 * 1000
    ); // Daily cleanup
  }

  setupComplianceMonitoring() {
    // GDPR compliance monitoring
    if (this.config.compliance.enableGDPRMode) {
      this.setupGDPRCompliance();
    }

    // CCPA compliance monitoring
    if (this.config.compliance.enableCCPAMode) {
      this.setupCCPACompliance();
    }

    // Data retention monitoring
    setInterval(
      () => {
        this.enforceDataRetention();
      },
      24 * 60 * 60 * 1000
    ); // Daily enforcement
  }

  startSecurityMonitoring() {
    // Monitor for suspicious patterns
    setInterval(
      () => {
        this.analyzeSuspiciousActivity();
      },
      5 * 60 * 1000
    ); // Every 5 minutes

    // Generate security reports
    setInterval(
      () => {
        this.generateSecurityReport();
      },
      60 * 60 * 1000
    ); // Hourly reports
  }

  // Data encryption methods
  encryptData(data, classification = 'internal') {
    if (!this.encryptionKeys.has(classification)) {
      throw new Error(`Unknown data classification: ${classification}`);
    }

    const keyInfo = this.encryptionKeys.get(classification);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(keyInfo.algorithm, keyInfo.key);
    cipher.setAAD(
      Buffer.from(JSON.stringify({ classification, timestamp: Date.now() }))
    );

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    this.securityMetrics.encryptedOperations++;
    this.emit('encryption_operation', {
      classification,
      size: encrypted.length,
    });

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      classification,
      algorithm: keyInfo.algorithm,
      timestamp: Date.now(),
    };
  }

  decryptData(encryptedData) {
    const { encrypted, iv, authTag, classification, algorithm } = encryptedData;

    if (!this.encryptionKeys.has(classification)) {
      throw new Error(
        `Cannot decrypt: Unknown classification ${classification}`
      );
    }

    const keyInfo = this.encryptionKeys.get(classification);
    const decipher = crypto.createDecipher(algorithm, keyInfo.key);
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    decipher.setAAD(
      Buffer.from(
        JSON.stringify({
          classification,
          timestamp: encryptedData.timestamp,
        })
      )
    );

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  // Authentication and authorization
  async authenticateRequest(credentials, context = {}) {
    const { identifier, token, ip } = credentials;
    this.securityMetrics.totalRequests++;

    try {
      // Check if IP is blacklisted
      if (this.blacklistedIPs.has(ip)) {
        throw new Error('IP address is blacklisted');
      }

      // Check rate limits
      if (!this.checkRateLimit(ip, 'auth')) {
        throw new Error('Rate limit exceeded');
      }

      // Validate token
      const tokenValidation = await this.validateToken(token);
      if (!tokenValidation.valid) {
        this.recordFailedAttempt(identifier, ip);
        throw new Error('Invalid token');
      }

      // Reset failed attempts on successful authentication
      this.failedAttempts.delete(identifier);
      this.securityMetrics.authenticatedRequests++;

      this.emit('authentication_success', {
        identifier,
        ip,
        timestamp: Date.now(),
        context,
      });

      return {
        authenticated: true,
        user: tokenValidation.user,
        permissions: tokenValidation.permissions,
        sessionId: tokenValidation.sessionId,
      };
    } catch (error) {
      this.securityMetrics.failedAuthentications++;
      this.emit('authentication_failure', {
        identifier,
        ip,
        error: error.message,
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  async validateToken(token) {
    // Simplified token validation (in production, use proper JWT validation)
    if (!this.activeTokens.has(token)) {
      return { valid: false, reason: 'Token not found' };
    }

    const tokenInfo = this.activeTokens.get(token);
    if (Date.now() > tokenInfo.expiresAt) {
      this.activeTokens.delete(token);
      return { valid: false, reason: 'Token expired' };
    }

    return {
      valid: true,
      user: tokenInfo.user,
      permissions: tokenInfo.permissions,
      sessionId: tokenInfo.sessionId,
    };
  }

  checkRateLimit(identifier, endpoint = 'global') {
    const limiter = this.rateLimiters.get(endpoint);
    if (!limiter) return true;

    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    // Get or initialize request history
    if (!limiter.requests.has(identifier)) {
      limiter.requests.set(identifier, []);
    }

    const requests = limiter.requests.get(identifier);

    // Remove old requests
    const recentRequests = requests.filter(time => time > oneHourAgo);
    limiter.requests.set(identifier, recentRequests);

    // Check limits
    const lastMinuteRequests = recentRequests.filter(
      time => time > oneMinuteAgo
    );
    const lastHourRequests = recentRequests;

    if (
      lastMinuteRequests.length >= limiter.maxPerMinute ||
      lastHourRequests.length >= limiter.maxPerHour
    ) {
      this.emit('rate_limit_exceeded', {
        identifier,
        endpoint,
        timestamp: now,
      });
      return false;
    }

    // Record this request
    recentRequests.push(now);
    return true;
  }

  recordFailedAttempt(identifier, ip) {
    const key = `${identifier}:${ip}`;
    const attempts = this.failedAttempts.get(key) || {
      count: 0,
      firstAttempt: Date.now(),
    };
    attempts.count++;
    attempts.lastAttempt = Date.now();

    this.failedAttempts.set(key, attempts);

    // Check if we should blacklist this IP
    if (attempts.count >= this.config.authentication.maxFailedAttempts) {
      this.blacklistedIPs.add(ip);
      this.logger.warn(
        `IP ${ip} blacklisted after ${attempts.count} failed attempts`
      );

      // Auto-remove from blacklist after lockout duration
      setTimeout(() => {
        this.blacklistedIPs.delete(ip);
        this.failedAttempts.delete(key);
        this.logger.info(`IP ${ip} removed from blacklist`);
      }, this.config.authentication.lockoutDuration);
    }
  }

  // Compliance methods
  setupGDPRCompliance() {
    this.gdprControls = {
      dataMinimization: true,
      consentTracking: new Map(),
      dataPortability: true,
      rightToErasure: true,
      privacyByDesign: true,
    };

    this.logger.info('GDPR compliance mode enabled');
  }

  setupCCPACompliance() {
    this.ccpaControls = {
      optOutMechanism: true,
      dataDisclosure: true,
      nonDiscrimination: true,
      privateRightOfAction: true,
    };

    this.logger.info('CCPA compliance mode enabled');
  }

  enforceDataRetention() {
    const retentionPeriod =
      this.config.compliance.dataRetentionDays * 24 * 60 * 60 * 1000;
    const auditRetentionPeriod =
      this.config.compliance.auditLogRetentionDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Clean up old audit logs
    this.auditLogs = this.auditLogs.filter(
      log => now - log.timestamp < auditRetentionPeriod
    );

    // Emit data retention event for external systems
    this.emit('data_retention_enforced', {
      retentionPeriod,
      timestamp: now,
    });
  }

  recordAuditLog(event, data) {
    const auditEntry = {
      event,
      data,
      timestamp: Date.now(),
      id: crypto.randomUUID(),
    };

    this.auditLogs.push(auditEntry);
    this.logger.info(`Audit log recorded: ${event}`, { id: auditEntry.id });
  }

  analyzeSuspiciousActivity() {
    // Analyze patterns in failed attempts, rate limits, etc.
    const suspiciousPatterns = [];

    // Check for repeated failed attempts from same IP
    for (const [key, attempts] of this.failedAttempts) {
      if (attempts.count > 3 && Date.now() - attempts.firstAttempt < 300000) {
        // 5 minutes
        suspiciousPatterns.push({
          type: 'repeated_failed_attempts',
          key,
          attempts: attempts.count,
          timeSpan: Date.now() - attempts.firstAttempt,
        });
      }
    }

    if (suspiciousPatterns.length > 0) {
      this.emit('suspicious_activity_detected', {
        patterns: suspiciousPatterns,
        timestamp: Date.now(),
      });
    }
  }

  generateSecurityReport() {
    const report = {
      timestamp: Date.now(),
      metrics: { ...this.securityMetrics },
      circuitBreakers: {
        total: this.rateLimiters.size,
        active: Array.from(this.rateLimiters.keys()),
      },
      threats: {
        blacklistedIPs: this.blacklistedIPs.size,
        failedAttempts: this.failedAttempts.size,
      },
      compliance: {
        gdprEnabled: !!this.gdprControls,
        ccpaEnabled: !!this.ccpaControls,
        auditLogCount: this.auditLogs.length,
      },
    };

    this.emit('security_report_generated', report);
    return report;
  }

  rotateEncryptionKeys() {
    const now = Date.now();

    for (const [classification, keyInfo] of this.encryptionKeys) {
      if (
        now - keyInfo.createdAt >
        this.config.encryption.keyRotationInterval
      ) {
        const newKey = crypto.randomBytes(32);
        this.encryptionKeys.set(classification, {
          key: newKey,
          createdAt: now,
          algorithm: keyInfo.algorithm,
          classification,
        });

        this.emit('key_rotation', { classification, timestamp: now });
        this.logger.info(
          `Encryption key rotated for classification: ${classification}`
        );
      }
    }
  }

  cleanupRateLimitEntries() {
    const oneHourAgo = Date.now() - 3600000;

    for (const [endpoint, limiter] of this.rateLimiters) {
      for (const [identifier, requests] of limiter.requests) {
        const recentRequests = requests.filter(time => time > oneHourAgo);
        if (recentRequests.length === 0) {
          limiter.requests.delete(identifier);
        } else {
          limiter.requests.set(identifier, recentRequests);
        }
      }
    }
  }

  cleanupAuditLogs() {
    const retentionPeriod =
      this.config.compliance.auditLogRetentionDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    this.auditLogs = this.auditLogs.filter(
      log => now - log.timestamp < retentionPeriod
    );
  }

  getSecurityMetrics() {
    return {
      ...this.securityMetrics,
      activeTokens: this.activeTokens.size,
      blacklistedIPs: this.blacklistedIPs.size,
      failedAttempts: this.failedAttempts.size,
      auditLogs: this.auditLogs.length,
      timestamp: Date.now(),
    };
  }

  async shutdown() {
    this.logger.info('Shutting down Advanced Security Manager...');

    // Clear sensitive data
    this.encryptionKeys.clear();
    this.activeTokens.clear();
    this.failedAttempts.clear();
    this.blacklistedIPs.clear();

    this.removeAllListeners();
    this.logger.info('Advanced Security Manager shutdown complete');
  }
}

module.exports = { AdvancedSecurityManager };
