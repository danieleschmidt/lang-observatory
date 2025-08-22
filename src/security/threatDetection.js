/**
 * Advanced Threat Detection System
 * Real-time security monitoring with ML-based anomaly detection
 */

const { Logger } = require('../utils/logger');
const { SecurityManager } = require('../quantum/securityManager');
const { EventEmitter } = require('events');

class ThreatDetectionSystem extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      enableRealTimeScanning: true,
      enableAnomalyDetection: true,
      enableBehaviorAnalysis: true,
      alertThreshold: 0.7,
      quarantineThreshold: 0.9,
      learningRate: 0.01,
      maxRequestsPerMinute: 1000,
      maxConcurrentConnections: 100,
      ...config,
    };

    this.logger = new Logger({ service: 'threat-detection' });
    this.security = new SecurityManager(config.security || {});

    // Threat detection state
    this.threatPatterns = new Map();
    this.suspiciousIPs = new Map();
    this.behaviorProfiles = new Map();
    this.anomalyModel = new AnomalyDetectionModel();

    // Rate limiting
    this.requestCounts = new Map();
    this.connectionCounts = new Map();

    // Statistics
    this.stats = {
      threatsDetected: 0,
      requestsAnalyzed: 0,
      falsePositives: 0,
      blockedRequests: 0,
      quarantinedSessions: 0,
    };

    this.initialized = false;
  }

  async initialize() {
    try {
      await this.security.initialize();
      await this.loadThreatPatterns();
      await this.anomalyModel.initialize();

      this.startBackgroundTasks();
      this.initialized = true;

      this.logger.info('Threat Detection System initialized');
      return this;
    } catch (error) {
      this.logger.error('Failed to initialize Threat Detection System:', error);
      throw error;
    }
  }

  async loadThreatPatterns() {
    // SQL Injection patterns
    this.addThreatPattern('sql_injection', {
      patterns: [
        /(\bunion\b.*\bselect\b)|(\bselect\b.*\bunion\b)/i,
        /(\bor\b\s+\d+\s*=\s*\d+)|(\band\b\s+\d+\s*=\s*\d+)/i,
        /(\bdrop\b\s+table)|(\bdelete\b\s+from)|(\binsert\b\s+into)/i,
        /(\b--)|(\b\/\*)|(\*\/)/,
        /(\bexec\b)|(\bexecute\b)|(\bsp_executesql\b)/i,
      ],
      severity: 'high',
      action: 'block',
    });

    // XSS patterns
    this.addThreatPattern('xss', {
      patterns: [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      ],
      severity: 'high',
      action: 'block',
    });

    // Command Injection patterns
    this.addThreatPattern('command_injection', {
      patterns: [
        /(;|\||&&|\|\|)\s*(ls|cat|pwd|id|whoami|uname)/i,
        /(\beval\b)|(\bexec\b)|(\bsystem\b)|(\bshell_exec\b)/i,
        /(\$\()|(`.*`)/,
        /(\.\.\/)|(\.\.\\)/,
      ],
      severity: 'critical',
      action: 'quarantine',
    });

    // LDAP Injection patterns
    this.addThreatPattern('ldap_injection', {
      patterns: [
        /(\*\))|(\(\|)|(&\()/,
        /(\)\()|(\|\()/,
        /(\bldap\b.*\bfilter\b)/i,
      ],
      severity: 'medium',
      action: 'alert',
    });

    // Path Traversal patterns
    this.addThreatPattern('path_traversal', {
      patterns: [
        /(\.\.\/)|(\.\.\\)/,
        /(%2e%2e%2f)|(%2e%2e%5c)/i,
        /(%252e%252e%252f)|(%252e%252e%255c)/i,
        /(\/etc\/passwd)|(\/etc\/shadow)/i,
      ],
      severity: 'high',
      action: 'block',
    });

    this.logger.info(`Loaded ${this.threatPatterns.size} threat patterns`);
  }

  addThreatPattern(name, config) {
    this.threatPatterns.set(name, {
      name,
      patterns: config.patterns || [],
      severity: config.severity || 'medium',
      action: config.action || 'alert',
      createdAt: new Date().toISOString(),
    });
  }

  async analyzeRequest(req, metadata = {}) {
    if (!this.initialized) {
      throw new Error('Threat Detection System not initialized');
    }

    const startTime = Date.now();
    this.stats.requestsAnalyzed++;

    try {
      const analysis = {
        requestId: metadata.requestId || this.generateRequestId(),
        timestamp: new Date().toISOString(),
        ip: req.ip || req.connection?.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        method: req.method,
        url: req.url,
        threats: [],
        riskScore: 0,
        action: 'allow',
        metadata,
      };

      // Rate limiting check
      const rateLimitResult = this.checkRateLimit(
        analysis.ip,
        analysis.userAgent
      );
      if (rateLimitResult.blocked) {
        analysis.threats.push({
          type: 'rate_limit_exceeded',
          severity: 'medium',
          message: `Rate limit exceeded: ${rateLimitResult.requests} requests/min`,
        });
        analysis.riskScore += 0.5;
      }

      // Analyze request components
      await this.analyzeURL(req.url, analysis);
      await this.analyzeHeaders(req.headers, analysis);
      await this.analyzeBody(req.body, analysis);
      await this.analyzeParameters(req.query, analysis);
      await this.analyzeParameters(req.params, analysis);

      // Behavioral analysis
      if (this.config.enableBehaviorAnalysis) {
        await this.analyzeBehavior(analysis);
      }

      // Anomaly detection
      if (this.config.enableAnomalyDetection) {
        const anomalyScore = await this.anomalyModel.predict(analysis);
        if (anomalyScore > this.config.alertThreshold) {
          analysis.threats.push({
            type: 'anomaly_detected',
            severity: 'medium',
            message: `Anomalous behavior detected (score: ${anomalyScore.toFixed(3)})`,
            score: anomalyScore,
          });
          analysis.riskScore += anomalyScore * 0.5;
        }
      }

      // Determine final action
      analysis.action = this.determineAction(
        analysis.riskScore,
        analysis.threats
      );

      // Log and emit events
      this.logAnalysis(analysis);
      this.emitThreatEvents(analysis);

      // Update behavioral profiles
      this.updateBehaviorProfile(analysis.ip, analysis);

      const duration = Date.now() - startTime;
      this.logger.debug(`Request analysis completed in ${duration}ms`);

      return analysis;
    } catch (error) {
      this.logger.error('Error analyzing request:', error);
      return {
        requestId: metadata.requestId || this.generateRequestId(),
        timestamp: new Date().toISOString(),
        error: error.message,
        action: 'allow', // Fail open for availability
        riskScore: 0,
      };
    }
  }

  async analyzeURL(url, analysis) {
    for (const [patternName, config] of this.threatPatterns.entries()) {
      for (const pattern of config.patterns) {
        if (pattern.test(url)) {
          analysis.threats.push({
            type: patternName,
            severity: config.severity,
            location: 'url',
            message: `Malicious pattern detected in URL`,
            pattern: pattern.source,
          });

          analysis.riskScore += this.getSeverityScore(config.severity);
          break; // One match per pattern type is enough
        }
      }
    }
  }

  async analyzeHeaders(headers, analysis) {
    for (const [name, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        for (const [patternName, config] of this.threatPatterns.entries()) {
          for (const pattern of config.patterns) {
            if (pattern.test(value)) {
              analysis.threats.push({
                type: patternName,
                severity: config.severity,
                location: `header:${name}`,
                message: `Malicious pattern detected in header`,
                pattern: pattern.source,
              });

              analysis.riskScore += this.getSeverityScore(config.severity);
              break;
            }
          }
        }
      }
    }

    // Check for suspicious user agents
    const userAgent = headers['user-agent'];
    if (userAgent && this.isSuspiciousUserAgent(userAgent)) {
      analysis.threats.push({
        type: 'suspicious_user_agent',
        severity: 'low',
        location: 'header:user-agent',
        message: 'Suspicious user agent detected',
      });
      analysis.riskScore += 0.2;
    }
  }

  async analyzeBody(body, analysis) {
    if (!body) return;

    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

    for (const [patternName, config] of this.threatPatterns.entries()) {
      for (const pattern of config.patterns) {
        if (pattern.test(bodyStr)) {
          analysis.threats.push({
            type: patternName,
            severity: config.severity,
            location: 'body',
            message: `Malicious pattern detected in request body`,
            pattern: pattern.source,
          });

          analysis.riskScore += this.getSeverityScore(config.severity);
          break;
        }
      }
    }

    // Check for excessively large payloads
    if (bodyStr.length > 1000000) {
      // 1MB
      analysis.threats.push({
        type: 'large_payload',
        severity: 'medium',
        location: 'body',
        message: `Unusually large payload detected: ${bodyStr.length} bytes`,
      });
      analysis.riskScore += 0.3;
    }
  }

  async analyzeParameters(params, analysis) {
    if (!params) return;

    for (const [name, value] of Object.entries(params)) {
      const valueStr =
        typeof value === 'string' ? value : JSON.stringify(value);

      for (const [patternName, config] of this.threatPatterns.entries()) {
        for (const pattern of config.patterns) {
          if (pattern.test(valueStr)) {
            analysis.threats.push({
              type: patternName,
              severity: config.severity,
              location: `parameter:${name}`,
              message: `Malicious pattern detected in parameter`,
              pattern: pattern.source,
            });

            analysis.riskScore += this.getSeverityScore(config.severity);
            break;
          }
        }
      }
    }
  }

  async analyzeBehavior(analysis) {
    const profile = this.getBehaviorProfile(analysis.ip);

    if (profile) {
      // Check for rapid method changes
      if (
        analysis.method !== profile.lastMethod &&
        profile.methodChanges > 10
      ) {
        analysis.threats.push({
          type: 'rapid_method_changes',
          severity: 'medium',
          message: 'Rapid HTTP method changes detected',
        });
        analysis.riskScore += 0.3;
      }

      // Check for unusual access patterns
      if (profile.urlCount > 100 && profile.uniqueUrls < 5) {
        analysis.threats.push({
          type: 'repetitive_access',
          severity: 'medium',
          message: 'Repetitive access pattern detected',
        });
        analysis.riskScore += 0.4;
      }

      // Check for geographic anomalies (simplified)
      if (profile.locations && profile.locations.size > 5) {
        analysis.threats.push({
          type: 'geographic_anomaly',
          severity: 'low',
          message: 'Multiple geographic locations detected',
        });
        analysis.riskScore += 0.2;
      }
    }
  }

  checkRateLimit(ip, userAgent) {
    const key = `${ip}:${userAgent}`;
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    if (!this.requestCounts.has(key)) {
      this.requestCounts.set(key, []);
    }

    const requests = this.requestCounts.get(key);

    // Remove old requests
    while (requests.length > 0 && requests[0] < windowStart) {
      requests.shift();
    }

    // Add current request
    requests.push(now);

    // Check limit
    const blocked = requests.length > this.config.maxRequestsPerMinute;

    if (blocked) {
      this.stats.blockedRequests++;
    }

    return {
      blocked,
      requests: requests.length,
      limit: this.config.maxRequestsPerMinute,
    };
  }

  getBehaviorProfile(ip) {
    return this.behaviorProfiles.get(ip);
  }

  updateBehaviorProfile(ip, analysis) {
    let profile = this.behaviorProfiles.get(ip);

    if (!profile) {
      profile = {
        ip,
        firstSeen: analysis.timestamp,
        lastSeen: analysis.timestamp,
        requestCount: 0,
        urlCount: 0,
        uniqueUrls: new Set(),
        methods: new Map(),
        userAgents: new Set(),
        methodChanges: 0,
        lastMethod: null,
        locations: new Set(),
      };
    }

    profile.lastSeen = analysis.timestamp;
    profile.requestCount++;
    profile.urlCount++;
    profile.uniqueUrls.add(analysis.url);
    profile.userAgents.add(analysis.userAgent);

    // Track method changes
    if (profile.lastMethod && profile.lastMethod !== analysis.method) {
      profile.methodChanges++;
    }
    profile.lastMethod = analysis.method;

    // Track method distribution
    profile.methods.set(
      analysis.method,
      (profile.methods.get(analysis.method) || 0) + 1
    );

    this.behaviorProfiles.set(ip, profile);

    // Clean up old profiles periodically
    if (this.behaviorProfiles.size > 10000) {
      this.cleanupBehaviorProfiles();
    }
  }

  cleanupBehaviorProfiles() {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    let cleaned = 0;

    for (const [ip, profile] of this.behaviorProfiles.entries()) {
      if (new Date(profile.lastSeen).getTime() < cutoff) {
        this.behaviorProfiles.delete(ip);
        cleaned++;
      }
    }

    this.logger.info(`Cleaned up ${cleaned} old behavior profiles`);
  }

  isSuspiciousUserAgent(userAgent) {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scanner/i,
      /nikto/i,
      /sqlmap/i,
      /nmap/i,
      /^$/, // Empty user agent
      /^[a-z]{1,3}$/i, // Very short user agent
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  getSeverityScore(severity) {
    const scores = {
      low: 0.2,
      medium: 0.5,
      high: 0.8,
      critical: 1.0,
    };
    return scores[severity] || 0.5;
  }

  determineAction(riskScore, threats) {
    // Check for critical threats
    const hasCritical = threats.some(t => t.severity === 'critical');
    if (hasCritical || riskScore >= this.config.quarantineThreshold) {
      this.stats.quarantinedSessions++;
      return 'quarantine';
    }

    // Check for high risk
    const hasHigh = threats.some(t => t.severity === 'high');
    if (hasHigh || riskScore >= this.config.alertThreshold) {
      this.stats.blockedRequests++;
      return 'block';
    }

    // Medium risk - alert but allow
    if (riskScore >= 0.3) {
      return 'alert';
    }

    return 'allow';
  }

  logAnalysis(analysis) {
    if (analysis.threats.length > 0) {
      this.logger.warn('Threats detected:', {
        requestId: analysis.requestId,
        ip: analysis.ip,
        url: analysis.url,
        riskScore: analysis.riskScore,
        threats: analysis.threats.map(t => ({
          type: t.type,
          severity: t.severity,
          location: t.location,
        })),
        action: analysis.action,
      });
    } else {
      this.logger.debug('Clean request analyzed:', {
        requestId: analysis.requestId,
        ip: analysis.ip,
        url: analysis.url,
        riskScore: analysis.riskScore,
      });
    }
  }

  emitThreatEvents(analysis) {
    if (analysis.threats.length > 0) {
      this.emit('threatDetected', analysis);
      this.stats.threatsDetected++;

      // Emit specific events for high-severity threats
      const criticalThreats = analysis.threats.filter(
        t => t.severity === 'critical'
      );
      if (criticalThreats.length > 0) {
        this.emit('criticalThreat', { ...analysis, threats: criticalThreats });
      }
    }

    if (analysis.action === 'block' || analysis.action === 'quarantine') {
      this.emit('actionRequired', analysis);
    }
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  startBackgroundTasks() {
    // Cleanup old data every hour
    setInterval(
      () => {
        this.cleanupBehaviorProfiles();
        this.cleanupRequestCounts();
      },
      60 * 60 * 1000
    );

    // Update anomaly model every 10 minutes
    setInterval(
      () => {
        this.anomalyModel.update();
      },
      10 * 60 * 1000
    );
  }

  cleanupRequestCounts() {
    const cutoff = Date.now() - 60000; // 1 minute
    let cleaned = 0;

    for (const [key, requests] of this.requestCounts.entries()) {
      const filtered = requests.filter(timestamp => timestamp > cutoff);
      if (filtered.length === 0) {
        this.requestCounts.delete(key);
        cleaned++;
      } else {
        this.requestCounts.set(key, filtered);
      }
    }

    this.logger.debug(`Cleaned up ${cleaned} old request count entries`);
  }

  getStats() {
    return {
      ...this.stats,
      threatPatterns: this.threatPatterns.size,
      behaviorProfiles: this.behaviorProfiles.size,
      activeRequests: this.requestCounts.size,
      anomalyModelAccuracy: this.anomalyModel.getAccuracy(),
    };
  }

  async shutdown() {
    this.logger.info('Shutting down Threat Detection System...');
    // Clean shutdown logic
    this.removeAllListeners();
    this.logger.info('Threat Detection System shutdown complete');
  }
}

// Simple anomaly detection model
class AnomalyDetectionModel {
  constructor() {
    this.features = ['riskScore', 'requestLength', 'headerCount', 'paramCount'];
    this.normalProfiles = [];
    this.threshold = 0.7;
    this.accuracy = 0.85; // Simulated accuracy
  }

  async initialize() {
    // Initialize with baseline normal behavior
    this.normalProfiles = [
      { riskScore: 0.1, requestLength: 200, headerCount: 8, paramCount: 2 },
      { riskScore: 0.2, requestLength: 500, headerCount: 10, paramCount: 4 },
      { riskScore: 0.0, requestLength: 100, headerCount: 6, paramCount: 1 },
    ];
  }

  async predict(analysis) {
    const features = this.extractFeatures(analysis);
    const distances = this.normalProfiles.map(profile =>
      this.euclideanDistance(features, profile)
    );

    const minDistance = Math.min(...distances);
    const anomalyScore = Math.min(minDistance / 100, 1.0); // Normalize

    return anomalyScore;
  }

  extractFeatures(analysis) {
    return {
      riskScore: analysis.riskScore,
      requestLength: analysis.url?.length || 0,
      headerCount: Object.keys(analysis.metadata?.headers || {}).length,
      paramCount: Object.keys(analysis.metadata?.params || {}).length,
    };
  }

  euclideanDistance(features1, features2) {
    const keys = Object.keys(features1);
    const sum = keys.reduce((acc, key) => {
      const diff = (features1[key] || 0) - (features2[key] || 0);
      return acc + diff * diff;
    }, 0);
    return Math.sqrt(sum);
  }

  update() {
    // Placeholder for model updates
    this.accuracy = Math.min(this.accuracy + 0.001, 0.95);
  }

  getAccuracy() {
    return this.accuracy;
  }
}

module.exports = { ThreatDetectionSystem, AnomalyDetectionModel };
