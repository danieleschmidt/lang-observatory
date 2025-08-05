/**
 * Quantum Security Manager
 * Comprehensive security controls for quantum task planning operations
 */

const crypto = require('crypto');
const { Logger } = require('../utils/logger');

class QuantumSecurityManager {
    constructor(config = {}) {
        this.logger = new Logger({ component: 'QuantumSecurityManager' });
        this.config = config;
        
        // Security configuration
        this.encryptionKey = config.encryptionKey || this.generateEncryptionKey();
        this.saltRounds = config.saltRounds || 12;
        this.tokenExpiry = config.tokenExpiry || 3600000; // 1 hour
        this.maxRequestsPerMinute = config.maxRequestsPerMinute || 100;
        
        // Access control
        this.permissions = new Map([
            ['PLAN_TASKS', ['admin', 'planner', 'user']],
            ['EXECUTE_TASKS', ['admin', 'executor', 'user']],
            ['VIEW_METRICS', ['admin', 'viewer', 'user']],
            ['MODIFY_CONFIG', ['admin']],
            ['ACCESS_QUANTUM_STATE', ['admin', 'planner']],
            ['RESET_SYSTEM', ['admin']]
        ]);
        
        // Rate limiting
        this.rateLimitStore = new Map();
        this.blockedIPs = new Set();
        
        // Audit logging
        this.auditLog = [];
        this.maxAuditEntries = config.maxAuditEntries || 10000;
        
        // Session management
        this.activeSessions = new Map();
        this.sessionCleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 300000); // 5 minutes
        
        // Security metrics
        this.securityMetrics = {
            authenticationAttempts: 0,
            successfulAuthentications: 0,
            failedAuthentications: 0,
            authorizationChecks: 0,
            accessDeniedCount: 0,
            rateLimitViolations: 0,
            encryptionOperations: 0,
            auditEvents: 0
        };
    }

    /**
     * Generate authentication token for user session
     */
    async generateAuthToken(userId, role, permissions = []) {
        try {
            this.securityMetrics.authenticationAttempts++;
            
            const sessionId = this.generateSecureId();
            const tokenData = {
                userId: this.sanitizeUserId(userId),
                role: this.sanitizeRole(role),
                permissions: this.validatePermissions(permissions),
                sessionId,
                issuedAt: Date.now(),
                expiresAt: Date.now() + this.tokenExpiry,
                ipAddress: null // Set by middleware
            };
            
            // Encrypt token data
            const encryptedToken = this.encryptData(JSON.stringify(tokenData));
            
            // Store session
            this.activeSessions.set(sessionId, {
                ...tokenData,
                lastActivity: Date.now()
            });
            
            this.securityMetrics.successfulAuthentications++;
            this.auditEvent('AUTH_TOKEN_GENERATED', { userId, role, sessionId });
            
            return {
                token: encryptedToken,
                sessionId,
                expiresAt: tokenData.expiresAt
            };
            
        } catch (error) {
            this.securityMetrics.failedAuthentications++;
            this.logger.error('Token generation failed:', error);
            throw new Error('Authentication token generation failed');
        }
    }

    /**
     * Validate authentication token
     */
    async validateAuthToken(token, ipAddress = null) {
        try {
            if (!token || typeof token !== 'string') {
                this.auditEvent('AUTH_INVALID_TOKEN', { token: 'invalid_format', ipAddress });
                return { valid: false, reason: 'Invalid token format' };
            }

            // Decrypt token
            const decryptedData = this.decryptData(token);
            const tokenData = JSON.parse(decryptedData);
            
            // Check expiration
            if (Date.now() > tokenData.expiresAt) {
                this.auditEvent('AUTH_TOKEN_EXPIRED', { userId: tokenData.userId, sessionId: tokenData.sessionId });
                return { valid: false, reason: 'Token expired' };
            }
            
            // Validate session
            const session = this.activeSessions.get(tokenData.sessionId);
            if (!session) {
                this.auditEvent('AUTH_SESSION_NOT_FOUND', { sessionId: tokenData.sessionId });
                return { valid: false, reason: 'Session not found' };
            }
            
            // Update last activity
            session.lastActivity = Date.now();
            if (ipAddress) {
                session.ipAddress = ipAddress;
            }
            
            this.auditEvent('AUTH_TOKEN_VALIDATED', { 
                userId: tokenData.userId, 
                sessionId: tokenData.sessionId,
                ipAddress 
            });
            
            return {
                valid: true,
                user: {
                    userId: tokenData.userId,
                    role: tokenData.role,
                    permissions: tokenData.permissions,
                    sessionId: tokenData.sessionId
                }
            };
            
        } catch (error) {
            this.logger.error('Token validation failed:', error);
            this.auditEvent('AUTH_VALIDATION_ERROR', { error: error.message, ipAddress });
            return { valid: false, reason: 'Token validation failed' };
        }
    }

    /**
     * Check if user has required permission
     */
    async checkPermission(user, requiredPermission, resource = null) {
        this.securityMetrics.authorizationChecks++;
        
        try {
            if (!user || !user.role) {
                this.securityMetrics.accessDeniedCount++;
                this.auditEvent('AUTHZ_NO_USER', { requiredPermission, resource });
                return false;
            }

            // Check if role has permission
            const allowedRoles = this.permissions.get(requiredPermission) || [];
            const hasRolePermission = allowedRoles.includes(user.role);
            
            // Check explicit permissions
            const hasExplicitPermission = user.permissions && 
                                        user.permissions.includes(requiredPermission);
            
            const authorized = hasRolePermission || hasExplicitPermission;
            
            if (!authorized) {
                this.securityMetrics.accessDeniedCount++;
                this.auditEvent('AUTHZ_ACCESS_DENIED', {
                    userId: user.userId,
                    role: user.role,
                    requiredPermission,
                    resource
                });
            } else {
                this.auditEvent('AUTHZ_ACCESS_GRANTED', {
                    userId: user.userId,
                    role: user.role,
                    requiredPermission,
                    resource
                });
            }
            
            return authorized;
            
        } catch (error) {
            this.logger.error('Permission check failed:', error);
            this.securityMetrics.accessDeniedCount++;
            return false;
        }
    }

    /**
     * Apply rate limiting
     */
    async checkRateLimit(identifier, ipAddress = null) {
        const key = identifier || ipAddress || 'anonymous';
        const now = Date.now();
        const windowStart = now - 60000; // 1 minute window
        
        // Check if IP is blocked
        if (ipAddress && this.blockedIPs.has(ipAddress)) {
            this.auditEvent('RATE_LIMIT_BLOCKED_IP', { ipAddress, identifier });
            return { allowed: false, reason: 'IP address blocked' };
        }
        
        // Get or create rate limit entry
        if (!this.rateLimitStore.has(key)) {
            this.rateLimitStore.set(key, []);
        }
        
        const requests = this.rateLimitStore.get(key);
        
        // Remove old requests outside the window
        const recentRequests = requests.filter(timestamp => timestamp > windowStart);
        this.rateLimitStore.set(key, recentRequests);
        
        // Check if limit exceeded
        if (recentRequests.length >= this.maxRequestsPerMinute) {
            this.securityMetrics.rateLimitViolations++;
            this.auditEvent('RATE_LIMIT_EXCEEDED', { 
                identifier: key, 
                requestCount: recentRequests.length,
                ipAddress 
            });
            
            // Consider blocking IP after multiple violations
            if (ipAddress && recentRequests.length > this.maxRequestsPerMinute * 2) {
                this.blockedIPs.add(ipAddress);
                this.auditEvent('IP_BLOCKED', { ipAddress, reason: 'Rate limit violations' });
            }
            
            return { 
                allowed: false, 
                reason: 'Rate limit exceeded',
                retryAfter: 60 
            };
        }
        
        // Add current request
        recentRequests.push(now);
        
        return { 
            allowed: true, 
            remaining: this.maxRequestsPerMinute - recentRequests.length 
        };
    }

    /**
     * Encrypt sensitive data
     */
    encryptData(data) {
        try {
            this.securityMetrics.encryptionOperations++;
            
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
            
            let encrypted = cipher.update(data, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
            
        } catch (error) {
            this.logger.error('Encryption failed:', error);
            throw new Error('Data encryption failed');
        }
    }

    /**
     * Decrypt sensitive data
     */
    decryptData(encryptedData) {
        try {
            const parts = encryptedData.split(':');
            if (parts.length !== 3) {
                throw new Error('Invalid encrypted data format');
            }
            
            const iv = Buffer.from(parts[0], 'hex');
            const authTag = Buffer.from(parts[1], 'hex');
            const encrypted = parts[2];
            
            const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
            
        } catch (error) {
            this.logger.error('Decryption failed:', error);
            throw new Error('Data decryption failed');
        }
    }

    /**
     * Secure task planning data
     */
    async secureTaskData(tasks, user) {
        try {
            // Check if user has permission to access task data
            if (!await this.checkPermission(user, 'PLAN_TASKS')) {
                throw new Error('Insufficient permissions to access task data');
            }
            
            // Sanitize and validate task data
            const securedTasks = tasks.map(task => ({
                id: this.sanitizeString(task.id),
                priority: this.clampNumber(task.priority, 0, 1),
                estimatedDuration: this.clampNumber(task.estimatedDuration, 1, 86400),
                type: this.sanitizeString(task.type),
                complexity: this.sanitizeEnum(task.complexity, ['low', 'medium', 'high']),
                requiredResources: this.sanitizeArray(task.requiredResources, 'string'),
                dependencies: this.sanitizeArray(task.dependencies, 'string'),
                // Remove any potentially sensitive fields
                metadata: this.sanitizeMetadata(task.metadata || {})
            }));
            
            this.auditEvent('TASK_DATA_SECURED', { 
                userId: user.userId,
                taskCount: securedTasks.length 
            });
            
            return securedTasks;
            
        } catch (error) {
            this.logger.error('Task data security check failed:', error);
            throw error;
        }
    }

    /**
     * Secure quantum state data
     */
    async secureQuantumState(quantumState, user) {
        try {
            // Check permission for quantum state access
            if (!await this.checkPermission(user, 'ACCESS_QUANTUM_STATE')) {
                throw new Error('Insufficient permissions to access quantum state');
            }
            
            // Create sanitized copy of quantum state
            const securedState = {
                coherence: this.clampNumber(quantumState.coherence, 0, 1),
                superpositionStates: quantumState.superposition ? quantumState.superposition.size : 0,
                entanglementPairs: quantumState.entanglement ? quantumState.entanglement.size : 0,
                // Don't expose actual quantum data details
                timestamp: new Date().toISOString()
            };
            
            this.auditEvent('QUANTUM_STATE_ACCESSED', { 
                userId: user.userId,
                coherence: securedState.coherence 
            });
            
            return securedState;
            
        } catch (error) {
            this.logger.error('Quantum state security check failed:', error);
            throw error;
        }
    }

    /**
     * Audit event logging
     */
    auditEvent(eventType, details = {}) {
        this.securityMetrics.auditEvents++;
        
        const auditEntry = {
            timestamp: new Date().toISOString(),
            eventType,
            details: this.sanitizeAuditDetails(details),
            id: this.generateSecureId()
        };
        
        this.auditLog.push(auditEntry);
        
        // Maintain audit log size
        if (this.auditLog.length > this.maxAuditEntries) {
            this.auditLog.shift();
        }
        
        // Log security-critical events
        const criticalEvents = [
            'AUTH_TOKEN_GENERATED', 'AUTHZ_ACCESS_DENIED', 'RATE_LIMIT_EXCEEDED', 
            'IP_BLOCKED', 'SECURITY_VIOLATION'
        ];
        
        if (criticalEvents.includes(eventType)) {
            this.logger.warn(`Security event: ${eventType}`, details);
        }
    }

    /**
     * Get security audit log
     */
    async getAuditLog(user, filters = {}) {
        if (!await this.checkPermission(user, 'VIEW_METRICS')) {
            throw new Error('Insufficient permissions to view audit log');
        }
        
        let filteredLog = [...this.auditLog];
        
        // Apply filters
        if (filters.eventType) {
            filteredLog = filteredLog.filter(entry => entry.eventType === filters.eventType);
        }
        
        if (filters.userId) {
            filteredLog = filteredLog.filter(entry => 
                entry.details.userId === filters.userId);
        }
        
        if (filters.since) {
            const sinceDate = new Date(filters.since);
            filteredLog = filteredLog.filter(entry => 
                new Date(entry.timestamp) >= sinceDate);
        }
        
        // Limit results
        const limit = Math.min(filters.limit || 100, 1000);
        
        return {
            entries: filteredLog.slice(-limit),
            total: filteredLog.length,
            filtered: filteredLog.length !== this.auditLog.length
        };
    }

    /**
     * Helper methods for sanitization
     */
    sanitizeUserId(userId) {
        return String(userId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
    }

    sanitizeRole(role) {
        const validRoles = ['admin', 'planner', 'executor', 'viewer', 'user'];
        return validRoles.includes(role) ? role : 'user';
    }

    validatePermissions(permissions) {
        if (!Array.isArray(permissions)) return [];
        
        const validPermissions = Array.from(this.permissions.keys());
        return permissions.filter(p => validPermissions.includes(p));
    }

    sanitizeString(str) {
        return String(str || '').replace(/[<>\"'&]/g, '').substring(0, 100);
    }

    sanitizeEnum(value, validValues) {
        return validValues.includes(value) ? value : validValues[0];
    }

    clampNumber(value, min, max) {
        const num = Number(value) || 0;
        return Math.max(min, Math.min(max, num));
    }

    sanitizeArray(arr, expectedType) {
        if (!Array.isArray(arr)) return [];
        
        return arr
            .filter(item => typeof item === expectedType)
            .map(item => expectedType === 'string' ? this.sanitizeString(item) : item)
            .slice(0, 20);
    }

    sanitizeMetadata(metadata) {
        if (!metadata || typeof metadata !== 'object') return {};
        
        const sanitized = {};
        const allowedFields = ['description', 'category', 'tags'];
        
        for (const field of allowedFields) {
            if (metadata[field]) {
                sanitized[field] = this.sanitizeString(metadata[field]);
            }
        }
        
        return sanitized;
    }

    sanitizeAuditDetails(details) {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(details)) {
            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeString(value);
            } else if (typeof value === 'number') {
                sanitized[key] = this.clampNumber(value, -999999, 999999);
            } else if (typeof value === 'boolean') {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }

    /**
     * Generate secure identifiers
     */
    generateSecureId() {
        return crypto.randomBytes(16).toString('hex');
    }

    generateEncryptionKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Session management
     */
    async revokeSession(sessionId, user) {
        if (!await this.checkPermission(user, 'MODIFY_CONFIG') && 
            user.sessionId !== sessionId) {
            throw new Error('Insufficient permissions to revoke session');
        }
        
        this.activeSessions.delete(sessionId);
        this.auditEvent('SESSION_REVOKED', { 
            sessionId, 
            revokedBy: user.userId 
        });
    }

    cleanupExpiredSessions() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [sessionId, session] of this.activeSessions.entries()) {
            if (now > session.expiresAt || 
                (now - session.lastActivity) > (this.tokenExpiry * 2)) {
                this.activeSessions.delete(sessionId);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            this.logger.info(`Cleaned up ${cleanedCount} expired sessions`);
        }
    }

    /**
     * Get security metrics
     */
    getSecurityMetrics(user) {
        return {
            ...this.securityMetrics,
            activeSessions: this.activeSessions.size,
            blockedIPs: this.blockedIPs.size,
            auditLogSize: this.auditLog.length,
            rateLimitEntries: this.rateLimitStore.size,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Shutdown security manager
     */
    async shutdown() {
        this.logger.info('Shutting down Quantum Security Manager...');
        
        if (this.sessionCleanupInterval) {
            clearInterval(this.sessionCleanupInterval);
        }
        
        // Clear sensitive data
        this.activeSessions.clear();
        this.rateLimitStore.clear();
        this.blockedIPs.clear();
        
        this.logger.info('Quantum Security Manager shutdown complete');
    }
}

module.exports = { QuantumSecurityManager };