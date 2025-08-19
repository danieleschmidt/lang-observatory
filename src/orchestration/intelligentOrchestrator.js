/**
 * Intelligent Orchestrator for LLM Observatory
 * Coordinates all systems with AI-driven decision making
 */

const { Logger } = require('../utils/logger');
const {
  AdaptiveLearningSystem,
} = require('../auto-optimization/adaptiveLearning');
const {
  PredictiveAnalyticsEngine,
} = require('../intelligence/predictiveAnalytics');
const EventEmitter = require('events');

class IntelligentOrchestrator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      orchestrationInterval: 60000, // 1 minute
      decisionThreshold: 0.7,
      maxConcurrentActions: 5,
      emergencyModeThreshold: 0.95,
      enableAutonomousActions: true,
      ...config,
    };

    this.logger = new Logger({ service: 'IntelligentOrchestrator' });

    // Core AI systems
    this.adaptiveLearning = new AdaptiveLearningSystem(
      config.adaptiveLearning || {}
    );
    this.predictiveAnalytics = new PredictiveAnalyticsEngine(
      config.predictiveAnalytics || {}
    );

    // System state
    this.systemState = {
      health: 'unknown',
      load: 0,
      errors: 0,
      predictions: {},
      adaptations: [],
      emergencyMode: false,
    };

    // Decision engine
    this.decisionEngine = new DecisionEngine(this.config);
    this.actionExecutor = new ActionExecutor(this.config);
    this.contextAnalyzer = new ContextAnalyzer(this.config);

    // Active orchestration
    this.activeActions = new Map();
    this.orchestrationHistory = [];
    this.initialized = false;

    this.setupEventHandlers();
  }

  async initialize() {
    try {
      this.logger.info('Initializing Intelligent Orchestrator...');

      // Initialize AI systems
      await this.adaptiveLearning.initialize();
      await this.predictiveAnalytics.initialize();

      // Initialize orchestration components
      await this.decisionEngine.initialize();
      await this.actionExecutor.initialize();
      await this.contextAnalyzer.initialize();

      // Start orchestration cycle
      this.startOrchestrationCycle();

      this.initialized = true;
      this.logger.info('Intelligent Orchestrator initialized successfully');

      return this;
    } catch (error) {
      this.logger.error(
        'Failed to initialize Intelligent Orchestrator:',
        error
      );
      throw error;
    }
  }

  setupEventHandlers() {
    // Listen to system events
    this.on('systemMetrics', metrics => this.processSystemMetrics(metrics));
    this.on('performanceAlert', alert => this.handlePerformanceAlert(alert));
    this.on('anomalyDetected', anomaly => this.handleAnomaly(anomaly));
    this.on('emergencyTrigger', () => this.enterEmergencyMode());

    // Listen to AI system events
    this.adaptiveLearning.on('adaptationRecommendation', rec =>
      this.handleAdaptationRecommendation(rec)
    );
    this.predictiveAnalytics.on('predictionsGenerated', pred =>
      this.handlePredictions(pred)
    );
    this.predictiveAnalytics.on('modelsRetrained', info =>
      this.handleModelUpdate(info)
    );
  }

  async processSystemMetrics(metrics) {
    try {
      // Update system state
      this.updateSystemState(metrics);

      // Analyze context
      const context = await this.contextAnalyzer.analyzeContext(
        metrics,
        this.systemState
      );

      // Generate predictions
      const predictions =
        await this.predictiveAnalytics.generatePredictions(context);
      this.systemState.predictions = predictions;

      // Feed data to adaptive learning
      this.adaptiveLearning.emit('performanceData', {
        ...metrics,
        context,
        predictions,
      });

      // Make orchestration decisions
      await this.makeOrchestrationDecisions(context, predictions);
    } catch (error) {
      this.logger.error('Error processing system metrics:', error);
    }
  }

  updateSystemState(metrics) {
    this.systemState = {
      ...this.systemState,
      health: this.calculateOverallHealth(metrics),
      load: metrics.load || 0,
      errors: metrics.errors || 0,
      lastUpdate: new Date().toISOString(),
    };

    // Check for emergency conditions
    if (
      this.systemState.load > this.config.emergencyModeThreshold ||
      this.systemState.errors > 0.1
    ) {
      this.emit('emergencyTrigger');
    }
  }

  calculateOverallHealth(metrics) {
    const factors = {
      latency:
        metrics.latency < 2000
          ? 1
          : Math.max(0, 1 - (metrics.latency - 2000) / 3000),
      errors: Math.max(0, 1 - (metrics.errors || 0)),
      load: Math.max(0, 1 - (metrics.load || 0)),
      availability: metrics.availability || 0.99,
    };

    const weights = { latency: 0.3, errors: 0.3, load: 0.2, availability: 0.2 };
    const score = Object.entries(factors).reduce((sum, [key, value]) => {
      return sum + value * weights[key];
    }, 0);

    if (score > 0.9) return 'excellent';
    if (score > 0.7) return 'good';
    if (score > 0.5) return 'fair';
    return 'poor';
  }

  async makeOrchestrationDecisions(context, predictions) {
    try {
      // Generate decision options
      const decisions = await this.decisionEngine.generateDecisions(
        context,
        predictions,
        this.systemState
      );

      // Filter and prioritize decisions
      const prioritizedDecisions = this.prioritizeDecisions(decisions);

      // Execute top decisions
      await this.executeDecisions(prioritizedDecisions);
    } catch (error) {
      this.logger.error('Error making orchestration decisions:', error);
    }
  }

  prioritizeDecisions(decisions) {
    return decisions
      .filter(decision => decision.confidence > this.config.decisionThreshold)
      .sort((a, b) => {
        // Sort by priority first, then confidence
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.confidence - a.confidence;
      })
      .slice(0, this.config.maxConcurrentActions);
  }

  async executeDecisions(decisions) {
    const executionPromises = decisions.map(async decision => {
      try {
        if (
          this.config.enableAutonomousActions ||
          decision.requiresApproval === false
        ) {
          const result = await this.actionExecutor.executeAction(decision);
          this.recordOrchestrationAction(decision, result);
          return result;
        } else {
          this.logger.info(
            `Decision requires approval: ${decision.type}`,
            decision
          );
          this.emit('approvalRequired', decision);
          return { status: 'pending_approval', decision };
        }
      } catch (error) {
        this.logger.error(`Failed to execute decision ${decision.id}:`, error);
        return { status: 'failed', error: error.message, decision };
      }
    });

    return Promise.allSettled(executionPromises);
  }

  recordOrchestrationAction(decision, result) {
    const record = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      decision,
      result,
      timestamp: new Date().toISOString(),
      systemState: { ...this.systemState },
    };

    this.orchestrationHistory.push(record);

    // Maintain history size
    if (this.orchestrationHistory.length > 1000) {
      this.orchestrationHistory = this.orchestrationHistory.slice(-800);
    }

    this.emit('actionExecuted', record);
  }

  async handlePerformanceAlert(alert) {
    this.logger.warn('Performance alert received:', alert);

    const emergencyDecision =
      await this.decisionEngine.generateEmergencyDecision(alert);
    if (emergencyDecision && emergencyDecision.confidence > 0.8) {
      await this.actionExecutor.executeAction(emergencyDecision);
      this.recordOrchestrationAction(emergencyDecision, {
        status: 'emergency_executed',
      });
    }
  }

  async handleAnomaly(anomaly) {
    this.logger.warn('Anomaly detected:', anomaly);

    // Generate immediate response
    const response = await this.decisionEngine.generateAnomalyResponse(anomaly);
    if (response) {
      await this.actionExecutor.executeAction(response);
      this.recordOrchestrationAction(response, { status: 'anomaly_response' });
    }
  }

  async handleAdaptationRecommendation(recommendation) {
    this.logger.info(
      'Adaptation recommendation received:',
      recommendation.type
    );

    // Convert recommendation to executable decision
    const decision =
      await this.decisionEngine.convertRecommendationToDecision(recommendation);
    if (decision && decision.confidence > this.config.decisionThreshold) {
      await this.executeDecisions([decision]);
    }
  }

  async handlePredictions(predictionData) {
    // Use predictions to proactively optimize
    const { predictions } = predictionData;

    // Check for predicted issues
    if (
      predictions.latency?.value > 2 &&
      predictions.latency?.confidence > 0.7
    ) {
      const preemptiveDecision = {
        id: `preemptive_${Date.now()}`,
        type: 'latency_preemption',
        action: 'scale_resources',
        confidence: predictions.latency.confidence,
        priority: 2,
        rationale: 'Predicted latency spike',
      };

      await this.executeDecisions([preemptiveDecision]);
    }

    // Check for cost optimization opportunities
    if (predictions.cost?.value > 0.05 && predictions.cost?.confidence > 0.8) {
      const costOptimization = {
        id: `cost_opt_${Date.now()}`,
        type: 'cost_optimization',
        action: 'enable_caching',
        confidence: predictions.cost.confidence,
        priority: 3,
        rationale: 'Predicted high costs',
      };

      await this.executeDecisions([costOptimization]);
    }
  }

  async handleModelUpdate(updateInfo) {
    this.logger.info('Prediction models updated:', updateInfo);

    // Recalibrate decision thresholds based on new model accuracy
    await this.decisionEngine.recalibrateThresholds(updateInfo);
  }

  async enterEmergencyMode() {
    if (this.systemState.emergencyMode) return;

    this.logger.warn('Entering emergency mode');
    this.systemState.emergencyMode = true;

    // Execute emergency protocols
    const emergencyActions = [
      {
        id: 'emergency_circuit_breaker',
        type: 'circuit_breaker',
        action: 'enable_all',
        confidence: 1.0,
        priority: 1,
      },
      {
        id: 'emergency_rate_limit',
        type: 'rate_limiting',
        action: 'enforce_strict',
        confidence: 1.0,
        priority: 1,
      },
      {
        id: 'emergency_logging',
        type: 'logging',
        action: 'increase_verbosity',
        confidence: 1.0,
        priority: 2,
      },
    ];

    await this.executeDecisions(emergencyActions);

    // Schedule emergency mode exit check
    setTimeout(() => this.checkEmergencyExit(), 300000); // 5 minutes
  }

  async checkEmergencyExit() {
    if (!this.systemState.emergencyMode) return;

    // Check if conditions have improved
    if (
      this.systemState.health === 'good' ||
      this.systemState.health === 'excellent'
    ) {
      this.logger.info('Exiting emergency mode - conditions improved');
      this.systemState.emergencyMode = false;

      // Restore normal operations
      const restoreActions = [
        {
          id: 'restore_normal_operations',
          type: 'restore',
          action: 'normal_mode',
          confidence: 0.9,
          priority: 1,
        },
      ];

      await this.executeDecisions(restoreActions);
    } else {
      // Continue in emergency mode, check again later
      setTimeout(() => this.checkEmergencyExit(), 300000);
    }
  }

  startOrchestrationCycle() {
    setInterval(async () => {
      try {
        await this.performOrchestrationCycle();
      } catch (error) {
        this.logger.error('Error in orchestration cycle:', error);
      }
    }, this.config.orchestrationInterval);
  }

  async performOrchestrationCycle() {
    // Periodic optimization and health checks
    const health = await this.getSystemHealth();

    if (health.overallScore < 0.8) {
      // Generate optimization recommendations
      const optimizations =
        await this.generateOptimizationRecommendations(health);
      await this.executeDecisions(optimizations);
    }

    // Clean up completed actions
    this.cleanupCompletedActions();

    // Emit orchestration status
    this.emit('orchestrationCycle', {
      health,
      activeActions: this.activeActions.size,
      systemState: this.systemState,
      timestamp: new Date().toISOString(),
    });
  }

  async generateOptimizationRecommendations(health) {
    const recommendations = [];

    // Performance optimization
    if (health.performance < 0.7) {
      recommendations.push({
        id: `perf_opt_${Date.now()}`,
        type: 'performance_optimization',
        action: 'optimize_resources',
        confidence: 0.8,
        priority: 2,
        rationale: 'Low performance detected',
      });
    }

    // Cost optimization
    if (health.costEfficiency < 0.6) {
      recommendations.push({
        id: `cost_opt_${Date.now()}`,
        type: 'cost_optimization',
        action: 'optimize_providers',
        confidence: 0.7,
        priority: 3,
        rationale: 'Cost inefficiency detected',
      });
    }

    // Reliability enhancement
    if (health.reliability < 0.9) {
      recommendations.push({
        id: `rel_enh_${Date.now()}`,
        type: 'reliability_enhancement',
        action: 'enhance_monitoring',
        confidence: 0.9,
        priority: 1,
        rationale: 'Reliability below threshold',
      });
    }

    return recommendations;
  }

  cleanupCompletedActions() {
    const now = Date.now();
    for (const [actionId, action] of this.activeActions) {
      if (
        action.status === 'completed' ||
        action.status === 'failed' ||
        now - action.startTime > 3600000
      ) {
        // 1 hour timeout
        this.activeActions.delete(actionId);
      }
    }
  }

  async getSystemHealth() {
    const adaptiveLearningHealth = await this.adaptiveLearning.getHealth();
    const predictiveAnalyticsHealth =
      await this.predictiveAnalytics.getHealth();

    const performance = this.calculatePerformanceScore();
    const reliability = this.calculateReliabilityScore();
    const costEfficiency = this.calculateCostEfficiencyScore();

    const overallScore = (performance + reliability + costEfficiency) / 3;

    return {
      overallScore,
      performance,
      reliability,
      costEfficiency,
      aiSystems: {
        adaptiveLearning: adaptiveLearningHealth.healthy,
        predictiveAnalytics: predictiveAnalyticsHealth.healthy,
      },
      systemState: this.systemState,
      timestamp: new Date().toISOString(),
    };
  }

  calculatePerformanceScore() {
    const recentActions = this.orchestrationHistory.slice(-50);
    if (recentActions.length === 0) return 0.8;

    const successRate =
      recentActions.filter(a => a.result.status === 'success').length /
      recentActions.length;
    return Math.min(1, successRate + 0.2); // Bonus for system health
  }

  calculateReliabilityScore() {
    return this.systemState.errors > 0.05 ? 0.6 : 0.95;
  }

  calculateCostEfficiencyScore() {
    const predictions = this.systemState.predictions;
    if (!predictions.cost?.value) return 0.7;

    // Lower cost = higher efficiency score
    return Math.max(0.1, 1 - predictions.cost.value / 0.1);
  }

  async getOrchestrationMetrics() {
    const recentHistory = this.orchestrationHistory.slice(-100);
    const actionTypes = {};
    const successRates = {};

    recentHistory.forEach(record => {
      const type = record.decision.type;
      actionTypes[type] = (actionTypes[type] || 0) + 1;

      if (!successRates[type]) successRates[type] = { total: 0, success: 0 };
      successRates[type].total++;
      if (record.result.status === 'success') successRates[type].success++;
    });

    return {
      totalActions: this.orchestrationHistory.length,
      recentActions: recentHistory.length,
      activeActions: this.activeActions.size,
      actionTypes,
      successRates: Object.fromEntries(
        Object.entries(successRates).map(([type, data]) => [
          type,
          data.total > 0 ? data.success / data.total : 0,
        ])
      ),
      systemState: this.systemState,
      emergencyMode: this.systemState.emergencyMode,
    };
  }

  async shutdown() {
    this.logger.info('Shutting down Intelligent Orchestrator...');

    // Shutdown AI systems
    await this.adaptiveLearning.shutdown();
    await this.predictiveAnalytics.shutdown();

    // Shutdown orchestration components
    await this.decisionEngine.shutdown();
    await this.actionExecutor.shutdown();
    await this.contextAnalyzer.shutdown();

    this.removeAllListeners();
    this.activeActions.clear();
    this.orchestrationHistory = [];
    this.initialized = false;

    this.logger.info('Intelligent Orchestrator shutdown complete');
  }
}

// Supporting classes
class DecisionEngine {
  constructor(config) {
    this.config = config;
    this.logger = new Logger({ service: 'DecisionEngine' });
    this.decisionRules = new Map();
    this.thresholds = {
      latency: 2000,
      cost: 0.05,
      errors: 0.05,
      load: 0.8,
    };
  }

  async initialize() {
    this.setupDecisionRules();
    this.logger.info('Decision Engine initialized');
  }

  setupDecisionRules() {
    // Latency optimization rule
    this.decisionRules.set('latency_optimization', {
      condition: (context, predictions) =>
        predictions.latency?.value > this.thresholds.latency / 1000,
      action: context => ({
        type: 'latency_optimization',
        action: 'scale_resources',
        confidence: 0.8,
        priority: 2,
      }),
    });

    // Cost optimization rule
    this.decisionRules.set('cost_optimization', {
      condition: (context, predictions) =>
        predictions.cost?.value > this.thresholds.cost,
      action: context => ({
        type: 'cost_optimization',
        action: 'enable_caching',
        confidence: 0.7,
        priority: 3,
      }),
    });

    // Error handling rule
    this.decisionRules.set('error_handling', {
      condition: (context, predictions) =>
        predictions.errors?.value > this.thresholds.errors,
      action: context => ({
        type: 'error_handling',
        action: 'enable_circuit_breaker',
        confidence: 0.9,
        priority: 1,
      }),
    });
  }

  async generateDecisions(context, predictions, systemState) {
    const decisions = [];

    for (const [ruleId, rule] of this.decisionRules) {
      try {
        if (rule.condition(context, predictions, systemState)) {
          const decision = rule.action(context, predictions, systemState);
          decisions.push({
            id: `${ruleId}_${Date.now()}`,
            ruleId,
            ...decision,
            context,
            predictions,
          });
        }
      } catch (error) {
        this.logger.error(`Error in decision rule ${ruleId}:`, error);
      }
    }

    return decisions;
  }

  async generateEmergencyDecision(alert) {
    return {
      id: `emergency_${Date.now()}`,
      type: 'emergency_response',
      action: 'activate_failsafe',
      confidence: 0.95,
      priority: 1,
      alert,
    };
  }

  async generateAnomalyResponse(anomaly) {
    const responseMap = {
      latency_spike: {
        type: 'latency_response',
        action: 'enable_circuit_breaker',
        confidence: 0.8,
        priority: 1,
      },
      cost_spike: {
        type: 'cost_response',
        action: 'enable_rate_limiting',
        confidence: 0.7,
        priority: 2,
      },
      error_increase: {
        type: 'error_response',
        action: 'activate_fallback',
        confidence: 0.9,
        priority: 1,
      },
    };

    const response = responseMap[anomaly.type];
    if (response) {
      return {
        id: `anomaly_${Date.now()}`,
        ...response,
        anomaly,
      };
    }

    return null;
  }

  async convertRecommendationToDecision(recommendation) {
    return {
      id: `adapted_${Date.now()}`,
      type: recommendation.type,
      action: recommendation.changes ? 'apply_changes' : 'investigate',
      confidence: 0.6,
      priority: 2,
      recommendation,
    };
  }

  async recalibrateThresholds(updateInfo) {
    // Adjust thresholds based on model accuracy
    const avgAccuracy =
      Object.values(updateInfo.modelMetrics || {}).reduce(
        (sum, metrics) => sum + (metrics.accuracy || 0),
        0
      ) / Object.keys(updateInfo.modelMetrics || {}).length;

    if (avgAccuracy > 0.8) {
      // High accuracy - can be more aggressive
      this.thresholds.latency *= 0.9;
      this.thresholds.cost *= 0.95;
    } else if (avgAccuracy < 0.6) {
      // Low accuracy - be more conservative
      this.thresholds.latency *= 1.1;
      this.thresholds.cost *= 1.05;
    }

    this.logger.info('Decision thresholds recalibrated', this.thresholds);
  }

  async shutdown() {
    this.decisionRules.clear();
  }
}

class ActionExecutor {
  constructor(config) {
    this.config = config;
    this.logger = new Logger({ service: 'ActionExecutor' });
    this.actionHandlers = new Map();
  }

  async initialize() {
    this.setupActionHandlers();
    this.logger.info('Action Executor initialized');
  }

  setupActionHandlers() {
    this.actionHandlers.set('scale_resources', this.scaleResources.bind(this));
    this.actionHandlers.set('enable_caching', this.enableCaching.bind(this));
    this.actionHandlers.set(
      'enable_circuit_breaker',
      this.enableCircuitBreaker.bind(this)
    );
    this.actionHandlers.set(
      'enable_rate_limiting',
      this.enableRateLimiting.bind(this)
    );
    this.actionHandlers.set(
      'optimize_providers',
      this.optimizeProviders.bind(this)
    );
    this.actionHandlers.set(
      'enhance_monitoring',
      this.enhanceMonitoring.bind(this)
    );
  }

  async executeAction(decision) {
    const handler = this.actionHandlers.get(decision.action);
    if (!handler) {
      throw new Error(`No handler for action: ${decision.action}`);
    }

    const startTime = Date.now();
    try {
      const result = await handler(decision);
      const duration = Date.now() - startTime;

      this.logger.info(`Executed action ${decision.action} in ${duration}ms`);
      return {
        status: 'success',
        duration,
        result,
        decision,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed to execute action ${decision.action}:`, error);
      return {
        status: 'failed',
        duration,
        error: error.message,
        decision,
      };
    }
  }

  async scaleResources(decision) {
    // Simulate resource scaling
    return {
      action: 'scale_resources',
      scalingType: 'horizontal',
      newReplicas: 3,
      estimatedImpact: 'latency_reduction_30%',
    };
  }

  async enableCaching(decision) {
    return {
      action: 'enable_caching',
      cacheType: 'intelligent',
      ttl: 3600,
      estimatedSavings: '25%',
    };
  }

  async enableCircuitBreaker(decision) {
    return {
      action: 'enable_circuit_breaker',
      threshold: '5_failures_in_60s',
      timeout: '30s',
      fallbackEnabled: true,
    };
  }

  async enableRateLimiting(decision) {
    return {
      action: 'enable_rate_limiting',
      limit: '100_requests_per_minute',
      scope: 'per_provider',
      gracefulDegradation: true,
    };
  }

  async optimizeProviders(decision) {
    return {
      action: 'optimize_providers',
      strategy: 'cost_performance_balance',
      newRouting: 'intelligent_routing',
      estimatedSavings: '15%',
    };
  }

  async enhanceMonitoring(decision) {
    return {
      action: 'enhance_monitoring',
      newMetrics: ['detailed_latency', 'provider_health', 'cost_tracking'],
      alerting: 'proactive',
      dashboard: 'updated',
    };
  }

  async shutdown() {
    this.actionHandlers.clear();
  }
}

class ContextAnalyzer {
  constructor(config) {
    this.config = config;
    this.logger = new Logger({ service: 'ContextAnalyzer' });
  }

  async initialize() {
    this.logger.info('Context Analyzer initialized');
  }

  async analyzeContext(metrics, systemState) {
    const timeContext = this.analyzeTimeContext();
    const loadContext = this.analyzeLoadContext(metrics);
    const healthContext = this.analyzeHealthContext(systemState);
    const trendContext = this.analyzeTrendContext(metrics);

    return {
      time: timeContext,
      load: loadContext,
      health: healthContext,
      trends: trendContext,
      combined: this.combineContexts(
        timeContext,
        loadContext,
        healthContext,
        trendContext
      ),
    };
  }

  analyzeTimeContext() {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    return {
      hour,
      dayOfWeek,
      isBusinessHours:
        hour >= 9 && hour <= 17 && dayOfWeek >= 1 && dayOfWeek <= 5,
      isPeakTime: (hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16),
      timeZone: now.getTimezoneOffset(),
    };
  }

  analyzeLoadContext(metrics) {
    const load = metrics.load || 0;
    return {
      current: load,
      category: load > 0.8 ? 'high' : load > 0.5 ? 'medium' : 'low',
      trend: this.calculateLoadTrend(metrics),
      predictedPeak: this.predictNextPeak(),
    };
  }

  analyzeHealthContext(systemState) {
    return {
      overall: systemState.health,
      errors: systemState.errors,
      emergencyMode: systemState.emergencyMode,
      lastIncident: systemState.lastIncident || null,
      recoveryTime: this.calculateRecoveryTime(systemState),
    };
  }

  analyzeTrendContext(metrics) {
    return {
      latencyTrend: 'stable', // Simplified
      costTrend: 'increasing',
      errorTrend: 'decreasing',
      usageTrend: 'stable',
    };
  }

  combineContexts(time, load, health, trends) {
    let priority = 'normal';
    let urgency = 'low';

    if (health.emergencyMode || load.category === 'high') {
      priority = 'critical';
      urgency = 'immediate';
    } else if (time.isPeakTime && load.category === 'medium') {
      priority = 'high';
      urgency = 'medium';
    }

    return {
      priority,
      urgency,
      riskLevel: this.calculateRiskLevel(time, load, health, trends),
      recommendedActions: this.generateContextualRecommendations(
        time,
        load,
        health,
        trends
      ),
    };
  }

  calculateRiskLevel(time, load, health, trends) {
    let risk = 0;

    if (health.emergencyMode) risk += 0.5;
    if (load.category === 'high') risk += 0.3;
    if (time.isPeakTime) risk += 0.1;
    if (trends.errorTrend === 'increasing') risk += 0.2;

    return Math.min(1, risk);
  }

  generateContextualRecommendations(time, load, health, trends) {
    const recommendations = [];

    if (time.isPeakTime && load.category !== 'low') {
      recommendations.push('scale_proactively');
    }

    if (health.overall === 'poor') {
      recommendations.push('immediate_health_check');
    }

    if (trends.costTrend === 'increasing') {
      recommendations.push('cost_optimization_review');
    }

    return recommendations;
  }

  calculateLoadTrend(metrics) {
    // Simplified trend calculation
    return 'stable';
  }

  predictNextPeak() {
    const now = new Date();
    const nextPeak = new Date(now);

    if (now.getHours() < 9) {
      nextPeak.setHours(9, 0, 0, 0);
    } else if (now.getHours() < 14) {
      nextPeak.setHours(14, 0, 0, 0);
    } else {
      nextPeak.setDate(nextPeak.getDate() + 1);
      nextPeak.setHours(9, 0, 0, 0);
    }

    return nextPeak.toISOString();
  }

  calculateRecoveryTime(systemState) {
    if (!systemState.lastIncident) return null;

    const now = Date.now();
    const incidentTime = new Date(systemState.lastIncident).getTime();
    return now - incidentTime;
  }

  async shutdown() {
    // Cleanup if needed
  }
}

module.exports = { IntelligentOrchestrator };
