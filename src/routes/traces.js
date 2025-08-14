/**
 * Traces Routes
 * Handles trace management and retrieval
 */

const express = require('express');
const { Logger } = require('../utils/logger');
const { Helpers } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { LLMCallRepository } = require('../repositories/llmCallRepository');

const router = express.Router();
const logger = new Logger({ service: 'TracesRoutes' });
const llmCallRepo = new LLMCallRepository();

const traceStore = new Map();

// Create a new trace
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      operation,
      sessionId,
      userId,
      parentTraceId,
      metadata = {},
      tags = {},
    } = req.body;

    if (!operation) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Operation is required',
      });
    }

    const traceId = Helpers.generateTraceId();

    const trace = {
      id: traceId,
      operation,
      sessionId,
      userId,
      parentTraceId,
      status: 'active',
      startedAt: new Date().toISOString(),
      metadata,
      tags,
      llmCalls: [],
    };

    traceStore.set(traceId, trace);

    logger.info('Trace created', { traceId, operation, sessionId });

    res.status(201).json({
      success: true,
      data: trace,
    });
  } catch (error) {
    logger.error('Failed to create trace:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create trace',
    });
  }
});

// Get trace by ID
router.get('/:traceId', authMiddleware, async (req, res) => {
  try {
    const { traceId } = req.params;

    const trace = traceStore.get(traceId);

    if (!trace) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Trace not found',
      });
    }

    const llmCalls = await llmCallRepo.findByTraceId(traceId);
    trace.llmCalls = llmCalls;

    if (trace.status === 'active' && llmCalls.length > 0) {
      const lastCall = llmCalls[llmCalls.length - 1];
      if (lastCall.completed_at) {
        trace.status = 'completed';
        trace.completedAt = lastCall.completed_at;
        trace.duration =
          new Date(lastCall.completed_at) - new Date(trace.startedAt);
        traceStore.set(traceId, trace);
      }
    }

    res.json({
      success: true,
      data: trace,
    });
  } catch (error) {
    logger.error(`Failed to get trace ${req.params.traceId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to retrieve trace',
    });
  }
});

module.exports = router;
