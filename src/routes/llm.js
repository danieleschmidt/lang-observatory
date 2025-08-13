/**
 * LLM Routes
 * Handles LLM call tracking and management
 */

const express = require('express');
const { LLMCallRepository } = require('../repositories/llmCallRepository');
const { Validators } = require('../utils/validators');
const { Logger } = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');
const { validationMiddleware } = require('../middleware/validation');

const router = express.Router();
const logger = new Logger({ service: 'LLMRoutes' });
const llmCallRepo = new LLMCallRepository();

// Record an LLM call
router.post(
  '/calls',
  authMiddleware,
  validationMiddleware('llmCall'),
  async (req, res) => {
    try {
      const {
        traceId,
        sessionId,
        provider,
        model,
        input,
        output,
        tokens,
        cost,
        latency,
        timeToFirstToken,
        tokensPerSecond,
        status = 'success',
        error,
        metadata,
        startedAt,
        completedAt,
      } = req.body;

      // Validate required fields
      Validators.validateLLMCallData({
        provider,
        model,
        input,
        output,
        tokens,
        cost,
      });

      // Create LLM call record
      const callData = {
        traceId: traceId || req.traceId, // Use request trace ID if not provided
        sessionId,
        provider,
        model,
        input,
        output,
        tokens,
        cost,
        latency,
        timeToFirstToken,
        tokensPerSecond,
        status,
        error,
        metadata,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        completedAt: completedAt ? new Date(completedAt) : new Date(),
      };

      const result = await llmCallRepo.createWithProviderModel(callData);

      logger.info('LLM call recorded', {
        id: result.id,
        provider,
        model,
        tokens: tokens?.total,
        cost: cost?.total,
      });

      res.status(201).json({
        success: true,
        data: result,
        message: 'LLM call recorded successfully',
      });
    } catch (error) {
      logger.error('Failed to record LLM call:', error);

      if (error.name === 'ValidationError') {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to record LLM call',
        });
      }
    }
  }
);

// Get LLM calls by trace ID
router.get('/calls/trace/:traceId', authMiddleware, async (req, res) => {
  try {
    const { traceId } = req.params;

    Validators.validateTraceId(traceId);

    const calls = await llmCallRepo.findByTraceId(traceId);

    res.json({
      success: true,
      data: calls,
      count: calls.length,
    });
  } catch (error) {
    logger.error(
      `Failed to get LLM calls for trace ${req.params.traceId}:`,
      error
    );

    if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve LLM calls',
      });
    }
  }
});

// Get LLM calls by session
router.get('/calls/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 100, offset = 0, startDate, endDate } = req.query;

    const options = {
      limit: Math.min(parseInt(limit), 1000), // Max 1000 results
      offset: parseInt(offset) || 0,
    };

    if (startDate) {
      options.startDate = new Date(startDate);
    }

    if (endDate) {
      options.endDate = new Date(endDate);
    }

    const calls = await llmCallRepo.findBySession(sessionId, options);

    res.json({
      success: true,
      data: calls,
      count: calls.length,
      pagination: {
        limit: options.limit,
        offset: options.offset,
      },
    });
  } catch (error) {
    logger.error(
      `Failed to get LLM calls for session ${req.params.sessionId}:`,
      error
    );
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to retrieve LLM calls',
    });
  }
});

// Get LLM calls by provider
router.get('/calls/provider/:providerId', authMiddleware, async (req, res) => {
  try {
    const { providerId } = req.params;
    const { limit = 100, offset = 0, startDate, endDate, status } = req.query;

    const options = {
      limit: Math.min(parseInt(limit), 1000),
      offset: parseInt(offset) || 0,
    };

    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    if (status) options.status = status;

    const calls = await llmCallRepo.findByProvider(
      parseInt(providerId),
      options
    );

    res.json({
      success: true,
      data: calls,
      count: calls.length,
      pagination: {
        limit: options.limit,
        offset: options.offset,
      },
    });
  } catch (error) {
    logger.error(
      `Failed to get LLM calls for provider ${req.params.providerId}:`,
      error
    );
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to retrieve LLM calls',
    });
  }
});

// Get usage statistics
router.get('/stats/usage', authMiddleware, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      providerId,
      modelId,
      groupBy = 'day',
    } = req.query;

    const options = { groupBy };

    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    if (providerId) options.providerId = parseInt(providerId);
    if (modelId) options.modelId = parseInt(modelId);

    const stats = await llmCallRepo.getUsageStats(options);

    res.json({
      success: true,
      data: stats,
      count: stats.length,
    });
  } catch (error) {
    logger.error('Failed to get usage statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to retrieve usage statistics',
    });
  }
});

// Get cost analysis
router.get('/stats/costs', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'provider' } = req.query;

    const options = { groupBy };

    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);

    const analysis = await llmCallRepo.getCostAnalysis(options);

    res.json({
      success: true,
      data: analysis,
      count: analysis.length,
    });
  } catch (error) {
    logger.error('Failed to get cost analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to retrieve cost analysis',
    });
  }
});

// Get performance metrics
router.get('/stats/performance', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, providerId, modelId } = req.query;

    const options = {};

    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    if (providerId) options.providerId = parseInt(providerId);
    if (modelId) options.modelId = parseInt(modelId);

    const metrics = await llmCallRepo.getPerformanceMetrics(options);

    res.json({
      success: true,
      data: metrics,
      count: metrics.length,
    });
  } catch (error) {
    logger.error('Failed to get performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to retrieve performance metrics',
    });
  }
});

// Get recent errors
router.get('/errors/recent', authMiddleware, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const errors = await llmCallRepo.getRecentErrors(
      Math.min(parseInt(limit), 200)
    );

    res.json({
      success: true,
      data: errors,
      count: errors.length,
    });
  } catch (error) {
    logger.error('Failed to get recent errors:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to retrieve recent errors',
    });
  }
});

// Get LLM call by ID
router.get('/calls/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const call = await llmCallRepo.findById(parseInt(id));

    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `LLM call with ID ${id} not found`,
      });
    }

    res.json({
      success: true,
      data: call,
    });
  } catch (error) {
    logger.error(`Failed to get LLM call ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to retrieve LLM call',
    });
  }
});

// Bulk record LLM calls
router.post(
  '/calls/batch',
  authMiddleware,
  validationMiddleware('llmCallBatch'),
  async (req, res) => {
    try {
      const { calls } = req.body;

      if (!Array.isArray(calls) || calls.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Calls array is required and must not be empty',
        });
      }

      if (calls.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Maximum 100 calls allowed per batch',
        });
      }

      const results = [];
      const errors = [];

      for (const [index, callData] of calls.entries()) {
        try {
          Validators.validateLLMCallData(callData);
          const result = await llmCallRepo.createWithProviderModel({
            ...callData,
            traceId: callData.traceId || req.traceId,
            startedAt: callData.startedAt
              ? new Date(callData.startedAt)
              : new Date(),
            completedAt: callData.completedAt
              ? new Date(callData.completedAt)
              : new Date(),
          });
          results.push(result);
        } catch (error) {
          errors.push({
            index,
            error: error.message,
            data: callData,
          });
        }
      }

      logger.info('Batch LLM calls processed', {
        total: calls.length,
        successful: results.length,
        errors: errors.length,
      });

      res.status(201).json({
        success: true,
        data: {
          successful: results,
          errors: errors,
          summary: {
            total: calls.length,
            successful: results.length,
            failed: errors.length,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to process batch LLM calls:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to process batch LLM calls',
      });
    }
  }
);

module.exports = router;
