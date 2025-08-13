/**
 * Security Validation Tests
 * Comprehensive security testing for the Lang Observatory
 */

const { ThreatDetectionSystem } = require('../../src/security/threatDetection');
const { SchemaValidator } = require('../../src/validation/schemaValidator');
const { SecurityManager } = require('../../src/quantum/securityManager');

describe('Security Validation Tests', () => {
  let threatDetection;
  let schemaValidator;
  let securityManager;

  beforeAll(async () => {
    threatDetection = new ThreatDetectionSystem({
      alertThreshold: 0.5,
      quarantineThreshold: 0.8,
    });

    schemaValidator = new SchemaValidator({
      strictMode: true,
      enableSanitization: true,
    });

    securityManager = new SecurityManager({
      enableEncryption: true,
      enableInputValidation: true,
    });

    await threatDetection.initialize();
    await schemaValidator.initialize();
    await securityManager.initialize();
  });

  afterAll(async () => {
    if (threatDetection) await threatDetection.shutdown();
    if (securityManager) await securityManager.shutdown();
  });

  describe('SQL Injection Detection', () => {
    test('should detect SQL injection attempts', async () => {
      const maliciousRequest = {
        method: 'POST',
        url: '/api/search',
        body: { query: "'; DROP TABLE users; --" },
        headers: { 'user-agent': 'test' },
        ip: '192.168.1.1',
      };

      const analysis = await threatDetection.analyzeRequest(maliciousRequest);

      expect(analysis.threats.length).toBeGreaterThan(0);
      expect(analysis.threats.some(t => t.type === 'sql_injection')).toBe(true);
      expect(analysis.riskScore).toBeGreaterThan(0.5);
      expect(analysis.action).toBe('block');
    });

    test('should allow legitimate database queries', async () => {
      const legitimateRequest = {
        method: 'GET',
        url: '/api/users?name=john',
        headers: { 'user-agent': 'Mozilla/5.0' },
        ip: '192.168.1.1',
      };

      const analysis = await threatDetection.analyzeRequest(legitimateRequest);

      expect(analysis.action).toBe('allow');
      expect(analysis.riskScore).toBeLessThan(0.3);
    });
  });

  describe('XSS Protection', () => {
    test('should detect XSS attempts', async () => {
      const xssRequest = {
        method: 'POST',
        url: '/api/comments',
        body: {
          content: '<script>alert("xss")</script>',
          user: 'attacker',
        },
        headers: { 'user-agent': 'test' },
        ip: '10.0.0.1',
      };

      const analysis = await threatDetection.analyzeRequest(xssRequest);

      expect(analysis.threats.some(t => t.type === 'xss')).toBe(true);
      expect(analysis.action).toBe('block');
    });

    test('should sanitize XSS payloads', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>',
        description: 'onclick="alert(1)"',
      };

      const result = await schemaValidator.validate(
        'test-schema',
        maliciousData,
        {
          sanitize: true,
        }
      );

      expect(result.data.name).not.toContain('<script>');
      expect(result.data.description).not.toContain('onclick');
    });
  });

  describe('Command Injection Protection', () => {
    test('should detect command injection attempts', async () => {
      const cmdInjectionRequest = {
        method: 'POST',
        url: '/api/system',
        body: { command: 'ls; cat /etc/passwd' },
        headers: { 'user-agent': 'curl/7.68.0' },
        ip: '172.16.0.1',
      };

      const analysis =
        await threatDetection.analyzeRequest(cmdInjectionRequest);

      expect(analysis.threats.some(t => t.type === 'command_injection')).toBe(
        true
      );
      expect(analysis.action).toBe('quarantine');
    });
  });

  describe('Rate Limiting', () => {
    test('should detect rate limit violations', async () => {
      const ip = '203.0.113.1';
      const userAgent = 'test-client';

      // Simulate rapid requests
      const requests = [];
      for (let i = 0; i < 50; i++) {
        requests.push(
          threatDetection.analyzeRequest({
            method: 'GET',
            url: '/api/data',
            headers: { 'user-agent': userAgent },
            ip: ip,
          })
        );
      }

      const results = await Promise.all(requests);

      // Some requests should be rate limited
      const rateLimited = results.filter(r =>
        r.threats.some(t => t.type === 'rate_limit_exceeded')
      );

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation', () => {
    test('should validate schema compliance', async () => {
      const validData = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        input: 'Hello world',
        output: 'Hello! How can I help you?',
      };

      const result = await schemaValidator.validate('llm-call', validData);
      expect(result.valid).toBe(true);
    });

    test('should reject invalid schema data', async () => {
      const invalidData = {
        provider: '', // Empty string
        model: 'x'.repeat(200), // Too long
        input: 'test',
        // Missing required output field
      };

      await expect(
        schemaValidator.validate('llm-call', invalidData)
      ).rejects.toThrow();
    });

    test('should validate nested objects', async () => {
      const nestedData = {
        provider: 'test',
        model: 'test',
        input: 'test',
        output: 'test',
        metadata: {
          nested: {
            value: 'safe value',
          },
        },
      };

      const result = await schemaValidator.validate('llm-call', nestedData);
      expect(result.valid).toBe(true);
    });
  });

  describe('Data Security', () => {
    test('should encrypt sensitive data', async () => {
      const sensitiveData = 'user-secret-token-12345';

      const encrypted = await securityManager.encrypt(sensitiveData);
      expect(encrypted).not.toBe(sensitiveData);
      expect(encrypted.length).toBeGreaterThan(sensitiveData.length);

      const decrypted = await securityManager.decrypt(encrypted);
      expect(decrypted).toBe(sensitiveData);
    });

    test('should hash passwords securely', async () => {
      const password = 'userPassword123!';

      const hash = await securityManager.hashPassword(password);
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hash length

      const isValid = await securityManager.verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await securityManager.verifyPassword(
        'wrongPassword',
        hash
      );
      expect(isInvalid).toBe(false);
    });

    test('should sanitize file paths', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        '/etc/shadow',
        'C:\\Windows\\System32\\config\\SAM',
      ];

      for (const path of maliciousPaths) {
        const result = await securityManager.sanitizeFilePath(path);
        expect(result).not.toContain('..');
        expect(result).not.toMatch(/^\/etc\//);
        expect(result).not.toMatch(/^C:\\/);
      }
    });
  });

  describe('Authentication Security', () => {
    test('should validate JWT tokens', async () => {
      const payload = { userId: 123, role: 'user' };

      const token = await securityManager.generateJWT(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // Header.Payload.Signature

      const decoded = await securityManager.verifyJWT(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.role).toBe(payload.role);
    });

    test('should reject expired tokens', async () => {
      const payload = { userId: 123, role: 'user' };

      // Generate token with very short expiry
      const token = await securityManager.generateJWT(payload, {
        expiresIn: '1ms',
      });

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      await expect(securityManager.verifyJWT(token)).rejects.toThrow();
    });

    test('should reject tampered tokens', async () => {
      const payload = { userId: 123, role: 'user' };
      const token = await securityManager.generateJWT(payload);

      // Tamper with token
      const parts = token.split('.');
      parts[1] = Buffer.from('{"userId":999,"role":"admin"}').toString(
        'base64'
      );
      const tamperedToken = parts.join('.');

      await expect(securityManager.verifyJWT(tamperedToken)).rejects.toThrow();
    });
  });

  describe('Content Security Policy', () => {
    test('should enforce CSP headers', async () => {
      const cspHeaders = await securityManager.generateCSPHeaders();

      expect(cspHeaders).toHaveProperty('Content-Security-Policy');
      expect(cspHeaders['Content-Security-Policy']).toContain(
        "default-src 'self'"
      );
      expect(cspHeaders['Content-Security-Policy']).toContain(
        "script-src 'self'"
      );
    });

    test('should validate content against CSP', async () => {
      const safeContent = '<div>Safe content</div>';
      const unsafeContent = '<script>alert("xss")</script>';

      const safeResult =
        await securityManager.validateContentSecurityPolicy(safeContent);
      expect(safeResult.safe).toBe(true);

      const unsafeResult =
        await securityManager.validateContentSecurityPolicy(unsafeContent);
      expect(unsafeResult.safe).toBe(false);
      expect(unsafeResult.violations).toContain('script-src');
    });
  });

  describe('Anomaly Detection', () => {
    test('should detect unusual request patterns', async () => {
      const baseRequest = {
        method: 'POST',
        url: '/api/data',
        headers: { 'user-agent': 'normal-client' },
        ip: '198.51.100.1',
      };

      // Establish baseline with normal requests
      for (let i = 0; i < 10; i++) {
        await threatDetection.analyzeRequest({
          ...baseRequest,
          body: { data: `normal request ${i}` },
        });
      }

      // Send anomalous request
      const anomalousRequest = {
        ...baseRequest,
        body: { data: 'x'.repeat(10000) }, // Unusually large payload
        headers: { 'user-agent': 'suspicious-bot/1.0' },
      };

      const analysis = await threatDetection.analyzeRequest(anomalousRequest);

      // Should detect anomaly based on payload size or user agent
      expect(
        analysis.threats.some(
          t =>
            t.type === 'anomaly_detected' || t.type === 'suspicious_user_agent'
        )
      ).toBe(true);
    });
  });

  describe('Security Headers', () => {
    test('should generate secure headers', async () => {
      const secureHeaders = await securityManager.generateSecurityHeaders();

      expect(secureHeaders).toHaveProperty('X-Content-Type-Options', 'nosniff');
      expect(secureHeaders).toHaveProperty('X-Frame-Options', 'DENY');
      expect(secureHeaders).toHaveProperty('X-XSS-Protection', '1; mode=block');
      expect(secureHeaders).toHaveProperty('Strict-Transport-Security');
      expect(secureHeaders).toHaveProperty(
        'Referrer-Policy',
        'strict-origin-when-cross-origin'
      );
    });
  });
});
