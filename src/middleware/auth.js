/**
 * Authentication Middleware
 * Handles API authentication and authorization
 */

const { Logger } = require('../utils/logger');
const { Helpers } = require('../utils/helpers');

const logger = new Logger({ service: 'AuthMiddleware' });

// Simple API key authentication
function authMiddleware(req, res, next) {
    try {
        // Skip auth in development mode if no API key is configured
        if (process.env.NODE_ENV === 'development' && !process.env.API_KEY) {
            req.authenticated = true;
            req.authMethod = 'development';
            return next();
        }

        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'] || req.query.api_key;

        let token = null;
        let authMethod = null;

        // Check Bearer token
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
            authMethod = 'bearer';
        }
        // Check API key
        else if (apiKey) {
            token = apiKey;
            authMethod = 'api_key';
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Authentication required. Provide API key via Authorization header or x-api-key header.'
            });
        }

        // Validate token/API key
        const isValid = validateToken(token, authMethod);
        
        if (!isValid) {
            logger.warn('Invalid authentication attempt', {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                authMethod
            });
            
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Invalid authentication credentials'
            });
        }

        // Add authentication info to request
        req.authenticated = true;
        req.authMethod = authMethod;
        req.token = token;
        
        // Generate trace ID for request if not present
        if (!req.traceId) {
            req.traceId = Helpers.generateTraceId();
        }

        logger.debug('Request authenticated', {
            authMethod,
            traceId: req.traceId,
            ip: req.ip
        });

        next();
    } catch (error) {
        logger.error('Authentication middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Authentication failed'
        });
    }
}

// Optional authentication - allows unauthenticated requests but sets auth info if provided
function optionalAuthMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'] || req.query.api_key;

        let token = null;
        let authMethod = null;

        // Check Bearer token
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
            authMethod = 'bearer';
        }
        // Check API key
        else if (apiKey) {
            token = apiKey;
            authMethod = 'api_key';
        }

        if (token) {
            const isValid = validateToken(token, authMethod);
            if (isValid) {
                req.authenticated = true;
                req.authMethod = authMethod;
                req.token = token;
            } else {
                req.authenticated = false;
            }
        } else {
            req.authenticated = false;
        }

        // Generate trace ID for request
        if (!req.traceId) {
            req.traceId = Helpers.generateTraceId();
        }

        next();
    } catch (error) {
        logger.error('Optional authentication middleware error:', error);
        req.authenticated = false;
        if (!req.traceId) {
            req.traceId = Helpers.generateTraceId();
        }
        next();
    }
}

// Admin authentication - requires elevated privileges
function adminAuthMiddleware(req, res, next) {
    try {
        // First run standard auth
        authMiddleware(req, res, (err) => {
            if (err) return next(err);
            
            // Check if user has admin privileges
            const hasAdminAccess = checkAdminAccess(req.token, req.authMethod);
            
            if (!hasAdminAccess) {
                logger.warn('Admin access denied', {
                    authMethod: req.authMethod,
                    ip: req.ip,
                    traceId: req.traceId
                });
                
                return res.status(403).json({
                    success: false,
                    error: 'Forbidden',
                    message: 'Admin access required'
                });
            }

            req.isAdmin = true;
            next();
        });
    } catch (error) {
        logger.error('Admin authentication middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Authentication failed'
        });
    }
}

// Rate limiting middleware
function rateLimitMiddleware(windowMs = 15 * 60 * 1000, maxRequests = 100) {
    const rateLimiter = Helpers.createRateLimiter(maxRequests, windowMs);
    
    return (req, res, next) => {
        try {
            const key = req.ip || 'unknown';
            const allowed = rateLimiter(key);
            
            if (!allowed) {
                logger.warn('Rate limit exceeded', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    path: req.path
                });
                
                return res.status(429).json({
                    success: false,
                    error: 'Too Many Requests',
                    message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
                    retryAfter: Math.ceil(windowMs / 1000)
                });
            }
            
            next();
        } catch (error) {
            logger.error('Rate limit middleware error:', error);
            next(); // Allow request to continue on rate limit error
        }
    };
}

// Helper functions
function validateToken(token, authMethod) {
    try {
        if (authMethod === 'api_key') {
            // Simple API key validation
            const validApiKey = process.env.API_KEY;
            return validApiKey && token === validApiKey;
        }
        
        if (authMethod === 'bearer') {
            // JWT validation (simplified - in production, use proper JWT library)
            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                return false;
            }
            
            // In production, use proper JWT verification
            // For now, simple validation
            return token && token.length > 10;
        }
        
        return false;
    } catch (error) {
        logger.error('Token validation error:', error);
        return false;
    }
}

function checkAdminAccess(token, authMethod) {
    try {
        // Simple admin check - in production, check user roles/permissions
        const adminApiKey = process.env.ADMIN_API_KEY;
        
        if (authMethod === 'api_key' && adminApiKey) {
            return token === adminApiKey;
        }
        
        if (authMethod === 'bearer') {
            // In production, decode JWT and check roles
            return false; // Simplified for now
        }
        
        return false;
    } catch (error) {
        logger.error('Admin access check error:', error);
        return false;
    }
}

module.exports = {
    authMiddleware,
    optionalAuthMiddleware,
    adminAuthMiddleware,
    rateLimitMiddleware
};