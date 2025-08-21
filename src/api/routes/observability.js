/**
 * Observability API Routes - REST endpoints for observability operations
 * Generation 1: Basic CRUD operations for traces, metrics, and health
 */

const express = require('express');
const { ObservabilityEngine } = require('../../core/observabilityEngine');
const { Logger } = require('../../utils/logger');

const router = express.Router();
const logger = new Logger({ service: 'ObservabilityAPI' });

// Initialize observability engine
let observabilityEngine;

const initializeEngine = async () => {
  if (!observabilityEngine) {
    observabilityEngine = new ObservabilityEngine();
    await observabilityEngine.initialize();
  }
  return observabilityEngine;
};

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const engine = await initializeEngine();
    const health = await engine.getHealthStatus();

    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Start a new trace
router.post('/traces', async (req, res) => {
  try {
    const { operation, metadata = {} } = req.body;

    if (!operation) {
      return res.status(400).json({
        error: 'Operation name is required',
        code: 'MISSING_OPERATION',
      });
    }

    const engine = await initializeEngine();
    const traceId = await engine.startTrace(operation, metadata);

    res.status(201).json({
      traceId,
      operation,
      status: 'started',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to start trace:', error);
    res.status(500).json({
      error: error.message,
      code: 'TRACE_START_ERROR',
    });
  }
});

// Get trace by ID
router.get('/traces/:traceId', async (req, res) => {
  try {
    const { traceId } = req.params;
    const engine = await initializeEngine();
    const trace = engine.getTrace(traceId);

    if (!trace) {
      return res.status(404).json({
        error: 'Trace not found',
        traceId,
        code: 'TRACE_NOT_FOUND',
      });
    }

    res.json(trace);
  } catch (error) {
    logger.error('Failed to get trace:', error);
    res.status(500).json({
      error: error.message,
      code: 'TRACE_GET_ERROR',
    });
  }
});

// Add span to trace
router.post('/traces/:traceId/spans', async (req, res) => {
  try {
    const { traceId } = req.params;
    const { name, data = {} } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Span name is required',
        code: 'MISSING_SPAN_NAME',
      });
    }

    const engine = await initializeEngine();
    const spanId = await engine.addSpan(traceId, name, data);

    res.status(201).json({
      spanId,
      traceId,
      name,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to add span:', error);
    res.status(500).json({
      error: error.message,
      code: 'SPAN_ADD_ERROR',
    });
  }
});

// End trace
router.put('/traces/:traceId/end', async (req, res) => {
  try {
    const { traceId } = req.params;
    const { result = {} } = req.body;

    const engine = await initializeEngine();
    const trace = await engine.endTrace(traceId, result);

    res.json({
      traceId,
      status: trace.status,
      duration: trace.duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to end trace:', error);
    res.status(500).json({
      error: error.message,
      code: 'TRACE_END_ERROR',
    });
  }
});

// Get all traces
router.get('/traces', async (req, res) => {
  try {
    const engine = await initializeEngine();
    const traces = engine.getAllTraces();

    // Add pagination support
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedTraces = traces.slice(startIndex, endIndex);

    res.json({
      traces: paginatedTraces,
      pagination: {
        page,
        limit,
        total: traces.length,
        pages: Math.ceil(traces.length / limit),
      },
    });
  } catch (error) {
    logger.error('Failed to get traces:', error);
    res.status(500).json({
      error: error.message,
      code: 'TRACES_GET_ERROR',
    });
  }
});

// Record LLM interaction
router.post('/llm-interactions', async (req, res) => {
  try {
    const { provider, model, input, output, metadata = {} } = req.body;

    // Validate required fields
    const requiredFields = ['provider', 'model', 'input', 'output'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields,
        code: 'MISSING_REQUIRED_FIELDS',
      });
    }

    const engine = await initializeEngine();
    const interaction = await engine.recordLLMInteraction(
      provider,
      model,
      input,
      output,
      metadata
    );

    res.status(201).json({
      interaction,
      status: 'recorded',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to record LLM interaction:', error);
    res.status(500).json({
      error: error.message,
      code: 'LLM_INTERACTION_ERROR',
    });
  }
});

// Get active operations
router.get('/operations/active', async (req, res) => {
  try {
    const engine = await initializeEngine();
    const activeOperations = engine.getActiveOperations();

    res.json({
      activeOperations,
      count: activeOperations.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get active operations:', error);
    res.status(500).json({
      error: error.message,
      code: 'ACTIVE_OPERATIONS_ERROR',
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  logger.error('Observability API error:', error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
