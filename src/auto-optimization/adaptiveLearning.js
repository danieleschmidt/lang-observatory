/**
 * Adaptive Learning System for LLM Observatory
 * Automatically learns from usage patterns and optimizes configurations
 */

const { Logger } = require('../utils/logger');
const EventEmitter = require('events');

class AdaptiveLearningSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      learningRate: 0.01,
      memorySize: 10000,
      adaptationThreshold: 0.05,
      enableOnlineLearning: true,
      modelUpdateInterval: 3600000, // 1 hour
      ...config
    };
    
    this.logger = new Logger({ service: 'AdaptiveLearning' });
    this.patterns = new Map();
    this.performanceHistory = [];
    this.modelWeights = {
      latency: 0.3,
      accuracy: 0.4,
      cost: 0.2,
      reliability: 0.1
    };
    
    this.optimizationRules = new Map();
    this.learningMemory = [];
    this.initialized = false;
    
    if (this.config.enableOnlineLearning) {
      this.setupOnlineLearning();
    }
  }

  async initialize() {
    try {
      this.logger.info('Initializing Adaptive Learning System...');
      
      // Load historical patterns
      await this.loadHistoricalPatterns();
      
      // Initialize optimization rules
      this.initializeOptimizationRules();
      
      // Start continuous learning
      this.startContinuousLearning();
      
      this.initialized = true;
      this.logger.info('Adaptive Learning System initialized successfully');
      
      return this;
    } catch (error) {
      this.logger.error('Failed to initialize Adaptive Learning System:', error);
      throw error;
    }
  }

  setupOnlineLearning() {
    this.on('performanceData', (data) => this.processPerformanceData(data));
    this.on('patternDetected', (pattern) => this.adaptToPattern(pattern));
    this.on('anomalyDetected', (anomaly) => this.handleAnomaly(anomaly));
  }

  async loadHistoricalPatterns() {
    // Simulate loading historical data
    const historicalPatterns = [
      {
        provider: 'openai',
        model: 'gpt-4',
        avgLatency: 1200,
        avgAccuracy: 0.95,
        avgCost: 0.03,
        reliability: 0.99,
        patterns: ['reasoning_tasks', 'code_generation']
      },
      {
        provider: 'anthropic',
        model: 'claude-3',
        avgLatency: 800,
        avgAccuracy: 0.94,
        avgCost: 0.025,
        reliability: 0.98,
        patterns: ['analysis_tasks', 'content_writing']
      }
    ];

    historicalPatterns.forEach(pattern => {
      this.patterns.set(`${pattern.provider}_${pattern.model}`, pattern);
    });

    this.logger.info(`Loaded ${historicalPatterns.length} historical patterns`);
  }

  initializeOptimizationRules() {
    // Rule: High latency detection and optimization
    this.optimizationRules.set('high_latency', {
      condition: (metrics) => metrics.avgLatency > 2000,
      action: (context) => this.optimizeForLatency(context),
      priority: 1
    });

    // Rule: Cost optimization
    this.optimizationRules.set('cost_optimization', {
      condition: (metrics) => metrics.avgCost > 0.05,
      action: (context) => this.optimizeForCost(context),
      priority: 2
    });

    // Rule: Reliability enhancement
    this.optimizationRules.set('reliability_boost', {
      condition: (metrics) => metrics.reliability < 0.95,
      action: (context) => this.enhanceReliability(context),
      priority: 1
    });

    this.logger.info(`Initialized ${this.optimizationRules.size} optimization rules`);
  }

  async processPerformanceData(data) {
    try {
      // Store performance data
      this.performanceHistory.push({
        ...data,
        timestamp: Date.now()
      });

      // Maintain memory size limit
      if (this.performanceHistory.length > this.config.memorySize) {
        this.performanceHistory.shift();
      }

      // Detect patterns
      const patterns = await this.detectPatterns(data);
      if (patterns.length > 0) {
        this.emit('patternDetected', patterns);
      }

      // Check for anomalies
      const anomalies = await this.detectAnomalies(data);
      if (anomalies.length > 0) {
        this.emit('anomalyDetected', anomalies);
      }

      // Learn from data
      await this.learnFromData(data);

    } catch (error) {
      this.logger.error('Error processing performance data:', error);
    }
  }

  async detectPatterns(data) {
    const patterns = [];

    // Pattern: Consistent high performance
    if (data.accuracy > 0.95 && data.latency < 1000) {
      patterns.push({
        type: 'high_performance',
        confidence: 0.9,
        data: data
      });
    }

    // Pattern: Cost-effective usage
    if (data.costPerToken < 0.02 && data.accuracy > 0.9) {
      patterns.push({
        type: 'cost_effective',
        confidence: 0.85,
        data: data
      });
    }

    // Pattern: Peak usage times
    const hour = new Date().getHours();
    if ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16)) {
      patterns.push({
        type: 'peak_usage',
        confidence: 0.8,
        data: data
      });
    }

    return patterns;
  }

  async detectAnomalies(data) {
    const anomalies = [];

    // Get baseline metrics
    const baseline = await this.getBaselineMetrics(data.provider, data.model);

    // Latency anomaly
    if (data.latency > baseline.latency * 2) {
      anomalies.push({
        type: 'latency_spike',
        severity: 'high',
        actual: data.latency,
        expected: baseline.latency,
        deviation: (data.latency - baseline.latency) / baseline.latency
      });
    }

    // Accuracy drop anomaly
    if (data.accuracy < baseline.accuracy * 0.8) {
      anomalies.push({
        type: 'accuracy_drop',
        severity: 'medium',
        actual: data.accuracy,
        expected: baseline.accuracy,
        deviation: (baseline.accuracy - data.accuracy) / baseline.accuracy
      });
    }

    // Cost spike anomaly
    if (data.costPerToken > baseline.costPerToken * 1.5) {
      anomalies.push({
        type: 'cost_spike',
        severity: 'medium',
        actual: data.costPerToken,
        expected: baseline.costPerToken,
        deviation: (data.costPerToken - baseline.costPerToken) / baseline.costPerToken
      });
    }

    return anomalies;
  }

  async getBaselineMetrics(provider, model) {
    const key = `${provider}_${model}`;
    const pattern = this.patterns.get(key);
    
    if (pattern) {
      return {
        latency: pattern.avgLatency,
        accuracy: pattern.avgAccuracy,
        costPerToken: pattern.avgCost,
        reliability: pattern.reliability
      };
    }

    // Default baseline if no historical data
    return {
      latency: 1000,
      accuracy: 0.9,
      costPerToken: 0.03,
      reliability: 0.95
    };
  }

  async learnFromData(data) {
    // Update model weights based on performance
    const performance = this.calculatePerformanceScore(data);
    
    if (performance > 0.8) {
      // Good performance - reinforce current patterns
      this.updateModelWeights(data, 1.0);
    } else if (performance < 0.6) {
      // Poor performance - adjust patterns
      this.updateModelWeights(data, -0.5);
    }

    // Store learning memory
    this.learningMemory.push({
      data: data,
      performance: performance,
      timestamp: Date.now()
    });

    // Maintain memory limit
    if (this.learningMemory.length > this.config.memorySize) {
      this.learningMemory.shift();
    }
  }

  calculatePerformanceScore(data) {
    // Normalize metrics to 0-1 scale
    const normalizedLatency = Math.max(0, 1 - (data.latency / 5000)); // 5s max
    const normalizedAccuracy = data.accuracy || 0;
    const normalizedCost = Math.max(0, 1 - (data.costPerToken / 0.1)); // $0.1 max
    const normalizedReliability = data.reliability || 0.9;

    // Calculate weighted score
    return (
      normalizedLatency * this.modelWeights.latency +
      normalizedAccuracy * this.modelWeights.accuracy +
      normalizedCost * this.modelWeights.cost +
      normalizedReliability * this.modelWeights.reliability
    );
  }

  updateModelWeights(data, adjustment) {
    const learningRate = this.config.learningRate;
    
    // Adjust weights based on performance
    if (data.latency < 1000) {
      this.modelWeights.latency += learningRate * adjustment;
    }
    
    if (data.accuracy > 0.9) {
      this.modelWeights.accuracy += learningRate * adjustment;
    }
    
    if (data.costPerToken < 0.03) {
      this.modelWeights.cost += learningRate * adjustment;
    }

    // Normalize weights
    const sum = Object.values(this.modelWeights).reduce((a, b) => a + b, 0);
    Object.keys(this.modelWeights).forEach(key => {
      this.modelWeights[key] = Math.max(0.01, this.modelWeights[key] / sum);
    });
  }

  async adaptToPattern(patterns) {
    for (const pattern of patterns) {
      try {
        switch (pattern.type) {
          case 'high_performance':
            await this.adaptToHighPerformance(pattern);
            break;
          case 'cost_effective':
            await this.adaptToCostEffective(pattern);
            break;
          case 'peak_usage':
            await this.adaptToPeakUsage(pattern);
            break;
        }
      } catch (error) {
        this.logger.error(`Error adapting to pattern ${pattern.type}:`, error);
      }
    }
  }

  async adaptToHighPerformance(pattern) {
    // Increase resource allocation for high-performing configurations
    const recommendations = {
      type: 'resource_boost',
      provider: pattern.data.provider,
      model: pattern.data.model,
      changes: {
        priority: 'high',
        cacheSize: '+20%',
        connectionPool: '+2'
      }
    };

    this.emit('adaptationRecommendation', recommendations);
    this.logger.info('Adapted to high performance pattern:', pattern.type);
  }

  async adaptToCostEffective(pattern) {
    // Prioritize cost-effective configurations
    const recommendations = {
      type: 'cost_optimization',
      provider: pattern.data.provider,
      model: pattern.data.model,
      changes: {
        routing: 'prefer',
        budget: '+10%',
        monitoring: 'enhanced'
      }
    };

    this.emit('adaptationRecommendation', recommendations);
    this.logger.info('Adapted to cost-effective pattern:', pattern.type);
  }

  async adaptToPeakUsage(pattern) {
    // Scale resources during peak times
    const recommendations = {
      type: 'scaling',
      timeWindow: 'peak_hours',
      changes: {
        replicas: '+2',
        cachePreload: 'enable',
        rateLimits: 'increase'
      }
    };

    this.emit('adaptationRecommendation', recommendations);
    this.logger.info('Adapted to peak usage pattern:', pattern.type);
  }

  async handleAnomaly(anomalies) {
    for (const anomaly of anomalies) {
      try {
        const response = await this.generateAnomalyResponse(anomaly);
        this.emit('anomalyResponse', response);
        
        this.logger.warn(`Handled anomaly: ${anomaly.type}`, {
          severity: anomaly.severity,
          response: response.type
        });
      } catch (error) {
        this.logger.error(`Error handling anomaly ${anomaly.type}:`, error);
      }
    }
  }

  async generateAnomalyResponse(anomaly) {
    switch (anomaly.type) {
      case 'latency_spike':
        return {
          type: 'circuit_breaker',
          action: 'enable',
          threshold: anomaly.actual * 0.8,
          duration: '5m'
        };
      
      case 'accuracy_drop':
        return {
          type: 'fallback_model',
          action: 'activate',
          reason: 'accuracy_degradation'
        };
      
      case 'cost_spike':
        return {
          type: 'rate_limiting',
          action: 'enforce',
          limit: '50%',
          duration: '10m'
        };
      
      default:
        return {
          type: 'monitoring',
          action: 'enhance',
          target: anomaly.type
        };
    }
  }

  startContinuousLearning() {
    setInterval(async () => {
      try {
        await this.performPeriodicLearning();
      } catch (error) {
        this.logger.error('Error in continuous learning:', error);
      }
    }, this.config.modelUpdateInterval);
  }

  async performPeriodicLearning() {
    if (this.learningMemory.length < 100) return; // Need enough data

    // Analyze recent performance trends
    const recentData = this.learningMemory.slice(-100);
    const avgPerformance = recentData.reduce((sum, item) => sum + item.performance, 0) / recentData.length;

    // Update patterns based on learning
    if (avgPerformance > 0.8) {
      // Good performance - consolidate patterns
      await this.consolidatePatterns();
    } else if (avgPerformance < 0.6) {
      // Poor performance - explore new patterns
      await this.exploreNewPatterns();
    }

    this.logger.info(`Performed periodic learning - avg performance: ${avgPerformance.toFixed(3)}`);
  }

  async consolidatePatterns() {
    // Strengthen successful patterns
    const successfulPatterns = this.learningMemory
      .filter(item => item.performance > 0.8)
      .map(item => item.data);

    for (const data of successfulPatterns) {
      const key = `${data.provider}_${data.model}`;
      const existing = this.patterns.get(key) || { count: 0 };
      
      this.patterns.set(key, {
        ...existing,
        avgLatency: (existing.avgLatency || 0) * 0.9 + data.latency * 0.1,
        avgAccuracy: (existing.avgAccuracy || 0) * 0.9 + data.accuracy * 0.1,
        avgCost: (existing.avgCost || 0) * 0.9 + data.costPerToken * 0.1,
        reliability: (existing.reliability || 0) * 0.9 + (data.reliability || 0.9) * 0.1,
        count: existing.count + 1
      });
    }
  }

  async exploreNewPatterns() {
    // Look for new optimization opportunities
    const recentFailures = this.learningMemory
      .filter(item => item.performance < 0.6)
      .map(item => item.data);

    // Generate new optimization rules
    for (const data of recentFailures) {
      const newRule = this.generateOptimizationRule(data);
      if (newRule) {
        this.optimizationRules.set(newRule.id, newRule);
        this.logger.info(`Generated new optimization rule: ${newRule.id}`);
      }
    }
  }

  generateOptimizationRule(failureData) {
    // Generate dynamic optimization rules based on failure patterns
    if (failureData.latency > 2000) {
      return {
        id: `latency_${Date.now()}`,
        condition: (metrics) => metrics.provider === failureData.provider && metrics.latency > 1500,
        action: (context) => ({
          type: 'timeout_adjustment',
          value: Math.min(failureData.latency * 0.8, 5000)
        }),
        priority: 2,
        temporary: true,
        expires: Date.now() + 3600000 // 1 hour
      };
    }

    return null;
  }

  async getAdaptationRecommendations(context = {}) {
    const recommendations = [];

    // Check all optimization rules
    for (const [ruleId, rule] of this.optimizationRules) {
      try {
        if (rule.condition && rule.condition(context)) {
          const action = await rule.action(context);
          recommendations.push({
            ruleId,
            priority: rule.priority || 3,
            action,
            confidence: this.calculateRuleConfidence(ruleId, context)
          });
        }
      } catch (error) {
        this.logger.error(`Error evaluating rule ${ruleId}:`, error);
      }
    }

    // Sort by priority and confidence
    return recommendations.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.confidence - a.confidence;
    });
  }

  calculateRuleConfidence(ruleId, context) {
    // Calculate confidence based on historical success
    const relatedMemory = this.learningMemory.filter(item => 
      item.data.provider === context.provider &&
      item.data.model === context.model
    );

    if (relatedMemory.length === 0) return 0.5;

    const avgPerformance = relatedMemory.reduce((sum, item) => sum + item.performance, 0) / relatedMemory.length;
    return Math.min(0.95, Math.max(0.1, avgPerformance));
  }

  optimizeForLatency(context) {
    return {
      type: 'latency_optimization',
      actions: [
        'enable_connection_pooling',
        'increase_timeout_threshold',
        'activate_regional_fallback'
      ],
      priority: 'high'
    };
  }

  optimizeForCost(context) {
    return {
      type: 'cost_optimization',
      actions: [
        'enable_aggressive_caching',
        'prefer_cost_effective_models',
        'implement_request_batching'
      ],
      priority: 'medium'
    };
  }

  enhanceReliability(context) {
    return {
      type: 'reliability_enhancement',
      actions: [
        'enable_circuit_breaker',
        'increase_retry_attempts',
        'activate_health_monitoring'
      ],
      priority: 'high'
    };
  }

  getModelWeights() {
    return { ...this.modelWeights };
  }

  getPatternsSummary() {
    return {
      totalPatterns: this.patterns.size,
      patterns: Array.from(this.patterns.entries()).map(([key, pattern]) => ({
        key,
        ...pattern
      })),
      optimizationRules: this.optimizationRules.size,
      memorySize: this.learningMemory.length
    };
  }

  async getHealth() {
    return {
      healthy: this.initialized,
      patterns: this.patterns.size,
      memoryUsage: this.learningMemory.length,
      optimizationRules: this.optimizationRules.size,
      modelWeights: this.modelWeights,
      timestamp: new Date().toISOString()
    };
  }

  async shutdown() {
    this.logger.info('Shutting down Adaptive Learning System...');
    this.removeAllListeners();
    this.patterns.clear();
    this.optimizationRules.clear();
    this.learningMemory = [];
    this.initialized = false;
    this.logger.info('Adaptive Learning System shutdown complete');
  }
}

module.exports = { AdaptiveLearningSystem };