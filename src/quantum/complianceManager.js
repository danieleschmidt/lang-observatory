/**
 * Compliance Manager for Quantum Task Planner
 * Handles GDPR, CCPA, PDPA and other privacy regulations
 */

const { Logger } = require('../utils/logger');
const crypto = require('crypto');

class QuantumComplianceManager {
  constructor(config = {}) {
    this.logger = new Logger({ component: 'QuantumComplianceManager' });
    this.config = config;

    // Supported compliance frameworks
    this.supportedFrameworks = [
      'GDPR', // General Data Protection Regulation (EU)
      'CCPA', // California Consumer Privacy Act (US)
      'PDPA', // Personal Data Protection Act (Singapore/Thailand)
      'LGPD', // Lei Geral de Proteção de Dados (Brazil)
      'PIPEDA', // Personal Information Protection and Electronic Documents Act (Canada)
      'SOX', // Sarbanes-Oxley Act (US)
      'HIPAA', // Health Insurance Portability and Accountability Act (US)
      'ISO27001', // Information Security Management
    ];

    // Active compliance frameworks
    this.activeFrameworks = config.frameworks || ['GDPR', 'CCPA'];

    // Data classification levels
    this.dataClassification = {
      PUBLIC: 0,
      INTERNAL: 1,
      CONFIDENTIAL: 2,
      RESTRICTED: 3,
      TOP_SECRET: 4,
    };

    // Data retention policies (in days)
    this.retentionPolicies = {
      GDPR: {
        user_data: 2555, // 7 years
        log_data: 1095, // 3 years
        metrics_data: 730, // 2 years
        audit_data: 2555, // 7 years
        anonymized_data: -1, // Indefinite
      },
      CCPA: {
        personal_data: 730, // 2 years
        usage_data: 365, // 1 year
        log_data: 1095, // 3 years
        business_data: 2555, // 7 years
      },
      HIPAA: {
        health_data: 2190, // 6 years
        audit_logs: 2190, // 6 years
        access_logs: 2190, // 6 years
      },
    };

    // Privacy rights handling
    this.privacyRights = {
      GDPR: [
        'access',
        'rectification',
        'erasure',
        'portability',
        'restriction',
        'objection',
      ],
      CCPA: ['know', 'delete', 'opt_out', 'non_discrimination'],
      PDPA: ['access', 'correction', 'deletion', 'portability'],
    };

    // Data processing records
    this.processingRecords = [];
    this.consentRecords = new Map();
    this.dataSubjects = new Map();
    this.privacyRequests = [];

    // Audit trail
    this.auditTrail = [];
    this.maxAuditEntries = config.maxAuditEntries || 50000;

    // Anonymization and pseudonymization
    this.anonymizationMethods = new Map([
      ['hash', this.hashAnonymize.bind(this)],
      ['tokenize', this.tokenizeData.bind(this)],
      ['generalize', this.generalizeData.bind(this)],
      ['suppress', this.suppressData.bind(this)],
      ['noise', this.addNoiseToData.bind(this)],
    ]);

    this.initialized = false;
  }

  async initialize() {
    try {
      this.logger.info('Initializing Quantum Compliance Manager...');

      // Validate active frameworks
      this.validateFrameworks();

      // Initialize compliance policies
      this.initializePolicies();

      // Set up data processing monitoring
      this.setupProcessingMonitoring();

      // Initialize audit logging
      this.initializeAuditLogging();

      this.initialized = true;
      this.logger.info(
        `Compliance Manager initialized with frameworks: ${this.activeFrameworks.join(', ')}`
      );

      return this;
    } catch (error) {
      this.logger.error('Failed to initialize Compliance Manager:', error);
      throw error;
    }
  }

  /**
   * Validate that active frameworks are supported
   */
  validateFrameworks() {
    for (const framework of this.activeFrameworks) {
      if (!this.supportedFrameworks.includes(framework)) {
        throw new Error(`Unsupported compliance framework: ${framework}`);
      }
    }
  }

  /**
   * Initialize compliance policies based on active frameworks
   */
  initializePolicies() {
    this.policies = {
      dataMinimization: this.activeFrameworks.includes('GDPR'),
      purposeLimitation: this.activeFrameworks.includes('GDPR'),
      storageMinimization:
        this.activeFrameworks.includes('GDPR') ||
        this.activeFrameworks.includes('CCPA'),
      transparencyRequirement: this.activeFrameworks.some(f =>
        ['GDPR', 'CCPA', 'PDPA'].includes(f)
      ),
      consentRequired: this.activeFrameworks.includes('GDPR'),
      rightToErasure:
        this.activeFrameworks.includes('GDPR') ||
        this.activeFrameworks.includes('CCPA'),
      dataPortability:
        this.activeFrameworks.includes('GDPR') ||
        this.activeFrameworks.includes('PDPA'),
      breachNotification: this.activeFrameworks.some(f =>
        ['GDPR', 'HIPAA'].includes(f)
      ),
      dataProtectionByDesign: this.activeFrameworks.includes('GDPR'),
      regularAudits: this.activeFrameworks.some(f =>
        ['SOX', 'HIPAA', 'ISO27001'].includes(f)
      ),
    };

    this.logger.info('Compliance policies initialized:', this.policies);
  }

  /**
   * Set up monitoring for data processing activities
   */
  setupProcessingMonitoring() {
    // This would typically integrate with the main system's monitoring
    this.processingMonitor = {
      trackingEnabled: true,
      retentionDays: Math.max(
        ...Object.values(this.retentionPolicies)
          .flatMap(Object.values)
          .filter(v => v > 0)
      ),
      alertThresholds: {
        unusualAccess: 100, // Alert if user accesses data >100 times/day
        bulkExport: 1000, // Alert if >1000 records exported
        afterHoursAccess: true, // Alert for access outside business hours
        geographicAnomalies: true, // Alert for access from unusual locations
      },
    };
  }

  /**
   * Initialize audit logging system
   */
  initializeAuditLogging() {
    this.auditConfig = {
      logLevel: 'detailed',
      retentionPeriod: 2555, // 7 years for most compliance frameworks
      encryptLogs: true,
      tamperProofing: true,
      realTimeAlerts: true,
    };
  }

  /**
   * Record data processing activity
   */
  recordProcessingActivity(activity) {
    const record = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      activity,
      userId: activity.userId,
      dataSubject: activity.dataSubject,
      dataCategories: activity.dataCategories || [],
      processingPurpose: activity.purpose,
      legalBasis: activity.legalBasis,
      dataClassification:
        activity.classification || this.dataClassification.INTERNAL,
      retentionPeriod: this.calculateRetentionPeriod(activity),
      crossBorderTransfer: activity.crossBorderTransfer || false,
      thirdPartySharing: activity.thirdPartySharing || false,
      automated: activity.automated || true,
    };

    // Add compliance-specific fields
    if (this.activeFrameworks.includes('GDPR')) {
      record.gdprLawfulBasis =
        activity.gdprLawfulBasis || 'legitimate_interest';
      record.dataProtectionImpact = this.assessDataProtectionImpact(activity);
    }

    if (this.activeFrameworks.includes('CCPA')) {
      record.ccpaCategory = activity.ccpaCategory || 'identifiers';
      record.businessPurpose = activity.businessPurpose || 'service_provision';
    }

    this.processingRecords.push(record);
    this.auditLog('PROCESSING_ACTIVITY', record);

    // Trigger compliance checks
    this.performComplianceChecks(record);

    return record.id;
  }

  /**
   * Handle privacy rights requests
   */
  async handlePrivacyRequest(request) {
    const requestId = this.generateId();

    this.auditLog('PRIVACY_REQUEST', {
      requestId,
      type: request.type,
      dataSubject: request.dataSubject,
      framework: request.framework || 'GDPR',
      timestamp: new Date().toISOString(),
    });

    try {
      let response = {};

      switch (request.type) {
        case 'access':
          response = await this.handleDataAccessRequest(request);
          break;
        case 'rectification':
        case 'correction':
          response = await this.handleDataCorrectionRequest(request);
          break;
        case 'erasure':
        case 'delete':
          response = await this.handleDataDeletionRequest(request);
          break;
        case 'portability':
          response = await this.handleDataPortabilityRequest(request);
          break;
        case 'restriction':
          response = await this.handleProcessingRestrictionRequest(request);
          break;
        case 'objection':
        case 'opt_out':
          response = await this.handleProcessingObjectionRequest(request);
          break;
        default:
          throw new Error(`Unsupported privacy request type: ${request.type}`);
      }

      this.auditLog('PRIVACY_REQUEST_COMPLETED', {
        requestId,
        success: true,
        responseSize: JSON.stringify(response).length,
      });

      return { requestId, success: true, data: response };
    } catch (error) {
      this.auditLog('PRIVACY_REQUEST_FAILED', {
        requestId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Handle data access request (GDPR Article 15, CCPA Right to Know)
   */
  async handleDataAccessRequest(request) {
    const dataSubject = request.dataSubject;
    const userProcessingRecords = this.processingRecords.filter(
      r => r.dataSubject === dataSubject
    );

    const response = {
      dataSubject,
      requestType: 'access',
      processedAt: new Date().toISOString(),
      data: {
        personalDataCategories: this.getPersonalDataCategories(dataSubject),
        processingPurposes: [
          ...new Set(userProcessingRecords.map(r => r.processingPurpose)),
        ],
        legalBasis: [...new Set(userProcessingRecords.map(r => r.legalBasis))],
        retentionPeriods: this.getRetentionPeriods(dataSubject),
        recipients: this.getDataRecipients(dataSubject),
        crossBorderTransfers: this.getCrossBorderTransfers(dataSubject),
        dataProtectionRights: this.getApplicableRights(
          request.framework || 'GDPR'
        ),
        contactDetails: this.getDataProtectionContactDetails(),
      },
    };

    // Anonymize or pseudonymize sensitive data in the response
    return this.anonymizeResponse(
      response,
      request.anonymizationLevel || 'partial'
    );
  }

  /**
   * Handle data deletion request (GDPR Right to Erasure, CCPA Right to Delete)
   */
  async handleDataDeletionRequest(request) {
    const dataSubject = request.dataSubject;

    // Check if deletion is legally permissible
    const deletionAssessment = this.assessDeletionPermissibility(request);

    if (!deletionAssessment.permitted) {
      return {
        success: false,
        reason: deletionAssessment.reason,
        legalBasis: deletionAssessment.legalBasis,
      };
    }

    // Perform soft delete (anonymization) or hard delete based on requirements
    const deletionMethod = request.hardDelete ? 'hard' : 'soft';
    const deletedRecords = await this.performDataDeletion(
      dataSubject,
      deletionMethod
    );

    return {
      success: true,
      deletionMethod,
      recordsAffected: deletedRecords.length,
      deletedAt: new Date().toISOString(),
      retentionExceptions: this.getRetentionExceptions(dataSubject),
    };
  }

  /**
   * Handle data portability request (GDPR Article 20)
   */
  async handleDataPortabilityRequest(request) {
    const dataSubject = request.dataSubject;
    const exportFormat = request.format || 'json';

    const portableData = this.extractPortableData(dataSubject);
    const formattedData = this.formatDataForPortability(
      portableData,
      exportFormat
    );

    return {
      dataSubject,
      format: exportFormat,
      exportedAt: new Date().toISOString(),
      dataSize: JSON.stringify(formattedData).length,
      data: formattedData,
      instructions: this.getPortabilityInstructions(exportFormat),
    };
  }

  /**
   * Anonymize or pseudonymize data
   */
  async anonymizeData(data, method = 'hash', options = {}) {
    const anonymizer = this.anonymizationMethods.get(method);

    if (!anonymizer) {
      throw new Error(`Unsupported anonymization method: ${method}`);
    }

    const result = await anonymizer(data, options);

    this.auditLog('DATA_ANONYMIZATION', {
      method,
      dataSize: JSON.stringify(data).length,
      success: true,
    });

    return result;
  }

  /**
   * Hash-based anonymization
   */
  hashAnonymize(data, options = {}) {
    const salt = options.salt || this.generateSalt();
    const algorithm = options.algorithm || 'sha256';

    if (typeof data === 'string') {
      return crypto
        .createHash(algorithm)
        .update(data + salt)
        .digest('hex');
    } else if (typeof data === 'object') {
      const anonymized = {};
      for (const [key, value] of Object.entries(data)) {
        if (options.excludeFields && options.excludeFields.includes(key)) {
          anonymized[key] = value;
        } else {
          anonymized[key] = this.hashAnonymize(value, options);
        }
      }
      return anonymized;
    }

    return data;
  }

  /**
   * Tokenization-based pseudonymization
   */
  tokenizeData(data, options = {}) {
    const tokenMap = options.tokenMap || new Map();

    if (typeof data === 'string') {
      if (!tokenMap.has(data)) {
        tokenMap.set(data, `TOKEN_${this.generateId()}`);
      }
      return tokenMap.get(data);
    } else if (typeof data === 'object') {
      const tokenized = {};
      for (const [key, value] of Object.entries(data)) {
        tokenized[key] = this.tokenizeData(value, { ...options, tokenMap });
      }
      return tokenized;
    }

    return data;
  }

  /**
   * Data generalization
   */
  generalizeData(data, options = {}) {
    if (typeof data === 'number') {
      const precision = options.precision || 10;
      return Math.floor(data / precision) * precision;
    } else if (
      typeof data === 'string' &&
      options.generalizationType === 'email'
    ) {
      return data.replace(/^[^@]+/, '***');
    } else if (
      typeof data === 'string' &&
      options.generalizationType === 'date'
    ) {
      const date = new Date(data);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    }

    return data;
  }

  /**
   * Data suppression
   */
  suppressData(data, options = {}) {
    const suppressionChar = options.char || '*';
    const retainChars = options.retainChars || 2;

    if (typeof data === 'string') {
      if (data.length <= retainChars * 2) {
        return suppressionChar.repeat(data.length);
      }
      const start = data.substring(0, retainChars);
      const end = data.substring(data.length - retainChars);
      const middle = suppressionChar.repeat(data.length - retainChars * 2);
      return start + middle + end;
    }

    return data;
  }

  /**
   * Add noise to numerical data
   */
  addNoiseToData(data, options = {}) {
    if (typeof data === 'number') {
      const noiseLevel = options.noiseLevel || 0.1;
      const noise = (Math.random() - 0.5) * 2 * noiseLevel * data;
      return data + noise;
    }

    return data;
  }

  /**
   * Assess data protection impact
   */
  assessDataProtectionImpact(activity) {
    let impactScore = 0;

    // High-risk processing activities
    if (activity.dataCategories.includes('special_category')) impactScore += 3;
    if (activity.automated) impactScore += 2;
    if (activity.crossBorderTransfer) impactScore += 2;
    if (activity.thirdPartySharing) impactScore += 2;
    if (activity.profiling) impactScore += 2;

    // Data volume
    const dataVolume = activity.dataVolume || 0;
    if (dataVolume > 10000) impactScore += 2;
    if (dataVolume > 100000) impactScore += 3;

    // Classification impact
    impactScore += activity.classification || 1;

    return {
      score: impactScore,
      level: impactScore >= 8 ? 'high' : impactScore >= 4 ? 'medium' : 'low',
      requiresDPIA: impactScore >= 6 && this.activeFrameworks.includes('GDPR'),
    };
  }

  /**
   * Perform compliance checks
   */
  performComplianceChecks(record) {
    const violations = [];

    // GDPR checks
    if (this.activeFrameworks.includes('GDPR')) {
      if (!record.gdprLawfulBasis) {
        violations.push('Missing GDPR lawful basis');
      }

      if (record.dataProtectionImpact.requiresDPIA && !record.dpiaCompleted) {
        violations.push('DPIA required but not completed');
      }

      if (
        record.crossBorderTransfer &&
        !record.adequacyDecision &&
        !record.appropriateSafeguards
      ) {
        violations.push('Cross-border transfer without adequate protection');
      }
    }

    // CCPA checks
    if (this.activeFrameworks.includes('CCPA')) {
      if (record.thirdPartySharing && !record.ccpaDisclosure) {
        violations.push('Third-party sharing without CCPA disclosure');
      }
    }

    // HIPAA checks
    if (this.activeFrameworks.includes('HIPAA')) {
      if (record.dataCategories.includes('health') && !record.hipaaCompliant) {
        violations.push('Health data processing not HIPAA compliant');
      }
    }

    // Log violations
    if (violations.length > 0) {
      this.auditLog('COMPLIANCE_VIOLATION', {
        recordId: record.id,
        violations,
        severity: 'high',
      });

      this.logger.error('Compliance violations detected:', violations);
    }
  }

  /**
   * Calculate retention period based on applicable frameworks
   */
  calculateRetentionPeriod(activity) {
    let maxRetention = 0;

    for (const framework of this.activeFrameworks) {
      const policies = this.retentionPolicies[framework];
      if (policies) {
        for (const [category, days] of Object.entries(policies)) {
          if (
            activity.dataCategories?.includes(category) &&
            days > maxRetention
          ) {
            maxRetention = days;
          }
        }
      }
    }

    return maxRetention || 1095; // Default 3 years
  }

  /**
   * Generate breach notification report
   */
  generateBreachReport(incident) {
    const breachId = this.generateId();

    const report = {
      breachId,
      detectedAt: incident.detectedAt || new Date().toISOString(),
      reportedAt: new Date().toISOString(),
      incident: {
        type: incident.type,
        severity: incident.severity,
        affectedRecords: incident.affectedRecords || 0,
        dataCategories: incident.dataCategories || [],
        cause: incident.cause,
        containmentActions: incident.containmentActions || [],
      },
      notifications: {
        supervisoryAuthority:
          this.generateSupervisoryAuthorityNotification(incident),
        dataSubjects: this.generateDataSubjectNotification(incident),
        timeline: this.calculateNotificationTimeline(incident),
      },
      riskAssessment: this.assessBreachRisk(incident),
      mitigationPlan: this.generateMitigationPlan(incident),
    };

    this.auditLog('BREACH_REPORT_GENERATED', {
      breachId,
      severity: incident.severity,
    });

    return report;
  }

  /**
   * Get compliance dashboard data
   */
  getComplianceDashboard() {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentProcessing = this.processingRecords.filter(
      r => new Date(r.timestamp) >= last30Days
    );

    return {
      frameworks: this.activeFrameworks,
      dataProcessing: {
        total: this.processingRecords.length,
        last30Days: recentProcessing.length,
        byPurpose: this.groupBy(recentProcessing, 'processingPurpose'),
        byClassification: this.groupBy(recentProcessing, 'dataClassification'),
      },
      privacyRequests: {
        total: this.privacyRequests.length,
        pending: this.privacyRequests.filter(req => req.status === 'pending')
          .length,
        avgResponseTime: this.calculateAverageResponseTime(),
      },
      dataRetention: {
        expiringSoon: Array.from(this.dataSubjects.values()).filter(subject => {
          const retentionDate = new Date(subject.retentionUntil);
          const warningDate = new Date();
          warningDate.setDate(warningDate.getDate() + 30);
          return retentionDate <= warningDate;
        }).length,
        deletionBacklog: Array.from(this.dataSubjects.values()).filter(
          subject => new Date(subject.retentionUntil) <= new Date()
        ).length,
      },
      auditTrail: {
        entries: this.auditTrail.length,
        recentAlerts: this.auditTrail.filter(entry => {
          const entryDate = new Date(entry.timestamp);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return entryDate >= sevenDaysAgo && entry.severity === 'alert';
        }).length,
        complianceScore: this.calculateComplianceScore(),
      },
      risks: {
        high: this.getHighRiskActivities(),
        dpiaRequired: this.getDPIARequiredActivities(),
        crossBorderTransfers: this.getCrossBorderTransferCount(),
      },
    };
  }

  /**
   * Helper methods
   */
  generateId() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateSalt() {
    return crypto.randomBytes(32).toString('hex');
  }

  auditLog(event, data) {
    const entry = {
      id: this.generateId(),
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    this.auditTrail.push(entry);

    // Maintain size limit
    if (this.auditTrail.length > this.maxAuditEntries) {
      this.auditTrail.shift();
    }

    // Log critical events
    const criticalEvents = [
      'BREACH_REPORT_GENERATED',
      'COMPLIANCE_VIOLATION',
      'PRIVACY_REQUEST_FAILED',
    ];
    if (criticalEvents.includes(event)) {
      this.logger.warn(`Critical compliance event: ${event}`, data);
    }
  }

  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key] || 'unknown';
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    }, {});
  }

  getApplicableRights(framework) {
    return this.privacyRights[framework] || [];
  }

  calculateComplianceScore() {
    // Simplified compliance scoring
    const totalActivities = this.processingRecords.length;
    const violationCount = this.auditTrail.filter(
      e => e.event === 'COMPLIANCE_VIOLATION'
    ).length;

    if (totalActivities === 0) return 100;

    const violationRate = violationCount / totalActivities;
    return Math.max(0, Math.round((1 - violationRate) * 100));
  }

  getHighRiskActivities() {
    return this.processingRecords.filter(
      r => r.dataProtectionImpact && r.dataProtectionImpact.level === 'high'
    ).length;
  }

  getDPIARequiredActivities() {
    return this.processingRecords.filter(
      r =>
        r.requiresDPIA === true ||
        (r.dataProtectionImpact && r.dataProtectionImpact.level === 'high') ||
        (r.dataCategories && r.dataCategories.includes('special_category'))
    ).length;
  }

  getCrossBorderTransferCount() {
    return this.processingRecords.filter(
      r =>
        r.crossBorderTransfer === true ||
        (r.dataLocation &&
          r.dataLocation.region !== r.processingLocation?.region)
    ).length;
  }

  /**
   * Shutdown compliance manager
   */
  async shutdown() {
    this.logger.info('Shutting down Quantum Compliance Manager...');

    // Generate final compliance report
    const finalReport = this.getComplianceDashboard();
    this.auditLog('COMPLIANCE_MANAGER_SHUTDOWN', finalReport);

    this.processingRecords = [];
    this.consentRecords.clear();
    this.dataSubjects.clear();

    this.initialized = false;
    this.logger.info('Quantum Compliance Manager shutdown complete');
  }

  /**
   * Calculate average response time for privacy requests
   */
  calculateAverageResponseTime() {
    const completedRequests = this.privacyRequests.filter(
      req => req.status === 'completed'
    );
    if (completedRequests.length === 0) return 0;

    const totalTime = completedRequests.reduce((sum, req) => {
      const responseTime =
        new Date(req.completedAt) - new Date(req.requestedAt);
      return sum + responseTime;
    }, 0);

    return totalTime / completedRequests.length / (1000 * 60 * 60 * 24); // Convert to days
  }
}

module.exports = { QuantumComplianceManager };
