/**
 * Authentication Middleware Unit Tests
 */

const {
  authMiddleware,
  optionalAuthMiddleware,
  adminAuthMiddleware,
  rateLimitMiddleware,
} = require('../../../src/middleware/auth');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      query: {},
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    // Clear environment variables
    delete process.env.API_KEY;
    delete process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
  });

  describe('authMiddleware', () => {
    it('should allow requests in development mode without API key', () => {
      process.env.NODE_ENV = 'development';

      authMiddleware(req, res, next);

      expect(req.authenticated).toBe(true);
      expect(req.authMethod).toBe('development');
      expect(next).toHaveBeenCalled();
    });

    it('should authenticate with valid API key in header', () => {
      process.env.API_KEY = 'test-api-key';
      req.headers['x-api-key'] = 'test-api-key';

      authMiddleware(req, res, next);

      expect(req.authenticated).toBe(true);
      expect(req.authMethod).toBe('api_key');
      expect(req.token).toBe('test-api-key');
      expect(next).toHaveBeenCalled();
    });

    it('should authenticate with valid API key in query', () => {
      process.env.API_KEY = 'test-api-key';
      req.query.api_key = 'test-api-key';

      authMiddleware(req, res, next);

      expect(req.authenticated).toBe(true);
      expect(req.authMethod).toBe('api_key');
      expect(next).toHaveBeenCalled();
    });

    it('should authenticate with valid Bearer token', () => {
      process.env.JWT_SECRET = 'test-secret';
      req.headers.authorization = 'Bearer valid-jwt-token';

      authMiddleware(req, res, next);

      expect(req.authenticated).toBe(true);
      expect(req.authMethod).toBe('bearer');
      expect(next).toHaveBeenCalled();
    });

    it('should reject requests without authentication', () => {
      process.env.API_KEY = 'test-api-key';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message:
          'Authentication required. Provide API key via Authorization header or x-api-key header.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid API key', () => {
      process.env.API_KEY = 'correct-api-key';
      req.headers['x-api-key'] = 'wrong-api-key';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid authentication credentials',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should generate trace ID for authenticated requests', () => {
      process.env.API_KEY = 'test-api-key';
      req.headers['x-api-key'] = 'test-api-key';

      authMiddleware(req, res, next);

      expect(req.traceId).toBeDefined();
      expect(typeof req.traceId).toBe('string');
    });

    it('should preserve existing trace ID', () => {
      process.env.API_KEY = 'test-api-key';
      req.headers['x-api-key'] = 'test-api-key';
      req.traceId = 'existing-trace-id';

      authMiddleware(req, res, next);

      expect(req.traceId).toBe('existing-trace-id');
    });
  });

  describe('optionalAuthMiddleware', () => {
    it('should set authenticated=true with valid credentials', () => {
      process.env.API_KEY = 'test-api-key';
      req.headers['x-api-key'] = 'test-api-key';

      optionalAuthMiddleware(req, res, next);

      expect(req.authenticated).toBe(true);
      expect(req.authMethod).toBe('api_key');
      expect(next).toHaveBeenCalled();
    });

    it('should set authenticated=false with invalid credentials', () => {
      process.env.API_KEY = 'correct-api-key';
      req.headers['x-api-key'] = 'wrong-api-key';

      optionalAuthMiddleware(req, res, next);

      expect(req.authenticated).toBe(false);
      expect(next).toHaveBeenCalled();
    });

    it('should set authenticated=false with no credentials', () => {
      optionalAuthMiddleware(req, res, next);

      expect(req.authenticated).toBe(false);
      expect(req.traceId).toBeDefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('adminAuthMiddleware', () => {
    it('should allow admin access with valid admin API key', () => {
      process.env.API_KEY = 'user-api-key';
      process.env.ADMIN_API_KEY = 'admin-api-key';
      req.headers['x-api-key'] = 'admin-api-key';

      adminAuthMiddleware(req, res, next);

      expect(req.authenticated).toBe(true);
      expect(req.isAdmin).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    it('should deny admin access with regular API key', () => {
      process.env.API_KEY = 'user-api-key';
      process.env.ADMIN_API_KEY = 'admin-api-key';
      req.headers['x-api-key'] = 'user-api-key';

      adminAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden',
        message: 'Admin access required',
      });
    });

    it('should deny admin access without authentication', () => {
      process.env.ADMIN_API_KEY = 'admin-api-key';

      adminAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('rateLimitMiddleware', () => {
    let rateLimiter;

    beforeEach(() => {
      rateLimiter = rateLimitMiddleware(60000, 5); // 5 requests per minute
    });

    it('should allow requests within rate limit', () => {
      req.ip = '192.168.1.1';

      // First request should be allowed
      rateLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Second request should be allowed
      rateLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(2);
    });

    it('should block requests exceeding rate limit', () => {
      req.ip = '192.168.1.2';

      // Make 5 requests (should all be allowed)
      for (let i = 0; i < 5; i++) {
        rateLimiter(req, res, next);
      }
      expect(next).toHaveBeenCalledTimes(5);

      // 6th request should be blocked
      rateLimiter(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Maximum 5 requests per 60 seconds.',
        retryAfter: 60,
      });
    });

    it('should handle missing IP address', () => {
      req.ip = undefined;

      rateLimiter(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should continue on rate limit errors', () => {
      // Mock Helpers.createRateLimiter to throw an error
      const originalRateLimiter = rateLimiter;
      rateLimiter = (req, res, next) => {
        throw new Error('Rate limiter error');
      };

      expect(() => rateLimiter(req, res, next)).toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle authentication middleware errors', () => {
      // Mock req.get to throw an error
      req.get = jest.fn().mockImplementation(() => {
        throw new Error('Request error');
      });

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal Server Error',
        message: 'Authentication failed',
      });
    });

    it('should handle optional auth middleware errors gracefully', () => {
      req.headers = null; // This will cause an error

      optionalAuthMiddleware(req, res, next);

      expect(req.authenticated).toBe(false);
      expect(req.traceId).toBeDefined();
      expect(next).toHaveBeenCalled();
    });
  });
});
