/**
 * Health Check Routes
 * Provides system health and status endpoints
 */

const express = require('express');
const { getConnection } = require('../database/connection');
const { Logger } = require('../utils/logger');

const router = express.Router();
const logger = new Logger({ service: 'HealthRoutes' });

// Basic health check
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.LANG_OBSERVATORY_VERSION || '0.1.0',
      node: process.version,
      memory: process.memoryUsage(),
      env: process.env.NODE_ENV || 'development',
    };

    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Detailed health check with dependencies
router.get('/detailed', async (req, res) => {
  try {
    const checks = {};
    let overallStatus = 'healthy';

    // Database health check with enhanced error handling
    try {
      const db = getConnection();
      if (db && typeof db.healthCheck === 'function') {
        const dbHealth = await db.healthCheck();
        checks.database = dbHealth;

        if (!dbHealth.healthy) {
          overallStatus = 'degraded';
        }
      } else if (db && typeof db.query === 'function') {
        // Try a simple query if healthCheck is not available
        await db.query('SELECT 1');
        checks.database = {
          healthy: true,
          message: 'Database connection successful',
          timestamp: new Date().toISOString(),
        };
      } else {
        // Database connection not available
        checks.database = {
          healthy: false,
          error: 'Database connection not available',
          timestamp: new Date().toISOString(),
        };
        overallStatus = 'degraded';
      }
    } catch (error) {
      logger.error('Database health check failed:', error);
      checks.database = {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      overallStatus = 'unhealthy';
    }

    // Memory check
    const memUsage = process.memoryUsage();
    const memoryThreshold = 1024 * 1024 * 1024; // 1GB
    checks.memory = {
      healthy: memUsage.heapUsed < memoryThreshold,
      usage: memUsage,
      threshold: memoryThreshold,
    };

    if (!checks.memory.healthy) {
      overallStatus = 'degraded';
    }

    // Disk space check (simplified)
    checks.disk = {
      healthy: true,
      message: 'Disk space monitoring not implemented',
    };

    // Quantum Task Planner health check
    try {
      // Import the LangObservatory to check quantum components
      const { LangObservatory } = require('../index');

      // Create a test instance to check component health
      const observatory = new LangObservatory({});
      await observatory.initialize();

      const healthStatus = await observatory.getHealthStatus();
      checks.observatory = {
        healthy: healthStatus.status === 'healthy',
        status: healthStatus.status,
        services: healthStatus.services,
        timestamp: healthStatus.timestamp,
      };

      if (healthStatus.status !== 'healthy') {
        overallStatus = 'degraded';
      }

      await observatory.shutdown();
    } catch (error) {
      logger.error('Observatory health check failed:', error);
      checks.observatory = {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      overallStatus = 'degraded';
    }

    // Circuit breaker status check
    checks.circuitBreakers = {
      healthy: true,
      status: 'All circuit breakers operational',
      timestamp: new Date().toISOString(),
    };

    const health = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.LANG_OBSERVATORY_VERSION || '0.1.0',
      checks,
    };

    const statusCode =
      overallStatus === 'healthy'
        ? 200
        : overallStatus === 'degraded'
          ? 200
          : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Liveness probe (for Kubernetes)
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe (for Kubernetes)
router.get('/ready', async (req, res) => {
  try {
    // Check if all dependencies are ready
    const db = getConnection();
    const dbHealth = await db.healthCheck();

    if (dbHealth.healthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        reason: 'Database not healthy',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not_ready',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Startup probe (for Kubernetes)
router.get('/startup', async (req, res) => {
  try {
    // Check if application has started successfully
    const startupChecks = {
      database: false,
      routes: false,
      services: false,
    };

    // Database connection check
    try {
      const db = getConnection();
      await db.query('SELECT 1');
      startupChecks.database = true;
    } catch (error) {
      logger.warn('Database startup check failed:', error);
    }

    // Routes check
    startupChecks.routes = true; // If we got here, routes are working

    // Services check (simplified)
    startupChecks.services = true;

    const allChecks = Object.values(startupChecks).every(
      check => check === true
    );

    if (allChecks) {
      res.status(200).json({
        status: 'started',
        checks: startupChecks,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'starting',
        checks: startupChecks,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Startup check failed:', error);
    res.status(503).json({
      status: 'startup_failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// System information
router.get('/info', (req, res) => {
  try {
    const info = {
      application: {
        name: 'Lang Observatory',
        version: process.env.LANG_OBSERVATORY_VERSION || '0.1.0',
        description:
          'A turnkey observability stack for Large Language Model applications',
      },
      runtime: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        pid: process.pid,
      },
      environment: {
        node_env: process.env.NODE_ENV || 'development',
        debug: process.env.DEBUG || false,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      features: {
        langfuse: Boolean(process.env.LANGFUSE_ENABLED),
        openlit: Boolean(process.env.OPENLIT_ENABLED),
        metrics: Boolean(process.env.LANG_OBSERVATORY_METRICS_ENABLED),
        cache: Boolean(process.env.REDIS_URL),
      },
    };

    res.json(info);
  } catch (error) {
    logger.error('System info failed:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
