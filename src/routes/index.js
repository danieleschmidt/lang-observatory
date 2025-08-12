/**
 * Main API Routes Registry
 * Centralized routing for all Lang Observatory endpoints
 */

const express = require('express');
const { Logger } = require('../utils/logger');

// Import route modules
const healthRoutes = require('./health');
const metricsRoutes = require('./metrics');
const tracesRoutes = require('./traces');
const llmRoutes = require('./llm');
const analyticsRoutes = require('./analytics');

class RouterRegistry {
  constructor() {
    this.router = express.Router();
    this.logger = new Logger({ service: 'RouterRegistry' });
    this.initialized = false;
  }

  initialize() {
    try {
      // API versioning
      const v1Router = express.Router();

      // Health and status endpoints
      v1Router.use('/health', healthRoutes);

      // Core functionality routes
      v1Router.use('/metrics', metricsRoutes);
      v1Router.use('/traces', tracesRoutes);
      v1Router.use('/llm', llmRoutes);
      v1Router.use('/analytics', analyticsRoutes);

      // Mount versioned routes
      this.router.use('/api/v1', v1Router);

      // Root endpoint
      this.router.get('/', (req, res) => {
        res.json({
          name: 'Lang Observatory API',
          version: '0.1.0',
          description:
            'A turnkey observability stack for Large Language Model applications',
          endpoints: {
            health: '/api/v1/health',
            metrics: '/api/v1/metrics',
            traces: '/api/v1/traces',
            llm: '/api/v1/llm',
            analytics: '/api/v1/analytics',
          },
          documentation:
            'https://github.com/terragon-labs/lang-observatory#readme',
        });
      });

      // API documentation endpoint
      this.router.get('/api', (req, res) => {
        res.json({
          version: 'v1',
          baseUrl: '/api/v1',
          endpoints: [
            {
              path: '/health',
              methods: ['GET'],
              description: 'Health check and system status',
            },
            {
              path: '/metrics',
              methods: ['GET', 'POST'],
              description: 'Metrics collection and retrieval',
            },
            {
              path: '/traces',
              methods: ['GET', 'POST'],
              description: 'Trace management',
            },
            {
              path: '/llm',
              methods: ['POST'],
              description: 'LLM call tracking',
            },
            {
              path: '/analytics',
              methods: ['GET'],
              description: 'Analytics and reporting',
            },
          ],
        });
      });

      // 404 handler for API routes
      this.router.use('/api/*', (req, res) => {
        res.status(404).json({
          error: 'Not Found',
          message: `API endpoint ${req.originalUrl} not found`,
          availableEndpoints: '/api',
        });
      });

      this.initialized = true;
      this.logger.info('Router registry initialized successfully');

      return this.router;
    } catch (error) {
      this.logger.error('Failed to initialize router registry:', error);
      throw error;
    }
  }

  getRouter() {
    if (!this.initialized) {
      throw new Error(
        'Router registry not initialized. Call initialize() first.'
      );
    }
    return this.router;
  }
}

// Create singleton instance
const routerRegistry = new RouterRegistry();

module.exports = routerRegistry;
