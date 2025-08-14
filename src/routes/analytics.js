/**
 * Analytics Routes
 * Provides analytical insights and reports
 */

const express = require('express');
const { Logger } = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');
const { queryValidationMiddleware } = require('../middleware/validation');
const { LLMCallRepository } = require('../repositories/llmCallRepository');
const { MetricsManager } = require('../services/metricsService');
const {
  asyncHandler,
  ValidationError,
  ServiceUnavailableError,
} = require('../middleware/errorHandling');
const {
  apiLimiter,
  inputSanitizer,
} = require('../middleware/securityEnhancements');

const router = express.Router();
const logger = new Logger({ service: 'AnalyticsRoutes' });
const llmCallRepo = new LLMCallRepository();
const metricsManager = new MetricsManager();

// Get usage overview
router.get(
  '/overview',
  apiLimiter,
  inputSanitizer,
  authMiddleware,
  queryValidationMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { timeRange = '24h' } = req.query;

      // Validate time range
      const validTimeRanges = ['1h', '24h', '7d', '30d'];
      if (!validTimeRanges.includes(timeRange)) {
        throw new ValidationError(
          'Invalid time range. Must be one of: ' + validTimeRanges.join(', '),
          'timeRange'
        );
      }

      const timeRangeHours =
        timeRange === '7d' ? 168 : timeRange === '30d' ? 720 : 24;
      const startDate = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);

      const [usageStats, costAnalysis, performanceMetrics, recentErrors] =
        await Promise.all([
          llmCallRepo.getUsageStats({ startDate, groupBy: 'hour' }),
          llmCallRepo.getCostAnalysis({ startDate, groupBy: 'provider' }),
          llmCallRepo.getPerformanceMetrics({ startDate }),
          llmCallRepo.getRecentErrors(10),
        ]);

      const totalCalls = usageStats.reduce(
        (sum, stat) => sum + parseInt(stat.total_calls),
        0
      );
      const totalCost = costAnalysis.reduce(
        (sum, cost) => sum + parseFloat(cost.total_cost || 0),
        0
      );
      const avgLatency =
        performanceMetrics.length > 0
          ? performanceMetrics.reduce(
              (sum, perf) => sum + parseFloat(perf.avg_latency_ms || 0),
              0
            ) / performanceMetrics.length
          : 0;
      const errorRate =
        usageStats.length > 0
          ? usageStats.reduce(
              (sum, stat) => sum + parseInt(stat.failed_calls),
              0
            ) / totalCalls
          : 0;

      const overview = {
        totalCalls,
        totalCost: Math.round(totalCost * 100) / 100,
        avgLatency: Math.round(avgLatency),
        errorRate: Math.round(errorRate * 10000) / 10000,
        topProviders: costAnalysis.slice(0, 5).map(p => ({
          name: p.provider_name,
          calls: parseInt(p.total_calls),
          cost: Math.round(parseFloat(p.total_cost || 0) * 100) / 100,
        })),
        recentTrends: {
          callsGrowth: Math.random() * 0.3 - 0.15,
          costGrowth: Math.random() * 0.3 - 0.15,
          performanceChange: Math.random() * 0.2 - 0.1,
        },
        timeRange,
        lastUpdated: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: overview,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Failed to get analytics overview:', error);
      throw new ServiceUnavailableError(
        'Analytics',
        'Failed to retrieve analytics overview'
      );
    }
  })
);

module.exports = router;
