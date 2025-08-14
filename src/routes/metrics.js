/**
 * Metrics Routes
 * Handles metrics collection and retrieval
 */

const express = require('express');
const { Logger } = require('../utils/logger');
const {
  authMiddleware,
  optionalAuthMiddleware,
} = require('../middleware/auth');
const { validationMiddleware } = require('../middleware/validation');
const { MetricsManager } = require('../services/metricsService');
const { LLMCallRepository } = require('../repositories/llmCallRepository');

const router = express.Router();
const logger = new Logger({ service: 'MetricsRoutes' });
const metricsManager = new MetricsManager();
const llmCallRepo = new LLMCallRepository();

// Record a custom metric
router.post(
  '/custom',
  authMiddleware,
  validationMiddleware('metric'),
  async (req, res) => {
    try {
      const { name, value, type = 'gauge', labels = {}, timestamp } = req.body;

      await metricsManager.recordCustomMetric(name, value, type, labels);
      logger.info('Custom metric recorded', { name, value, type, labels });

      res.status(201).json({
        success: true,
        message: 'Metric recorded successfully',
        data: { name, value, type, labels, timestamp: timestamp || Date.now() },
      });
    } catch (error) {
      logger.error('Failed to record custom metric:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to record metric',
      });
    }
  }
);

// Get metrics in Prometheus format
router.get('/prometheus', optionalAuthMiddleware, async (req, res) => {
  try {
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [costAnalysis, usageStats, performanceMetrics] = await Promise.all([
      llmCallRepo.getCostAnalysis({ startDate, groupBy: 'model' }),
      llmCallRepo.getUsageStats({ startDate, groupBy: 'hour' }),
      llmCallRepo.getPerformanceMetrics({ startDate })
    ]);
    
    const lines = [];
    
    lines.push('# HELP lang_observatory_llm_calls_total Total number of LLM calls');
    lines.push('# TYPE lang_observatory_llm_calls_total counter');
    
    for (const model of costAnalysis) {
      const provider = model.provider_name || 'unknown';
      const modelName = model.model_name || 'unknown';
      const calls = model.total_calls || 0;
      lines.push(`lang_observatory_llm_calls_total{provider="${provider}",model="${modelName}"} ${calls}`);
    }
    
    lines.push('');
    lines.push('# HELP lang_observatory_llm_cost_usd_total Total cost of LLM calls in USD');
    lines.push('# TYPE lang_observatory_llm_cost_usd_total counter');
    
    for (const model of costAnalysis) {
      const provider = model.provider_name || 'unknown';
      const modelName = model.model_name || 'unknown';
      const cost = model.total_cost || 0;
      lines.push(`lang_observatory_llm_cost_usd_total{provider="${provider}",model="${modelName}"} ${cost}`);
    }
    
    lines.push('');
    lines.push('# HELP lang_observatory_llm_latency_ms_avg Average latency of LLM calls in milliseconds');
    lines.push('# TYPE lang_observatory_llm_latency_ms_avg gauge');
    
    for (const perf of performanceMetrics) {
      const provider = perf.provider_name || 'unknown';
      const modelName = perf.model_name || 'unknown';
      const latency = perf.avg_latency_ms || 0;
      lines.push(`lang_observatory_llm_latency_ms_avg{provider="${provider}",model="${modelName}"} ${latency}`);
    }
    
    lines.push('');
    const metrics = lines.join('\n');

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    logger.error('Failed to generate Prometheus metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to generate metrics',
    });
  }
});

module.exports = router;
